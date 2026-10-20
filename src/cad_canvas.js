/**
 * Kapi 2D CAD Canvas
 * Interactive floor plan editor with QuadTree spatial snapping,
 * real-time thermal load heatmap rendering, and zone manipulation.
 */

import { ThermalEngine, BOUNDARY_CONDITIONS } from './thermal_engine.js';

export class CadCanvas {
    constructor(canvasElement, spatialIndex, thermalEngine) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.spatialIndex = spatialIndex;
        this.thermalEngine = thermalEngine;
        this.hourlyEngine = null;
        this.currentHour = 14;
        this.currentSolarPos = null;

        // Viewport transform
        this.scale = 30; // 30 pixels = 1 meter
        this.offsetX = 250;
        this.offsetY = 200;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        // Tool state
        this.mode = 'select'; // 'select', 'draw', 'add_window', 'toggle_boundary'
        this.newPolygonPoints = [];
        this.selectedSpaceId = null;
        this.hoveredSpace = null;
        this.hoveredPoint = null;
        this.hoveredWall = null;
        this.draggedPoint = null;

        this.spaces = [];
        this.heatMapMode = true; // Color-code zones by thermal load density

        // Building / Map True North Rotation (0° = North Up, 90° = North East, etc.)
        this.buildingRotation = 0;
        this.compassPos = { x: 0, y: 0, r: 32 };
        this.isRotatingCompass = false;

        this.onSpaceSelected = null;
        this.onSpacesChanged = null;
        this.onWindowConfigure = null;
        this.onBuildingRotationChanged = null;

        this.initEvents();
        this.resize();
    }

    setSpaces(spaces) {
        this.spaces = spaces;
        this.spaces.forEach(space => this.updateSpaceWalls(space));
        this.spatialIndex.rebuild(spaces);
        this.render();
    }

    setBuildingRotation(degrees) {
        this.buildingRotation = Math.round(((degrees % 360) + 360) % 360);
        this.thermalEngine.buildingRotation = this.buildingRotation;
        if (this.hourlyEngine) {
            this.hourlyEngine.buildingRotation = this.buildingRotation;
        }
        this.spaces.forEach(space => this.updateSpaceWalls(space));
        this.render();
        this.triggerChanged();
        if (this.onBuildingRotationChanged) {
            this.onBuildingRotationChanged(this.buildingRotation);
        }
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    worldToScreen(wx, wy) {
        return {
            x: wx * this.scale + this.offsetX,
            y: wy * this.scale + this.offsetY
        };
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.offsetX) / this.scale,
            y: (sy - this.offsetY) / this.scale
        };
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());

        // Disable default browser context menu on canvas to allow right-click panning
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const mousePos = this.getCanvasMousePos(e);
            const worldBefore = this.screenToWorld(mousePos.x, mousePos.y);

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
            this.scale = Math.max(8, Math.min(120, this.scale * zoomFactor));

            this.offsetX = mousePos.x - worldBefore.x * this.scale;
            this.offsetY = mousePos.y - worldBefore.y * this.scale;
            this.render();
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            const mousePos = this.getCanvasMousePos(e);
            const worldPos = this.screenToWorld(mousePos.x, mousePos.y);

            // Check if clicking on the Compass Rose in top-right (Left click)
            if (e.button === 0) {
                const distToCompass = Math.hypot(mousePos.x - this.compassPos.x, mousePos.y - this.compassPos.y);
                if (distToCompass <= this.compassPos.r + 10) {
                    this.isRotatingCompass = true;
                    this.updateCompassFromMouse(mousePos);
                    return;
                }
            }

            // Right click (button === 2), Middle click (button === 1) or Alt+click pans 2D viewport
            if (e.button === 2 || e.button === 1 || (e.button === 0 && e.altKey)) {
                this.isPanning = true;
                this.panStartX = mousePos.x - this.offsetX;
                this.panStartY = mousePos.y - this.offsetY;
                this.canvas.style.cursor = 'grabbing';
                return;
            }

            if (e.button === 0) {
                if (this.mode === 'select') {
                    // Check if clicking near a point to drag
                    const nearPt = this.spatialIndex.findNearestPoint(worldPos.x, worldPos.y, 14 / this.scale);
                    if (nearPt) {
                        this.draggedPoint = nearPt;
                        return;
                    }

                    // Otherwise select enclosure
                    const enc = this.spatialIndex.findEnclosureAt(worldPos.x, worldPos.y);
                    this.selectedSpaceId = enc ? enc.id : null;
                    if (this.onSpaceSelected) {
                        this.onSpaceSelected(enc);
                    }
                    this.render();
                } else if (this.mode === 'draw') {
                    // Snap to existing point if near
                    const snapPt = this.spatialIndex.findNearestPoint(worldPos.x, worldPos.y, 12 / this.scale);
                    const targetX = snapPt ? snapPt.point.x : Math.round(worldPos.x * 2) / 2;
                    const targetY = snapPt ? snapPt.point.y : Math.round(worldPos.y * 2) / 2;

                    // Close polygon if clicked near first point and at least 3 points
                    if (this.newPolygonPoints.length >= 3) {
                        const firstPt = this.newPolygonPoints[0];
                        const distToFirst = Math.hypot(targetX - firstPt.x, targetY - firstPt.y);
                        if (distToFirst < 0.6) {
                            this.finishDrawingSpace();
                            return;
                        }
                    }

                    this.newPolygonPoints.push({ x: targetX, y: targetY });
                    this.render();
                } else if (this.mode === 'add_window') {
                    const wallItem = this.spatialIndex.findNearestWall(worldPos.x, worldPos.y, 15 / this.scale);
                    if (wallItem) {
                        const space = this.spaces.find(s => s.id === wallItem.spaceId);
                        if (space && space.walls && space.walls[wallItem.wallIndex]) {
                            const wall = space.walls[wallItem.wallIndex];
                            wall.hasWindow = true;
                            if (wall.windowWidth === undefined) {
                                wall.windowWidth = Math.min(Math.round(wall.length * 0.5 * 10) / 10, 2.0);
                            }
                            if (wall.windowHeight === undefined) {
                                wall.windowHeight = Math.min(Math.round((space.height || 3.0) * 0.5 * 10) / 10, 1.4);
                            }
                            this.selectedSpaceId = space.id;
                            this.triggerChanged();
                            if (this.onWindowConfigure) {
                                this.onWindowConfigure(space, wallItem.wallIndex, wall, mousePos);
                            }
                        }
                    }
                } else if (this.mode === 'toggle_boundary') {
                    const wallItem = this.spatialIndex.findNearestWall(worldPos.x, worldPos.y, 15 / this.scale);
                    if (wallItem) {
                        const space = this.spaces.find(s => s.id === wallItem.spaceId);
                        if (space && space.walls && space.walls[wallItem.wallIndex]) {
                            const cur = space.walls[wallItem.wallIndex].boundaryCondition;
                            space.walls[wallItem.wallIndex].boundaryCondition =
                                cur === BOUNDARY_CONDITIONS.OUTDOOR ? BOUNDARY_CONDITIONS.INTERNAL_PARTITION : BOUNDARY_CONDITIONS.OUTDOOR;
                            this.triggerChanged();
                        }
                    }
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const mousePos = this.getCanvasMousePos(e);

            if (this.isRotatingCompass) {
                this.updateCompassFromMouse(mousePos);
                return;
            }

            if (this.isPanning) {
                this.offsetX = mousePos.x - this.panStartX;
                this.offsetY = mousePos.y - this.panStartY;
                this.render();
                return;
            }

            const worldPos = this.screenToWorld(mousePos.x, mousePos.y);

            if (this.draggedPoint) {
                // Drag vertex
                const snapX = Math.round(worldPos.x * 2) / 2;
                const snapY = Math.round(worldPos.y * 2) / 2;
                this.draggedPoint.point.x = snapX;
                this.draggedPoint.point.y = snapY;

                // Sync walls
                const space = this.spaces.find(s => s.id === this.draggedPoint.spaceId);
                if (space) {
                    this.updateSpaceWalls(space);
                    this.spatialIndex.rebuild(this.spaces);
                }
                this.render();
                return;
            }

            // Check hover over compass
            const distToCompass = Math.hypot(mousePos.x - this.compassPos.x, mousePos.y - this.compassPos.y);
            if (distToCompass <= this.compassPos.r + 8) {
                this.canvas.style.cursor = 'pointer';
            } else if (this.mode === 'draw') {
                this.canvas.style.cursor = 'crosshair';
            } else if (this.mode === 'add_window' || this.mode === 'toggle_boundary') {
                this.canvas.style.cursor = 'cell';
            } else {
                this.canvas.style.cursor = 'default';
            }

            // Highlight hover targets
            this.hoveredPoint = this.spatialIndex.findNearestPoint(worldPos.x, worldPos.y, 14 / this.scale);
            this.hoveredWall = this.spatialIndex.findNearestWall(worldPos.x, worldPos.y, 12 / this.scale);
            this.hoveredSpace = this.spatialIndex.findEnclosureAt(worldPos.x, worldPos.y);

            this.render();
        });

        window.addEventListener('mouseup', () => {
            if (this.isRotatingCompass) {
                this.isRotatingCompass = false;
            }
            if (this.isPanning) {
                this.isPanning = false;
                this.canvas.style.cursor = this.mode === 'draw' ? 'crosshair' : 'default';
            }
            if (this.draggedPoint) {
                this.draggedPoint = null;
                this.triggerChanged();
            }
        });

        // Double click to finish polygon
        this.canvas.addEventListener('dblclick', () => {
            if (this.mode === 'draw' && this.newPolygonPoints.length >= 3) {
                this.finishDrawingSpace();
            }
        });
    }

    getCanvasMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    updateCompassFromMouse(mousePos) {
        const dx = mousePos.x - this.compassPos.x;
        const dy = mousePos.y - this.compassPos.y;
        // In screen coordinates: Y goes down. dy = -r corresponds to North (upwards, 0°)
        let angleRad = Math.atan2(dx, -dy);
        let angleDeg = Math.round((angleRad * (180 / Math.PI) + 360) % 360);
        this.setBuildingRotation(angleDeg);
    }

    updateSpaceWalls(space) {
        const pts = space.polygon;
        const walls = [];
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const existingWall = (space.walls && space.walls[i]) ? space.walls[i] : {};
            const wallLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            walls.push({
                p1: p1,
                p2: p2,
                length: wallLength,
                boundaryCondition: existingWall.boundaryCondition || BOUNDARY_CONDITIONS.OUTDOOR,
                hasWindow: existingWall.hasWindow || false,
                windowWidth: existingWall.windowWidth,
                windowHeight: existingWall.windowHeight,
                orientation: ThermalEngine.getSegmentOrientation(p1, p2, this.buildingRotation)
            });
        }
        space.walls = walls;
        space.area = ThermalEngine.calculatePolygonArea(pts);
    }

    finishDrawingSpace() {
        if (this.newPolygonPoints.length < 3) return;
        const id = 'space_' + Date.now();
        const spaceNumber = this.spaces.length + 1;
        const newSpace = {
            id: id,
            name: `Space ${spaceNumber}`,
            spaceNumber: spaceNumber,
            zone: `Zone ${Math.ceil(spaceNumber / 2)}`,
            polygon: this.newPolygonPoints,
            height: 3.0,
            occupants: Math.max(1, Math.round(ThermalEngine.calculatePolygonArea(this.newPolygonPoints) / 10)),
            lightingDensity: 10.0,
            equipmentDensity: 15.0,
            notes: 'Newly sketched space',
            isMultiLevel: false,
            isUnmodeled: false,
            walls: []
        };
        this.updateSpaceWalls(newSpace);
        this.spaces.push(newSpace);
        this.newPolygonPoints = [];
        this.mode = 'select';
        this.selectedSpaceId = id;
        this.triggerChanged();
    }

    triggerChanged() {
        this.spatialIndex.rebuild(this.spaces);
        this.render();
        if (this.onSpacesChanged) {
            this.onSpacesChanged(this.spaces);
        }
        if (this.onSpaceSelected) {
            const sel = this.spaces.find(s => s.id === this.selectedSpaceId);
            this.onSpaceSelected(sel);
        }
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        this.renderGrid(ctx, width, height);
        this.renderSpaces(ctx);
        this.renderDrawingPolygon(ctx);
        this.renderSelectionAndHighlights(ctx);
        this.renderCompass(ctx);
    }

    renderGrid(ctx, width, height) {
        ctx.save();
        ctx.strokeStyle = '#22272e';
        ctx.lineWidth = 1;

        const leftWorld = this.screenToWorld(0, 0);
        const rightWorld = this.screenToWorld(width, height);

        const startX = Math.floor(leftWorld.x);
        const endX = Math.ceil(rightWorld.x);
        const startY = Math.floor(leftWorld.y);
        const endY = Math.ceil(rightWorld.y);

        // Major grid lines (every 5 meters) and minor (every 1 meter)
        for (let x = startX; x <= endX; x++) {
            const screen = this.worldToScreen(x, 0);
            ctx.beginPath();
            ctx.strokeStyle = (x % 5 === 0) ? '#2d333b' : '#1c2128';
            ctx.moveTo(screen.x, 0);
            ctx.lineTo(screen.x, height);
            ctx.stroke();
        }

        for (let y = startY; y <= endY; y++) {
            const screen = this.worldToScreen(0, y);
            ctx.beginPath();
            ctx.strokeStyle = (y % 5 === 0) ? '#2d333b' : '#1c2128';
            ctx.moveTo(0, screen.y);
            ctx.lineTo(width, screen.y);
            ctx.stroke();
        }

        // Axes (0,0)
        const origin = this.worldToScreen(0, 0);
        ctx.strokeStyle = '#444c56';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(origin.x, 0);
        ctx.lineTo(origin.x, height);
        ctx.moveTo(0, origin.y);
        ctx.lineTo(width, origin.y);
        ctx.stroke();

        ctx.restore();
    }

    getHeatmapColor(loadWpM2) {
        // Range: 40 W/m² (cool/blue-green) to 160 W/m² (hot/orange-red)
        const t = Math.max(0, Math.min(1, (loadWpM2 - 40) / 100));
        // Interpolate RGBA
        const r = Math.round(30 + t * 220);
        const g = Math.round(140 - t * 80);
        const b = Math.round(200 - t * 160);
        return `rgba(${r}, ${g}, ${b}, 0.45)`;
    }

    renderSpaces(ctx) {
        for (const space of this.spaces) {
            if (!space.polygon || space.polygon.length < 3) continue;

            const isSelected = space.id === this.selectedSpaceId;
            const isHovered = this.hoveredSpace && this.hoveredSpace.id === space.id;

            // Calculate thermal load for heatmap (Dynamic Hourly if available, else static)
            let loadWpM2 = 60;
            let displayLoadTR = 0;
            let displayBTUh = 0;
            if (this.hourlyEngine) {
                const hourRes = this.hourlyEngine.calculateSpaceHour(space, this.currentHour, this.thermalEngine.designConditions);
                loadWpM2 = hourRes.loadDensityWpM2;
                displayLoadTR = hourRes.totalCoolingTR;
                displayBTUh = hourRes.totalCoolingBTUh;
            } else {
                const loadResult = this.thermalEngine.calculateSpaceThermalLoad(space);
                loadWpM2 = loadResult.loads.totals.loadDensityWpM2;
                displayLoadTR = loadResult.loads.totals.coolingTons;
                displayBTUh = loadResult.loads.totals.coolingBTUh;
            }

            ctx.save();
            ctx.beginPath();
            const first = this.worldToScreen(space.polygon[0].x, space.polygon[0].y);
            ctx.moveTo(first.x, first.y);
            for (let i = 1; i < space.polygon.length; i++) {
                const pt = this.worldToScreen(space.polygon[i].x, space.polygon[i].y);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.closePath();

            // Fill polygon
            if (this.heatMapMode) {
                ctx.fillStyle = this.getHeatmapColor(loadWpM2);
            } else {
                ctx.fillStyle = isSelected ? 'rgba(56, 139, 253, 0.4)' : 'rgba(99, 110, 123, 0.25)';
            }
            ctx.fill();

            // Render Walls
            if (space.walls) {
                space.walls.forEach((wall, idx) => {
                    const sp1 = this.worldToScreen(wall.p1.x, wall.p1.y);
                    const sp2 = this.worldToScreen(wall.p2.x, wall.p2.y);

                    ctx.beginPath();
                    ctx.moveTo(sp1.x, sp1.y);
                    ctx.lineTo(sp2.x, sp2.y);

                    const isSunFacing = this.hourlyEngine && this.currentSolarPos && this.currentSolarPos.isSunUp &&
                        wall.boundaryCondition === BOUNDARY_CONDITIONS.OUTDOOR &&
                        this.hourlyEngine.getWallSolarIncidence(wall.orientation ? wall.orientation.angle : 0, this.currentSolarPos).isSunFacing;

                    if (wall.boundaryCondition === BOUNDARY_CONDITIONS.INTERNAL_PARTITION) {
                        ctx.strokeStyle = '#8b949e'; // Partition wall (grey)
                        ctx.lineWidth = 3;
                    } else if (isSunFacing) {
                        ctx.strokeStyle = '#e3b341'; // Sun-illuminated exterior wall (golden)
                        ctx.lineWidth = 6;
                    } else {
                        ctx.strokeStyle = '#f0883e'; // Exterior wall (orange)
                        ctx.lineWidth = 4;
                    }
                    ctx.stroke();

                    // Render Window opening if present
                    if (wall.hasWindow) {
                        const midX = (sp1.x + sp2.x) / 2;
                        const midY = (sp1.y + sp2.y) / 2;
                        const dx = sp2.x - sp1.x;
                        const dy = sp2.y - sp1.y;
                        const len = Math.hypot(dx, dy);
                        if (len > 0) {
                            const ux = dx / len;
                            const uy = dy / len;
                            const winW = wall.windowWidth !== undefined ? wall.windowWidth : Math.min(wall.length * 0.5, 1.8);
                            const winH = wall.windowHeight !== undefined ? wall.windowHeight : 1.4;
                            const winPixelHalfLen = Math.min(len * 0.45, Math.max(8, (winW * this.scale) / 2));

                            // Main window glass line
                            ctx.beginPath();
                            ctx.moveTo(midX - ux * winPixelHalfLen, midY - uy * winPixelHalfLen);
                            ctx.lineTo(midX + ux * winPixelHalfLen, midY + uy * winPixelHalfLen);
                            ctx.strokeStyle = isSunFacing ? '#ffe066' : '#58a6ff'; // Window cyan or solar bright
                            ctx.lineWidth = 7;
                            ctx.stroke();

                            // Double pane interior highlight
                            const nx = -uy * 2.5;
                            const ny = ux * 2.5;
                            ctx.beginPath();
                            ctx.moveTo(midX - ux * winPixelHalfLen + nx, midY - uy * winPixelHalfLen + ny);
                            ctx.lineTo(midX + ux * winPixelHalfLen + nx, midY + uy * winPixelHalfLen + ny);
                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = 1.5;
                            ctx.stroke();

                            // Window dimensions tag on canvas
                            if (this.scale >= 22) {
                                ctx.save();
                                const tagX = midX - ny * 13;
                                const tagY = midY + nx * 13;
                                const tagText = `${winW.toFixed(1)}x${winH.toFixed(1)}m`;
                                ctx.font = 'bold 9px Inter, sans-serif';
                                const tagW = ctx.measureText(tagText).width + 6;
                                ctx.fillStyle = 'rgba(22, 27, 34, 0.9)';
                                ctx.strokeStyle = isSunFacing ? '#e3b341' : '#388bfd';
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                ctx.rect(tagX - tagW / 2, tagY - 6, tagW, 12);
                                ctx.fill();
                                ctx.stroke();
                                ctx.fillStyle = '#f0f6fc';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(tagText, tagX, tagY);
                                ctx.restore();
                            }
                        }
                    }
                });
            }

            // Room Label (Center of mass)
            let cx = 0, cy = 0;
            space.polygon.forEach(p => { cx += p.x; cy += p.y; });
            cx /= space.polygon.length;
            cy /= space.polygon.length;
            const centerScreen = this.worldToScreen(cx, cy);

            ctx.fillStyle = '#f0f6fc';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(space.name, centerScreen.x, centerScreen.y - 8);

            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = '#8b949e';
            const areaM2 = space.area || ThermalEngine.calculatePolygonArea(space.polygon);
            ctx.fillText(`${areaM2.toFixed(1)} m² | ${displayLoadTR} TR`, centerScreen.x, centerScreen.y + 6);
            ctx.fillText(`${displayBTUh.toLocaleString()} BTU/h (${loadWpM2} W/m²)`, centerScreen.x, centerScreen.y + 19);

            ctx.restore();
        }
    }

    renderDrawingPolygon(ctx) {
        if (this.mode !== 'draw' || this.newPolygonPoints.length === 0) return;

        ctx.save();
        ctx.strokeStyle = '#58a6ff';
        ctx.fillStyle = 'rgba(88, 166, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        const first = this.worldToScreen(this.newPolygonPoints[0].x, this.newPolygonPoints[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < this.newPolygonPoints.length; i++) {
            const pt = this.worldToScreen(this.newPolygonPoints[i].x, this.newPolygonPoints[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        // Draw points
        ctx.setLineDash([]);
        for (const p of this.newPolygonPoints) {
            const s = this.worldToScreen(p.x, p.y);
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#58a6ff';
            ctx.fill();
        }

        ctx.restore();
    }

    renderSelectionAndHighlights(ctx) {
        ctx.save();

        // Highlight selected space vertices for dragging
        if (this.selectedSpaceId) {
            const selSpace = this.spaces.find(s => s.id === this.selectedSpaceId);
            if (selSpace && selSpace.polygon) {
                for (const p of selSpace.polygon) {
                    const sp = this.worldToScreen(p.x, p.y);
                    ctx.beginPath();
                    ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = '#58a6ff';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }

        // Highlight Hovered Wall
        if (this.hoveredWall && (this.mode === 'add_window' || this.mode === 'toggle_boundary')) {
            const p1 = this.worldToScreen(this.hoveredWall.p1.x, this.hoveredWall.p1.y);
            const p2 = this.worldToScreen(this.hoveredWall.p2.x, this.hoveredWall.p2.y);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#3fb950';
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        // Highlight Hovered Point (Snap indicator)
        if (this.hoveredPoint) {
            const sp = this.worldToScreen(this.hoveredPoint.point.x, this.hoveredPoint.point.y);
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = '#3fb950';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }

    renderCompass(ctx) {
        ctx.save();
        const cx = this.canvas.width - 60;
        const cy = 60;
        const r = 28;
        this.compassPos = { x: cx, y: cy, r: r };

        // Outer Bezel
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(22, 27, 34, 0.92)';
        ctx.strokeStyle = this.isRotatingCompass ? '#58a6ff' : '#30363d';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Rotating compass needle
        ctx.save();
        ctx.translate(cx, cy);
        const rotRad = -(this.buildingRotation * Math.PI) / 180.0;
        ctx.rotate(rotRad);

        // North arrow (Red)
        ctx.beginPath();
        ctx.moveTo(0, -r + 4);
        ctx.lineTo(5, 2);
        ctx.lineTo(0, 0);
        ctx.fillStyle = '#f85149';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -r + 4);
        ctx.lineTo(-5, 2);
        ctx.lineTo(0, 0);
        ctx.fillStyle = '#da3633';
        ctx.fill();

        // South arrow (White / Slate)
        ctx.beginPath();
        ctx.moveTo(0, r - 4);
        ctx.lineTo(5, -2);
        ctx.lineTo(0, 0);
        ctx.fillStyle = '#8b949e';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, r - 4);
        ctx.lineTo(-5, -2);
        ctx.lineTo(0, 0);
        ctx.fillStyle = '#6e7681';
        ctx.fill();

        // Center pivot
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f0f6fc';
        ctx.fill();

        // Cardinal "N"
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillStyle = '#f85149';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('N', 0, -r - 2);

        ctx.restore();

        // Rotation angle label below
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillStyle = this.isRotatingCompass ? '#58a6ff' : '#8b949e';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.buildingRotation}°`, cx, cy + r + 15);

        // Render Dynamic Sun Vector if sun is up (adjusted for building rotation!)
        if (this.currentSolarPos && this.currentSolarPos.isSunUp) {
            const relSunAzimuth = (this.currentSolarPos.azimuthDeg - this.buildingRotation + 360) % 360;
            const sunAzRad = (relSunAzimuth - 90) * (Math.PI / 180.0);
            const sunDist = 52;
            const sunX = cx + Math.cos(sunAzRad) * sunDist;
            const sunY = cy + Math.sin(sunAzRad) * sunDist;

            // Sun glow
            ctx.beginPath();
            ctx.arc(sunX, sunY, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#e3b341';
            ctx.shadowColor = '#f0883e';
            ctx.shadowBlur = 14;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Sun rays pointing toward center
            ctx.beginPath();
            ctx.moveTo(sunX, sunY);
            ctx.lineTo(cx, cy);
            ctx.strokeStyle = 'rgba(240, 136, 62, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.fillStyle = '#e3b341';
            ctx.fillText(`Sol: ${this.currentSolarPos.altitudeDeg}°`, cx, cy + r + 28);
        }

        ctx.restore();
    }
}

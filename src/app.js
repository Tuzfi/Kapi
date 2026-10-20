/**
 * Kapi - Main Application Logic
 * Integrates Spatial Index, Alphanumeric Space Search, Thermal Calculation Engine,
 * 2D Interactive CAD Floor Plan, and 24-Hour Dynamic Hourly Simulation.
 */

import { SpatialIndex } from './spatial_index.js';
import { SpaceSearchEngine } from './space_search.js';
import { ThermalEngine, BOUNDARY_CONDITIONS } from './thermal_engine.js';
import { HourlyEngine } from './hourly_engine.js';
import { CadCanvas } from './cad_canvas.js';

// Default Building Spaces (Sample Office Layout)
const initialSpaces = [
    {
        id: 'space_1',
        name: 'Executive Office 101',
        spaceNumber: 101,
        zone: 'Zone 1 - East Wing',
        notes: 'Corner executive office with double exterior exposure (N & E)',
        isMultiLevel: false,
        isUnmodeled: false,
        height: 3.2,
        occupants: 2,
        lightingDensity: 9.0, // W/m²
        equipmentDensity: 20.0, // W/m²
        polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 5 },
            { x: 0, y: 5 }
        ],
        walls: [
            { p1: { x: 0, y: 0 }, p2: { x: 6, y: 0 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: true, orientation: { name: 'North', angle: 0 } },
            { p1: { x: 6, y: 0 }, p2: { x: 6, y: 5 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: true, orientation: { name: 'East', angle: 90 } },
            { p1: { x: 6, y: 5 }, p2: { x: 0, y: 5 }, boundaryCondition: BOUNDARY_CONDITIONS.INTERNAL_PARTITION, hasWindow: false, orientation: { name: 'South', angle: 180 } },
            { p1: { x: 0, y: 5 }, p2: { x: 0, y: 0 }, boundaryCondition: BOUNDARY_CONDITIONS.INTERNAL_PARTITION, hasWindow: false, orientation: { name: 'West', angle: 270 } }
        ]
    },
    {
        id: 'space_2',
        name: 'Conference Room 102',
        spaceNumber: 102,
        zone: 'Zone 1 - East Wing',
        notes: 'High occupancy meeting space with projector and AV rack',
        isMultiLevel: false,
        isUnmodeled: false,
        height: 3.2,
        occupants: 10,
        lightingDensity: 12.0,
        equipmentDensity: 25.0,
        polygon: [
            { x: 6, y: 0 },
            { x: 14, y: 0 },
            { x: 14, y: 5 },
            { x: 6, y: 5 }
        ],
        walls: [
            { p1: { x: 6, y: 0 }, p2: { x: 14, y: 0 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: true, orientation: { name: 'North', angle: 0 } },
            { p1: { x: 14, y: 0 }, p2: { x: 14, y: 5 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: false, orientation: { name: 'East', angle: 90 } },
            { p1: { x: 14, y: 5 }, p2: { x: 6, y: 5 }, boundaryCondition: BOUNDARY_CONDITIONS.INTERNAL_PARTITION, hasWindow: false, orientation: { name: 'South', angle: 180 } },
            { p1: { x: 6, y: 5 }, p2: { x: 6, y: 0 }, boundaryCondition: BOUNDARY_CONDITIONS.INTERNAL_PARTITION, hasWindow: false, orientation: { name: 'West', angle: 270 } }
        ]
    },
    {
        id: 'space_3',
        name: 'Open Workspace 103',
        spaceNumber: 103,
        zone: 'Zone 2 - West Wing',
        notes: 'Main engineering open layout workstations facing West',
        isMultiLevel: false,
        isUnmodeled: false,
        height: 3.2,
        occupants: 16,
        lightingDensity: 8.5,
        equipmentDensity: 18.0,
        polygon: [
            { x: 0, y: 5 },
            { x: 14, y: 5 },
            { x: 14, y: 12 },
            { x: 0, y: 12 }
        ],
        walls: [
            { p1: { x: 0, y: 5 }, p2: { x: 14, y: 5 }, boundaryCondition: BOUNDARY_CONDITIONS.INTERNAL_PARTITION, hasWindow: false, orientation: { name: 'North', angle: 0 } },
            { p1: { x: 14, y: 5 }, p2: { x: 14, y: 12 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: true, orientation: { name: 'East', angle: 90 } },
            { p1: { x: 14, y: 12 }, p2: { x: 0, y: 12 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: true, orientation: { name: 'South', angle: 180 } },
            { p1: { x: 0, y: 12 }, p2: { x: 0, y: 5 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: true, orientation: { name: 'West', angle: 270 } }
        ]
    },
    {
        id: 'space_4',
        name: 'Data Server Room 104',
        spaceNumber: 104,
        zone: 'Zone 3 - Critical IT',
        notes: 'High internal sensible plug load with constant cooling requirement',
        isMultiLevel: false,
        isUnmodeled: false,
        height: 3.2,
        occupants: 1,
        lightingDensity: 5.0,
        equipmentDensity: 180.0, // High server plug load
        polygon: [
            { x: 14, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 7 },
            { x: 14, y: 7 }
        ],
        walls: [
            { p1: { x: 14, y: 0 }, p2: { x: 20, y: 0 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: false, orientation: { name: 'North', angle: 0 } },
            { p1: { x: 20, y: 0 }, p2: { x: 20, y: 7 }, boundaryCondition: BOUNDARY_CONDITIONS.OUTDOOR, hasWindow: false, orientation: { name: 'East', angle: 90 } },
            { p1: { x: 20, y: 7 }, p2: { x: 14, y: 7 }, boundaryCondition: BOUNDARY_CONDITIONS.INTERNAL_PARTITION, hasWindow: false, orientation: { name: 'South', angle: 180 } },
            { p1: { x: 14, y: 7 }, p2: { x: 14, y: 0 }, boundaryCondition: BOUNDARY_CONDITIONS.INTERNAL_PARTITION, hasWindow: false, orientation: { name: 'West', angle: 270 } }
        ]
    }
];

class KapiApp {
    constructor() {
        this.spaces = JSON.parse(JSON.stringify(initialSpaces));
        this.spatialIndex = new SpatialIndex();
        this.searchEngine = new SpaceSearchEngine();
        this.thermalEngine = new ThermalEngine();
        this.hourlyEngine = new HourlyEngine(-23.55); // Latitude São Paulo / Subtropical

        this.currentHour = 14; // Default 14:00 (afternoon peak)
        this.isPlaying = false;
        this.playInterval = null;

        this.canvasElem = document.getElementById('cad-canvas');
        this.cadCanvas = new CadCanvas(this.canvasElem, this.spatialIndex, this.thermalEngine);
        this.cadCanvas.hourlyEngine = this.hourlyEngine;
        this.cadCanvas.currentHour = this.currentHour;
        this.cadCanvas.currentSolarPos = this.hourlyEngine.getSolarPosition(this.currentHour);

        this.initUI();
        this.initHourlyTimeline();
        this.cadCanvas.setSpaces(this.spaces);
        this.updateCalculations();
        this.renderSpaceList();
        this.renderHourlyChart();
    }

    initUI() {
        // Search bar
        const searchInput = document.getElementById('search-input');
        const searchNotesCheckbox = document.getElementById('search-notes');
        const filterMultiLevelSelect = document.getElementById('filter-multilevel');
        const filterUnmodeledSelect = document.getElementById('filter-unmodeled');

        const doSearch = () => {
            this.searchEngine.searchQuery = searchInput.value;
            this.searchEngine.includeNotes = searchNotesCheckbox.checked;
            this.searchEngine.showMultiLevel = filterMultiLevelSelect.value;
            this.searchEngine.showUnmodeled = filterUnmodeledSelect.value;
            this.renderSpaceList();
        };

        searchInput.addEventListener('input', doSearch);
        searchNotesCheckbox.addEventListener('change', doSearch);
        filterMultiLevelSelect.addEventListener('change', doSearch);
        filterUnmodeledSelect.addEventListener('change', doSearch);

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.mode;
                this.cadCanvas.mode = mode;
                if (mode !== 'draw') {
                    this.cadCanvas.newPolygonPoints = [];
                }
                this.cadCanvas.render();
            });
        });

        // Heatmap Toggle
        const heatmapBtn = document.getElementById('toggle-heatmap');
        if (heatmapBtn) {
            heatmapBtn.addEventListener('click', () => {
                this.cadCanvas.heatMapMode = !this.cadCanvas.heatMapMode;
                heatmapBtn.classList.toggle('active', this.cadCanvas.heatMapMode);
                this.cadCanvas.render();
            });
        }

        // CAD Canvas callbacks
        this.cadCanvas.onSpaceSelected = (space) => {
            this.populatePropertyPanel(space);
            this.renderHourlyChart();
        };

        this.cadCanvas.onSpacesChanged = (spaces) => {
            this.spaces = spaces;
            this.updateCalculations();
            this.renderSpaceList();
            this.renderHourlyChart();
        };

        this.initPropertyPanelEvents();
        this.initWeatherEvents();
        this.initRotationEvents();
        this.initWindowModalEvents();
    }

    initRotationEvents() {
        const rotInput = document.getElementById('input-building-rotation');
        const rotSlider = document.getElementById('slider-building-rotation');
        const rotCCW = document.getElementById('btn-rot-ccw');
        const rotCW = document.getElementById('btn-rot-cw');

        const updateRotation = (deg) => {
            deg = Math.round(((deg % 360) + 360) % 360);
            if (rotInput) rotInput.value = deg;
            if (rotSlider) rotSlider.value = deg;
            this.cadCanvas.setBuildingRotation(deg);
            this.updateCalculations();
            this.renderHourlyChart();
            const sel = this.spaces.find(s => s.id === this.cadCanvas.selectedSpaceId);
            if (sel) this.populatePropertyPanel(sel);
        };

        if (rotInput) {
            rotInput.addEventListener('input', () => updateRotation(parseFloat(rotInput.value) || 0));
        }
        if (rotSlider) {
            rotSlider.addEventListener('input', () => updateRotation(parseFloat(rotSlider.value) || 0));
        }
        if (rotCCW) {
            rotCCW.addEventListener('click', () => {
                const current = parseFloat(rotInput.value) || 0;
                updateRotation(current - 15);
            });
        }
        if (rotCW) {
            rotCW.addEventListener('click', () => {
                const current = parseFloat(rotInput.value) || 0;
                updateRotation(current + 15);
            });
        }

        this.cadCanvas.onBuildingRotationChanged = (deg) => {
            if (rotInput) rotInput.value = deg;
            if (rotSlider) rotSlider.value = deg;
            this.updateCalculations();
            this.renderHourlyChart();
            const sel = this.spaces.find(s => s.id === this.cadCanvas.selectedSpaceId);
            if (sel) this.populatePropertyPanel(sel);
        };
    }

    initWindowModalEvents() {
        const modal = document.getElementById('window-modal');
        const closeBtn = document.getElementById('btn-close-window-modal');
        const saveBtn = document.getElementById('btn-save-window');
        const removeBtn = document.getElementById('btn-remove-window');
        const widthInput = document.getElementById('modal-win-width');
        const heightInput = document.getElementById('modal-win-height');
        const wallInfo = document.getElementById('window-modal-wall-info');
        const preview = document.getElementById('window-modal-preview');

        let currentEditing = null;

        const updatePreview = () => {
            if (!currentEditing) return;
            const w = Math.max(0.2, parseFloat(widthInput.value) || 1.8);
            const h = Math.max(0.2, parseFloat(heightInput.value) || 1.4);
            const gross = currentEditing.wall.length * (currentEditing.space.height || 3.0);
            const area = Math.min(gross * 0.85, w * h);
            const wwr = ((area / gross) * 100).toFixed(1);
            if (preview) {
                preview.innerHTML = `Área da Janela: <strong>${area.toFixed(2)} m²</strong> | WWR: <strong>${wwr}%</strong>`;
            }
        };

        if (widthInput) widthInput.addEventListener('input', updatePreview);
        if (heightInput) heightInput.addEventListener('input', updatePreview);

        this.cadCanvas.onWindowConfigure = (space, wallIndex, wall) => {
            currentEditing = { space, wallIndex, wall };
            modal.classList.remove('hidden');
            if (wallInfo) {
                wallInfo.textContent = `${space.name} - Parede ${wallIndex + 1} (${wall.orientation.name}, Comp: ${wall.length.toFixed(1)}m, Alt: ${(space.height || 3.0).toFixed(1)}m)`;
            }
            if (widthInput) widthInput.value = wall.windowWidth !== undefined ? wall.windowWidth : Math.min(Math.round(wall.length * 0.5 * 10) / 10, 2.0);
            if (heightInput) heightInput.value = wall.windowHeight !== undefined ? wall.windowHeight : Math.min(Math.round((space.height || 3.0) * 0.5 * 10) / 10, 1.4);
            updatePreview();
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            currentEditing = null;
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (!currentEditing) return;
                const w = Math.max(0.2, parseFloat(widthInput.value) || 1.8);
                const h = Math.max(0.2, parseFloat(heightInput.value) || 1.4);
                currentEditing.wall.hasWindow = true;
                currentEditing.wall.windowWidth = w;
                currentEditing.wall.windowHeight = h;
                this.cadCanvas.triggerChanged();
                closeModal();
                this.populatePropertyPanel(currentEditing.space);
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                if (!currentEditing) return;
                currentEditing.wall.hasWindow = false;
                this.cadCanvas.triggerChanged();
                closeModal();
                this.populatePropertyPanel(currentEditing.space);
            });
        }
    }

    initHourlyTimeline() {
        const slider = document.getElementById('hour-slider');
        const playBtn = document.getElementById('btn-play-timeline');

        const onHourChange = (newHour) => {
            this.currentHour = parseInt(newHour, 10);
            this.cadCanvas.currentHour = this.currentHour;
            this.cadCanvas.currentSolarPos = this.hourlyEngine.getSolarPosition(this.currentHour);
            slider.value = this.currentHour;

            this.updateTimelineBadges();
            this.updateCalculations();
            this.cadCanvas.render();
            this.renderHourlyChart();

            const sel = this.spaces.find(s => s.id === this.cadCanvas.selectedSpaceId);
            if (sel) this.populatePropertyPanel(sel);
        };

        if (slider) {
            slider.addEventListener('input', (e) => onHourChange(e.target.value));
        }

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.isPlaying = !this.isPlaying;
                playBtn.innerHTML = this.isPlaying ? '⏸ Pausar' : '▶ Reproduzir 24h';
                playBtn.classList.toggle('active', this.isPlaying);

                if (this.isPlaying) {
                    this.playInterval = setInterval(() => {
                        const nextHour = (this.currentHour + 1) % 24;
                        onHourChange(nextHour);
                    }, 450);
                } else {
                    clearInterval(this.playInterval);
                }
            });
        }

        this.updateTimelineBadges();
    }

    updateTimelineBadges() {
        const hour = this.currentHour;
        const timeBadge = document.getElementById('timeline-time-badge');
        const tempBadge = document.getElementById('timeline-temp-badge');
        const sunBadge = document.getElementById('timeline-sun-badge');

        const tempOut = this.hourlyEngine.getHourlyOutdoorTemp(hour, this.thermalEngine.designConditions.summerOutdoorDB);
        const solar = this.hourlyEngine.getSolarPosition(hour);

        let periodLabel = 'Noite';
        if (hour >= 6 && hour < 12) periodLabel = 'Manhã (Sol Leste)';
        else if (hour >= 12 && hour < 14) periodLabel = 'Meio-dia (Pico Cobertura)';
        else if (hour >= 14 && hour < 18) periodLabel = 'Tarde (Pico Oeste)';

        if (timeBadge) timeBadge.textContent = `${String(hour).padStart(2, '0')}:00h - ${periodLabel}`;
        if (tempBadge) tempBadge.textContent = `Ext: ${tempOut.toFixed(1)}°C`;
        if (sunBadge) {
            if (solar.isSunUp) {
                sunBadge.textContent = `☀️ Alt: ${solar.altitudeDeg}° | Azim: ${solar.azimuthDeg}° (${solar.directNormalIrradiance} W/m²)`;
            } else {
                sunBadge.textContent = `🌙 Noite (Sem radiação direta)`;
            }
        }
    }

    initWeatherEvents() {
        const outdoorTemp = document.getElementById('weather-outdoor-db');
        const indoorTemp = document.getElementById('weather-indoor-db');
        const peakSolar = document.getElementById('weather-peak-solar');

        const updateWeather = () => {
            this.thermalEngine.designConditions.summerOutdoorDB = parseFloat(outdoorTemp.value) || 35;
            this.thermalEngine.designConditions.summerIndoorDB = parseFloat(indoorTemp.value) || 24;
            this.thermalEngine.designConditions.peakSolarRadiation = parseFloat(peakSolar.value) || 650;
            this.updateCalculations();
            this.cadCanvas.render();
            this.renderHourlyChart();
        };

        if (outdoorTemp) outdoorTemp.addEventListener('input', updateWeather);
        if (indoorTemp) indoorTemp.addEventListener('input', updateWeather);
        if (peakSolar) peakSolar.addEventListener('input', updateWeather);
    }

    initPropertyPanelEvents() {
        const bindInput = (id, prop, isNumber = false) => {
            const elem = document.getElementById(id);
            if (!elem) return;
            elem.addEventListener('input', () => {
                const space = this.spaces.find(s => s.id === this.cadCanvas.selectedSpaceId);
                if (space) {
                    space[prop] = isNumber ? (parseFloat(elem.value) || 0) : elem.value;
                    this.cadCanvas.triggerChanged();
                    this.renderHourlyChart();
                }
            });
        };

        bindInput('prop-name', 'name');
        bindInput('prop-zone', 'zone');
        bindInput('prop-height', 'height', true);
        bindInput('prop-occupants', 'occupants', true);
        bindInput('prop-lighting', 'lightingDensity', true);
        bindInput('prop-equipment', 'equipmentDensity', true);
        bindInput('prop-notes', 'notes');

        const delBtn = document.getElementById('btn-delete-space');
        if (delBtn) {
            delBtn.addEventListener('click', () => {
                if (this.cadCanvas.selectedSpaceId) {
                    this.spaces = this.spaces.filter(s => s.id !== this.cadCanvas.selectedSpaceId);
                    this.cadCanvas.selectedSpaceId = null;
                    this.cadCanvas.setSpaces(this.spaces);
                    this.updateCalculations();
                    this.renderSpaceList();
                    this.renderHourlyChart();
                    this.populatePropertyPanel(null);
                }
            });
        }
    }

    populatePropertyPanel(space) {
        const panel = document.getElementById('property-panel');
        if (!space) {
            panel.classList.add('disabled');
            return;
        }
        panel.classList.remove('disabled');

        const setValue = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined ? val : '';
        };

        setValue('prop-name', space.name);
        setValue('prop-zone', space.zone);
        setValue('prop-height', space.height);
        setValue('prop-occupants', space.occupants);
        setValue('prop-lighting', space.lightingDensity);
        setValue('prop-equipment', space.equipmentDensity);
        setValue('prop-notes', space.notes);

        // Calculate dynamic load for current hour
        const currentHourLoad = this.hourlyEngine.calculateSpaceHour(space, this.currentHour, this.thermalEngine.designConditions);
        // Calculate 24h simulation to know peak hour
        const sim24 = this.hourlyEngine.simulate24Hours(space, this.thermalEngine.designConditions);

        document.getElementById('prop-load-summary').innerHTML = `
            <div class="stat-badge">
                <strong>${currentHourLoad.totalCoolingTR} TR</strong> (${currentHourLoad.totalCoolingBTUh.toLocaleString()} BTU/h)
                <span class="stat-hour">às ${this.currentHour}:00h</span>
            </div>
            <div class="stat-sub">
                ${space.area || 30} m² | <strong>Pico da Sala: ${sim24.peakHour}:00h</strong> (${sim24.peakLoadTR.toFixed(2)} TR)
            </div>
            <div class="stat-sub">
                Solar: ${(currentHourLoad.solarGainW / 1000).toFixed(2)} kW | Interna: ${(currentHourLoad.internalSensibleW / 1000).toFixed(2)} kW
            </div>
        `;

        // Render Walls and Window dimensions list
        const wallsContainer = document.getElementById('prop-walls-container');
        if (wallsContainer) {
            if (!space.walls || space.walls.length === 0) {
                wallsContainer.innerHTML = '<p class="empty-hint">Nenhuma parede gerada.</p>';
            } else {
                wallsContainer.innerHTML = '';
                space.walls.forEach((wall, idx) => {
                    const grossArea = wall.length * (space.height || 3.0);
                    const isOutdoor = wall.boundaryCondition === 'OutdoorAir';
                    const winW = wall.windowWidth !== undefined ? wall.windowWidth : Math.min(Math.round(wall.length * 0.5 * 10) / 10, 2.0);
                    const winH = wall.windowHeight !== undefined ? wall.windowHeight : Math.min(Math.round((space.height || 3.0) * 0.5 * 10) / 10, 1.4);
                    const winArea = wall.hasWindow ? Math.min(grossArea * 0.85, winW * winH) : 0;
                    const wwr = wall.hasWindow ? ((winArea / grossArea) * 100).toFixed(0) : 0;

                    const card = document.createElement('div');
                    card.className = 'wall-card';
                    card.innerHTML = `
                        <div class="wall-card-header">
                            <span class="wall-card-title">Parede ${idx + 1} (${wall.length.toFixed(1)}m)</span>
                            <span class="wall-card-orientation">${wall.orientation ? wall.orientation.name : 'N'} (${isOutdoor ? 'Externa' : 'Divisória'})</span>
                        </div>
                        <div class="wall-window-config">
                            <label class="window-toggle-label">
                                <input type="checkbox" class="wall-has-window-chk" data-wall="${idx}" ${wall.hasWindow ? 'checked' : ''}>
                                <span>🪟 Possui Janela</span>
                            </label>
                            <div class="window-dims-row" style="display: ${wall.hasWindow ? 'flex' : 'none'};" id="wall-dims-row-${idx}">
                                <div class="window-dim-item">
                                    <label>Larg (m):</label>
                                    <input type="number" step="0.1" min="0.3" max="${wall.length.toFixed(1)}" value="${winW.toFixed(1)}" class="wall-win-w" data-wall="${idx}">
                                </div>
                                <div class="window-dim-item">
                                    <label>Alt (m):</label>
                                    <input type="number" step="0.1" min="0.3" max="${(space.height || 3.0).toFixed(1)}" value="${winH.toFixed(1)}" class="wall-win-h" data-wall="${idx}">
                                </div>
                            </div>
                            <div class="window-area-badge" style="display: ${wall.hasWindow ? 'block' : 'none'};" id="wall-area-badge-${idx}">
                                Área da Janela: ${winArea.toFixed(2)} m² (${wwr}% WWR)
                            </div>
                        </div>
                    `;
                    wallsContainer.appendChild(card);
                });

                // Checkbox toggle window
                wallsContainer.querySelectorAll('.wall-has-window-chk').forEach(chk => {
                    chk.addEventListener('change', (e) => {
                        const wallIdx = parseInt(e.target.dataset.wall, 10);
                        const wall = space.walls[wallIdx];
                        wall.hasWindow = e.target.checked;
                        if (wall.hasWindow) {
                            if (wall.windowWidth === undefined) wall.windowWidth = Math.min(Math.round(wall.length * 0.5 * 10) / 10, 2.0);
                            if (wall.windowHeight === undefined) wall.windowHeight = Math.min(Math.round((space.height || 3.0) * 0.5 * 10) / 10, 1.4);
                        }
                        this.cadCanvas.triggerChanged();
                        this.populatePropertyPanel(space);
                    });
                });

                // Window Width input
                wallsContainer.querySelectorAll('.wall-win-w').forEach(inp => {
                    inp.addEventListener('input', (e) => {
                        const wallIdx = parseInt(e.target.dataset.wall, 10);
                        const val = parseFloat(e.target.value) || 0.5;
                        space.walls[wallIdx].windowWidth = Math.max(0.2, val);
                        this.cadCanvas.triggerChanged();
                        const grossArea = space.walls[wallIdx].length * (space.height || 3.0);
                        const h = space.walls[wallIdx].windowHeight || 1.4;
                        const area = Math.min(grossArea * 0.85, val * h);
                        const badge = document.getElementById(`wall-area-badge-${wallIdx}`);
                        if (badge) badge.textContent = `Área da Janela: ${area.toFixed(2)} m² (${((area / grossArea) * 100).toFixed(0)}% WWR)`;
                    });
                });

                // Window Height input
                wallsContainer.querySelectorAll('.wall-win-h').forEach(inp => {
                    inp.addEventListener('input', (e) => {
                        const wallIdx = parseInt(e.target.dataset.wall, 10);
                        const val = parseFloat(e.target.value) || 0.5;
                        space.walls[wallIdx].windowHeight = Math.max(0.2, val);
                        this.cadCanvas.triggerChanged();
                        const grossArea = space.walls[wallIdx].length * (space.height || 3.0);
                        const w = space.walls[wallIdx].windowWidth || 1.8;
                        const area = Math.min(grossArea * 0.85, w * val);
                        const badge = document.getElementById(`wall-area-badge-${wallIdx}`);
                        if (badge) badge.textContent = `Área da Janela: ${area.toFixed(2)} m² (${((area / grossArea) * 100).toFixed(0)}% WWR)`;
                    });
                });
            }
        }
    }

    updateCalculations() {
        let currentTotalCoolingW = 0;
        let currentSensibleW = 0;
        let currentLatentW = 0;
        let totalAreaM2 = 0;

        // 24-hour building block load array to find Coincident Peak Hour
        const buildingHourlyTotals = new Array(24).fill(0);
        let sumOfNonCoincidentPeaksW = 0;

        this.spaces.forEach(space => {
            const area = space.area || ThermalEngine.calculatePolygonArea(space.polygon);
            totalAreaM2 += area;

            const sim = this.hourlyEngine.simulate24Hours(space, this.thermalEngine.designConditions);
            sumOfNonCoincidentPeaksW += sim.peakLoadW;

            for (let h = 0; h < 24; h++) {
                buildingHourlyTotals[h] += sim.hourlyData[h].totalCoolingW;
            }

            // Current hour instantaneous load
            const curH = sim.hourlyData[this.currentHour];
            currentTotalCoolingW += curH.totalCoolingW;
            currentSensibleW += curH.sensibleW;
            currentLatentW += curH.latentW;
        });

        // Find Building Coincident Peak Hour
        let buildingPeakHour = 0;
        let buildingPeakLoadW = 0;
        for (let h = 0; h < 24; h++) {
            if (buildingHourlyTotals[h] > buildingPeakLoadW) {
                buildingPeakLoadW = buildingHourlyTotals[h];
                buildingPeakHour = h;
            }
        }

        const diversitySavingsPct = sumOfNonCoincidentPeaksW > 0 
            ? ((1 - (buildingPeakLoadW / sumOfNonCoincidentPeaksW)) * 100)
            : 0;

        const currentCoolingBTUh = currentTotalCoolingW * 3.412142;
        const currentCoolingTR = currentCoolingBTUh / 12000.0;
        const currentCFM = (currentSensibleW * 3.412142) / (1.08 * (11.0 * 1.8));

        document.getElementById('total-cooling-tr').textContent = `${currentCoolingTR.toFixed(2)} TR`;
        document.getElementById('total-cooling-btu').textContent = `${Math.round(currentCoolingBTUh).toLocaleString()} BTU/h (${(currentTotalCoolingW / 1000).toFixed(1)} kW)`;
        document.getElementById('total-sensible-latent').textContent = `Sensível: ${(currentSensibleW / 1000).toFixed(1)} kW | Latent: ${(currentLatentW / 1000).toFixed(1)} kW`;
        document.getElementById('total-airflow-cfm').textContent = `${Math.round(currentCFM).toLocaleString()} CFM`;
        document.getElementById('total-area-m2').textContent = `${totalAreaM2.toFixed(1)} m²`;

        // Update Coincident Peak diversity badge if element exists
        const peakBadge = document.getElementById('building-peak-badge');
        if (peakBadge) {
            const peakTR = (buildingPeakLoadW * 3.412142) / 12000.0;
            peakBadge.innerHTML = `<strong>Pico do Prédio: ${buildingPeakHour}:00h (${peakTR.toFixed(2)} TR)</strong> &bull; Economia por diversidade horária: <strong>${diversitySavingsPct.toFixed(1)}%</strong>`;
        }

        this.buildingHourlyTotals = buildingHourlyTotals;
        this.buildingPeakHour = buildingPeakHour;
    }

    renderSpaceList() {
        const listElem = document.getElementById('space-list');
        const filterResult = this.searchEngine.filterSpaces(this.spaces);

        document.getElementById('search-count-label').textContent = filterResult.countString;

        listElem.innerHTML = '';
        filterResult.items.forEach(space => {
            const itemElem = document.createElement('div');
            itemElem.className = 'space-item' + (space.id === this.cadCanvas.selectedSpaceId ? ' selected' : '');

            // Get hourly load at current hour
            const curLoad = this.hourlyEngine.calculateSpaceHour(space, this.currentHour, this.thermalEngine.designConditions);
            const sim = this.hourlyEngine.simulate24Hours(space, this.thermalEngine.designConditions);

            itemElem.innerHTML = `
                <div class="space-item-header">
                    <span class="space-item-name">${space.name}</span>
                    <span class="space-item-load">${curLoad.totalCoolingTR} TR</span>
                </div>
                <div class="space-item-meta">
                    <span>${space.area || 30} m²</span> &bull; <span>${space.zone || 'No Zone'}</span> &bull; 
                    <span class="peak-pill" title="Hora de Pico desta Sala">Pico: ${sim.peakHour}h</span>
                </div>
            `;

            itemElem.addEventListener('click', () => {
                this.cadCanvas.selectedSpaceId = space.id;
                this.cadCanvas.render();
                this.populatePropertyPanel(space);
                this.renderSpaceList();
                this.renderHourlyChart();
            });

            listElem.appendChild(itemElem);
        });
    }

    renderHourlyChart() {
        const chartContainer = document.getElementById('hourly-chart-container');
        if (!chartContainer) return;

        const selSpace = this.spaces.find(s => s.id === this.cadCanvas.selectedSpaceId);
        let hourlyValues = [];
        let title = '';

        if (selSpace) {
            const sim = this.hourlyEngine.simulate24Hours(selSpace, this.thermalEngine.designConditions);
            hourlyValues = sim.hourlyData.map(d => d.totalCoolingTR);
            title = `${selSpace.name} (Pico: ${sim.peakHour}:00h - ${sim.peakLoadTR.toFixed(2)} TR)`;
        } else {
            // Whole building
            if (!this.buildingHourlyTotals) this.updateCalculations();
            hourlyValues = this.buildingHourlyTotals.map(w => (w * 3.412142) / 12000.0);
            title = `Prédio Total (Pico Coincidente: ${this.buildingPeakHour}:00h)`;
        }

        const maxVal = Math.max(...hourlyValues, 1.0) * 1.15;
        const width = 600;
        const height = 120;
        const padX = 35;
        const padY = 20;

        const pts = hourlyValues.map((val, idx) => {
            const x = padX + (idx / 23) * (width - padX - 15);
            const y = height - padY - (val / maxVal) * (height - padY * 2);
            return `${x},${y}`;
        }).join(' ');

        // Current hour marker X coordinate
        const curX = padX + (this.currentHour / 23) * (width - padX - 15);

        chartContainer.innerHTML = `
            <div class="chart-header">
                <span class="chart-title">Curva Horária 24h: <strong>${title}</strong></span>
                <span class="chart-legend">
                    <span class="dot" style="background:#58a6ff"></span> Carga Térmica (TR)
                    <span class="dot" style="background:#e3b341; margin-left:8px;"></span> Hora Atual (${this.currentHour}h)
                </span>
            </div>
            <svg class="chart-svg" viewBox="0 0 ${width} ${height}">
                <!-- Grid Lines -->
                <line x1="${padX}" y1="${height - padY}" x2="${width - 15}" y2="${height - padY}" stroke="#30363d" stroke-width="1"/>
                <line x1="${padX}" y1="${padY}" x2="${width - 15}" y2="${padY}" stroke="#21262d" stroke-dasharray="2,2"/>
                
                <!-- Y Axis Labels -->
                <text x="${padX - 5}" y="${padY + 4}" fill="#8b949e" font-size="9" text-anchor="end">${maxVal.toFixed(1)} TR</text>
                <text x="${padX - 5}" y="${height - padY}" fill="#8b949e" font-size="9" text-anchor="end">0 TR</text>

                <!-- 24h Area Fill and Line -->
                <polyline fill="rgba(88, 166, 255, 0.15)" stroke="none" points="${padX},${height - padY} ${pts} ${width - 15},${height - padY}"/>
                <polyline fill="none" stroke="#58a6ff" stroke-width="2.5" points="${pts}"/>

                <!-- Current Hour Vertical Indicator Line -->
                <line x1="${curX}" y1="${padY}" x2="${curX}" y2="${height - padY}" stroke="#e3b341" stroke-width="2" stroke-dasharray="3,3"/>
                <circle cx="${curX}" cy="${height - padY - (hourlyValues[this.currentHour] / maxVal) * (height - padY * 2)}" r="4.5" fill="#e3b341" stroke="#ffffff" stroke-width="1.5"/>

                <!-- X Axis Hour Labels -->
                ${[0, 6, 12, 18, 23].map(h => {
                    const x = padX + (h / 23) * (width - padX - 15);
                    return `<text x="${x}" y="${height - 5}" fill="#8b949e" font-size="9" text-anchor="middle">${h}h</text>`;
                }).join('')}
            </svg>
        `;
    }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    window.kapi = new KapiApp();
});

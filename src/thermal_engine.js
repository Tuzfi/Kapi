/**
 * Kapi Thermal Load Calculation Engine
 * Clean-room implementation of ASHRAE Standard 183 / 90.1 / 62.1 & Carrier HAP 6.4 Heat Balance equations
 */

export const ORIENTATIONS = {
    NORTH: { name: 'North', angle: 0, solarFactor: 0.5 },
    NORTHEAST: { name: 'Northeast', angle: 45, solarFactor: 0.8 },
    EAST: { name: 'East', angle: 90, solarFactor: 1.0 },
    SOUTHEAST: { name: 'Southeast', angle: 135, solarFactor: 0.9 },
    SOUTH: { name: 'South', angle: 180, solarFactor: 0.75 },
    SOUTHWEST: { name: 'Southwest', angle: 225, solarFactor: 0.9 },
    WEST: { name: 'West', angle: 270, solarFactor: 1.0 },
    NORTHWEST: { name: 'Northwest', angle: 315, solarFactor: 0.8 }
};

export const BOUNDARY_CONDITIONS = {
    OUTDOOR: 'OutdoorAir',
    INTERNAL_PARTITION: 'ModeledOtherSide',
    SLAB_ON_GRADE: 'AtGrade',
    ADIABATIC: 'Adiabatic'
};

export class ThermalEngine {
    constructor() {
        this.buildingRotation = 0; // Degrees (0° to 359°): 0 = North Up, 90 = North East, etc.
        // Global Design Conditions (Defaults typical for sub-tropical / temperate climate)
        this.designConditions = {
            // Summer Cooling Design
            summerOutdoorDB: 35.0,  // °C Dry Bulb
            summerOutdoorWB: 24.0,  // °C Wet Bulb
            summerIndoorDB: 24.0,   // °C Dry Bulb target
            summerIndoorRH: 50.0,   // % Relative Humidity
            supplyAirTemp: 13.0,    // °C Air handler supply temperature

            // Winter Heating Design
            winterOutdoorDB: 5.0,   // °C
            winterIndoorDB: 21.0,   // °C

            // Solar peak irradiance (W/m²)
            peakSolarRadiation: 650.0
        };
    }

    /**
     * Compute polygon area in square meters (assuming 1 unit = 1 meter or scaled)
     */
    static calculatePolygonArea(points) {
        if (!points || points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2.0;
    }

    /**
     * Calculate wall orientation (azimuth) based on 2D segment normal vector,
     * adjusted by building rotation angle.
     */
    static getSegmentOrientation(p1, p2, buildingRotation = 0) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        // Outward normal in 2D (assuming clockwise winding: nx = dy, ny = -dx)
        let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);
        if (angleDeg < 0) angleDeg += 360;

        // Apply building rotation
        angleDeg = (angleDeg + buildingRotation) % 360;
        if (angleDeg < 0) angleDeg += 360;

        if (angleDeg >= 337.5 || angleDeg < 22.5) return ORIENTATIONS.NORTH;
        if (angleDeg >= 22.5 && angleDeg < 67.5) return ORIENTATIONS.NORTHEAST;
        if (angleDeg >= 67.5 && angleDeg < 112.5) return ORIENTATIONS.EAST;
        if (angleDeg >= 112.5 && angleDeg < 157.5) return ORIENTATIONS.SOUTHEAST;
        if (angleDeg >= 157.5 && angleDeg < 202.5) return ORIENTATIONS.SOUTH;
        if (angleDeg >= 202.5 && angleDeg < 247.5) return ORIENTATIONS.SOUTHWEST;
        if (angleDeg >= 247.5 && angleDeg < 292.5) return ORIENTATIONS.WEST;
        return ORIENTATIONS.NORTHWEST;
    }

    /**
     * Calculate Cooling & Heating Loads for a space/zone
     */
    calculateSpaceThermalLoad(space) {
        const cond = this.designConditions;
        const deltaTCooling = Math.max(0, cond.summerOutdoorDB - cond.summerIndoorDB);
        const deltaTHeating = Math.max(0, cond.winterIndoorDB - cond.winterOutdoorDB);

        // 1. Geometry properties
        const floorArea = space.area || ThermalEngine.calculatePolygonArea(space.polygon); // m²
        const ceilingHeight = space.height || 3.0; // m
        const volume = floorArea * ceilingHeight; // m³

        // 2. Envelope Loads (Conduction + Solar)
        let wallSensibleCooling = 0;
        let wallHeatingLoss = 0;
        let windowSensibleCooling = 0;
        let windowHeatingLoss = 0;
        let solarWindowGain = 0;

        const wallDetails = [];

        if (space.walls && space.walls.length > 0) {
            space.walls.forEach((wall, idx) => {
                const wallLength = wall.length || Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
                const grossWallArea = wallLength * ceilingHeight;
                let windowArea = 0;
                let winW = wall.windowWidth !== undefined ? wall.windowWidth : (wall.hasWindow ? Math.min(wallLength * 0.5, 1.8) : 0);
                let winH = wall.windowHeight !== undefined ? wall.windowHeight : (wall.hasWindow ? Math.min(ceilingHeight * 0.6, 1.4) : 0);
                if (wall.hasWindow) {
                    if (wall.windowWidth !== undefined && wall.windowHeight !== undefined) {
                        windowArea = Math.min(grossWallArea * 0.85, Math.max(0.1, wall.windowWidth * wall.windowHeight));
                    } else if (wall.windowArea) {
                        windowArea = Math.min(grossWallArea * 0.85, wall.windowArea);
                    } else {
                        windowArea = Math.min(grossWallArea * 0.85, winW * winH);
                    }
                }
                const netWallArea = Math.max(0, grossWallArea - windowArea);
                const orientation = ThermalEngine.getSegmentOrientation(wall.p1, wall.p2, this.buildingRotation);

                const uWall = wall.uValue || (wall.boundaryCondition === BOUNDARY_CONDITIONS.INTERNAL_PARTITION ? 1.8 : 0.45); // W/m²K
                const uWindow = wall.windowUValue || 2.4; // Double glazed
                const shgc = wall.windowSHGC || 0.40;

                let qWallCooling = 0;
                let qWallHeating = 0;
                let qWinCooling = 0;
                let qWinHeating = 0;
                let qSolar = 0;

                if (wall.boundaryCondition === BOUNDARY_CONDITIONS.OUTDOOR) {
                    // Exterior Wall Conduction
                    qWallCooling = netWallArea * uWall * deltaTCooling;
                    qWallHeating = netWallArea * uWall * deltaTHeating;

                    // Window Conduction
                    qWinCooling = windowArea * uWindow * deltaTCooling;
                    qWinHeating = windowArea * uWindow * deltaTHeating;

                    // Solar Heat Gain through Fenestration
                    qSolar = windowArea * shgc * cond.peakSolarRadiation * orientation.solarFactor;
                } else if (wall.boundaryCondition === BOUNDARY_CONDITIONS.INTERNAL_PARTITION) {
                    // Partition to adjacent non-conditioned or buffer space (typical deltaT ~ 3K)
                    qWallCooling = netWallArea * uWall * 3.0;
                    qWallHeating = netWallArea * uWall * 3.0;
                }

                wallSensibleCooling += qWallCooling;
                wallHeatingLoss += qWallHeating;
                windowSensibleCooling += qWinCooling;
                windowHeatingLoss += qWinHeating;
                solarWindowGain += qSolar;

                wallDetails.push({
                    index: idx,
                    orientation: orientation.name,
                    length: wallLength,
                    grossArea: grossWallArea,
                    hasWindow: wall.hasWindow,
                    windowWidth: winW,
                    windowHeight: winH,
                    windowArea: windowArea,
                    boundary: wall.boundaryCondition,
                    wallCoolingWatts: qWallCooling,
                    windowCoolingWatts: qWinCooling,
                    solarWatts: qSolar
                });
            });
        }

        // Roof and Floor
        const roofArea = space.isTopFloor ? floorArea : 0;
        const uRoof = space.uRoof || 0.35;
        const roofCooling = roofArea * uRoof * (deltaTCooling + 8.0); // Solar sol-air temperature effect
        const roofHeating = roofArea * uRoof * deltaTHeating;

        const floorAreaGround = space.isGroundFloor ? floorArea : 0;
        const uFloor = space.uFloor || 0.50;
        const floorCooling = 0; // Ground provides passive cooling or neutral in summer
        const floorHeating = floorAreaGround * uFloor * (deltaTHeating * 0.5);

        const totalEnvelopeCooling = wallSensibleCooling + windowSensibleCooling + solarWindowGain + roofCooling;
        const totalEnvelopeHeating = wallHeatingLoss + windowHeatingLoss + roofHeating + floorHeating;

        // 3. Internal Loads (Occupancy, Lighting, Equipment)
        const occupants = space.occupants !== undefined ? space.occupants : Math.round(floorArea / 10.0); // 10 m² / person
        const occupantSensibleRate = 75.0; // W/person (seated, light work - ASHRAE)
        const occupantLatentRate = 55.0;   // W/person

        const peopleSensibleCooling = occupants * occupantSensibleRate;
        const peopleLatentCooling = occupants * occupantLatentRate;

        const lightingWpM2 = space.lightingDensity || 10.0; // 10 W/m² (LED standard)
        const lightingSensibleCooling = floorArea * lightingWpM2;

        const equipmentWpM2 = space.equipmentDensity || 15.0; // 15 W/m² (computers/monitors)
        const equipmentSensibleCooling = floorArea * equipmentWpM2;

        const totalInternalSensible = peopleSensibleCooling + lightingSensibleCooling + equipmentSensibleCooling;
        const totalInternalLatent = peopleLatentCooling;

        // 4. Ventilation & Infiltration (Outdoor Air per ASHRAE 62.1)
        // 5 L/s per person + 0.6 L/s per m² floor area
        const ventLitresPerSec = (occupants * 5.0) + (floorArea * 0.6);
        const ventM3h = ventLitresPerSec * 3.6; // m³/h
        const ventCFM = ventLitresPerSec * 2.11888; // CFM

        // Air density * Cp = 1.2 kg/m³ * 1005 J/kg K = 1206 J/m³ K = 0.335 Wh/m³ K
        const ventSensibleCooling = (ventM3h / 3600) * 1206 * deltaTCooling;
        // Latent ventilation: 3.0 kW per 1000 CFM at design summer humidity
        const ventLatentCooling = ventCFM * 2.8;

        const ventHeatingLoss = (ventM3h / 3600) * 1206 * deltaTHeating;

        // 5. Total Sensible & Latent Capacities
        const grandSensibleCooling = totalEnvelopeCooling + totalInternalSensible + ventSensibleCooling;
        const grandLatentCooling = totalInternalLatent + ventLatentCooling;
        const grandTotalCooling = grandSensibleCooling + grandLatentCooling;

        // Heating Load (ASHRAE safety: no internal gains, no solar gain credit)
        const grandTotalHeating = totalEnvelopeHeating + ventHeatingLoss;

        // 6. Conversions & Airflow Sizing
        const totalCoolingBTUh = grandTotalCooling * 3.412142;
        const totalCoolingTons = totalCoolingBTUh / 12000.0; // Refrigeration tons (TR)
        const totalCoolingKW = grandTotalCooling / 1000.0;

        const totalHeatingBTUh = grandTotalHeating * 3.412142;
        const totalHeatingKW = grandTotalHeating / 1000.0;

        // Supply airflow to offset sensible heat: CFM = Q_sensible / (1.08 * deltaT_supply)
        const deltaTSupply = Math.max(5.0, cond.summerIndoorDB - cond.supplyAirTemp);
        const sensibleBTUh = grandSensibleCooling * 3.412142;
        const requiredSupplyCFM = sensibleBTUh / (1.08 * (deltaTSupply * 1.8)); // 1.8 for delta deg F
        const requiredSupplyM3h = requiredSupplyCFM * 1.69901;

        // Heat load density
        const wattsPerM2 = floorArea > 0 ? grandTotalCooling / floorArea : 0;
        const btuhPerSqFt = floorArea > 0 ? totalCoolingBTUh / (floorArea * 10.7639) : 0;

        return {
            spaceId: space.id,
            spaceName: space.name,
            geometry: {
                areaM2: Number(floorArea.toFixed(2)),
                areaSqFt: Number((floorArea * 10.7639).toFixed(2)),
                heightM: ceilingHeight,
                volumeM3: Number(volume.toFixed(2))
            },
            loads: {
                envelope: {
                    wallsCoolingW: Number(wallSensibleCooling.toFixed(1)),
                    windowsCoolingW: Number(windowSensibleCooling.toFixed(1)),
                    solarCoolingW: Number(solarWindowGain.toFixed(1)),
                    roofCoolingW: Number(roofCooling.toFixed(1)),
                    totalEnvelopeCoolingW: Number(totalEnvelopeCooling.toFixed(1)),
                    heatingLossW: Number(totalEnvelopeHeating.toFixed(1))
                },
                internal: {
                    peopleSensibleW: Number(peopleSensibleCooling.toFixed(1)),
                    peopleLatentW: Number(peopleLatentCooling.toFixed(1)),
                    lightingW: Number(lightingSensibleCooling.toFixed(1)),
                    equipmentW: Number(equipmentSensibleCooling.toFixed(1)),
                    totalInternalSensibleW: Number(totalInternalSensible.toFixed(1)),
                    totalInternalLatentW: Number(totalInternalLatent.toFixed(1))
                },
                ventilation: {
                    litresPerSec: Number(ventLitresPerSec.toFixed(1)),
                    cfm: Number(ventCFM.toFixed(1)),
                    m3h: Number(ventM3h.toFixed(1)),
                    sensibleCoolingW: Number(ventSensibleCooling.toFixed(1)),
                    latentCoolingW: Number(ventLatentCooling.toFixed(1)),
                    heatingLossW: Number(ventHeatingLoss.toFixed(1))
                },
                totals: {
                    sensibleCoolingW: Number(grandSensibleCooling.toFixed(1)),
                    latentCoolingW: Number(grandLatentCooling.toFixed(1)),
                    grandTotalCoolingW: Number(grandTotalCooling.toFixed(1)),
                    coolingKW: Number(totalCoolingKW.toFixed(2)),
                    coolingBTUh: Number(totalCoolingBTUh.toFixed(0)),
                    coolingTons: Number(totalCoolingTons.toFixed(2)),
                    heatingLossW: Number(grandTotalHeating.toFixed(1)),
                    heatingKW: Number(totalHeatingKW.toFixed(2)),
                    heatingBTUh: Number(totalHeatingBTUh.toFixed(0)),
                    supplyAirflowCFM: Number(requiredSupplyCFM.toFixed(0)),
                    supplyAirflowM3h: Number(requiredSupplyM3h.toFixed(0)),
                    loadDensityWpM2: Number(wattsPerM2.toFixed(1)),
                    loadDensityBTUhpSqFt: Number(btuhPerSqFt.toFixed(1))
                }
            },
            wallDetails: wallDetails
        };
    }
}

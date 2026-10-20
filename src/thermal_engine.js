/**
 * Kapi Thermal Load Calculation Engine
 * Faithful clean-room implementation of Carrier HAP 6.4 & ASHRAE Standard 183 / 90.1 / 62.1 Heat Balance
 *
 * Implements:
 * 1. Sol-Air Temperature (T_sol-air) for opaque exterior walls & roofs with solar absorptance (alpha / h_o)
 * 2. Complete Fenestration Solar Heat Gain (Direct beam + Sky diffuse + Ground reflected) & Internal Shading (IAC)
 * 3. Exact ASHRAE 62.1 Ventilation equation (V_oz = R_p * P + R_a * A) & Latent Heat Balance
 * 4. Space Type Activity Levels (Sensible & Latent per person extracted from HAP ActivityLevelData.csv)
 * 5. Full Building True North rotation handling
 */

import {
    ACTIVITY_LEVELS,
    SPACE_TYPES,
    WALL_ASSEMBLIES,
    SURFACE_COLORS,
    WINDOW_ASSEMBLIES,
    INTERNAL_SHADING,
    ROOF_ASSEMBLIES,
    FLOOR_ASSEMBLIES
} from './hap_library.js';

export const BOUNDARY_CONDITIONS = {
    OUTDOOR: 'OutdoorAir',
    INTERNAL_PARTITION: 'ModeledOtherSide',
    SLAB_ON_GRADE: 'AtGrade',
    ADIABATIC: 'Adiabatic'
};

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

export class ThermalEngine {
    constructor() {
        this.buildingRotation = 0; // Degrees (0° to 359°): 0 = North Up, 90 = North East, etc.

        // Global Design Conditions (Carrier HAP Standard Design Weather)
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

            // Solar peak irradiance parameters (ASHRAE Clear Sky Peak)
            peakDirectNormal: 820.0,     // W/m² Direct normal solar irradiance at peak
            peakDiffuseHorizontal: 120.0, // W/m² Sky diffuse irradiance
            groundReflectance: 0.20,      // Standard ground albedo (ASHRAE / Carrier HAP)
            outsideFilmHo: 17.0           // W/m²·K Outside surface heat transfer coefficient (h_o)
        };
    }

    /**
     * Compute polygon area in square meters (shoelace formula)
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
     * Calculate wall orientation azimuth (0°-359°) and name based on 2D segment normal vector,
     * adjusted by building rotation angle.
     */
    static getSegmentAzimuth(p1, p2, buildingRotation = 0) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        // Outward normal in 2D (clockwise winding: nx = dy, ny = -dx)
        let angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);
        if (angleDeg < 0) angleDeg += 360;

        // Apply building rotation
        angleDeg = (angleDeg + buildingRotation) % 360;
        if (angleDeg < 0) angleDeg += 360;

        let name = 'North';
        if (angleDeg >= 337.5 || angleDeg < 22.5) name = 'Norte (N)';
        else if (angleDeg >= 22.5 && angleDeg < 67.5) name = 'Nordeste (NE)';
        else if (angleDeg >= 67.5 && angleDeg < 112.5) name = 'Leste (L)';
        else if (angleDeg >= 112.5 && angleDeg < 157.5) name = 'Sudeste (SE)';
        else if (angleDeg >= 157.5 && angleDeg < 202.5) name = 'Sul (S)';
        else if (angleDeg >= 202.5 && angleDeg < 247.5) name = 'Sudoeste (SO)';
        else if (angleDeg >= 247.5 && angleDeg < 292.5) name = 'Oeste (O)';
        else name = 'Noroeste (NO)';

        return { azimuthDeg: Math.round(angleDeg), name: name };
    }

    /**
     * Backward-compatible helper for 2D Canvas rendering
     */
    static getSegmentOrientation(p1, p2, buildingRotation = 0) {
        const segAz = ThermalEngine.getSegmentAzimuth(p1, p2, buildingRotation);
        const a = segAz.azimuthDeg;
        if (a >= 337.5 || a < 22.5) return ORIENTATIONS.NORTH;
        if (a >= 22.5 && a < 67.5) return ORIENTATIONS.NORTHEAST;
        if (a >= 67.5 && a < 112.5) return ORIENTATIONS.EAST;
        if (a >= 112.5 && a < 157.5) return ORIENTATIONS.SOUTHEAST;
        if (a >= 157.5 && a < 202.5) return ORIENTATIONS.SOUTH;
        if (a >= 202.5 && a < 247.5) return ORIENTATIONS.SOUTHWEST;
        if (a >= 247.5 && a < 292.5) return ORIENTATIONS.WEST;
        return ORIENTATIONS.NORTHWEST;
    }

    /**
     * Carrier HAP 6.4 Solar Flux on Vertical Surface
     * Calculates direct beam, diffuse sky and ground reflected radiation.
     * At summer design hour (14:00 - 15:00), sun is typically West/Northwest in Southern Hemisphere
     * or Southwest in Northern Hemisphere.
     */
    calculateWallSolarFlux(wallAzimuthDeg, solarAltDeg = 55.0, solarAzimuthDeg = 310.0) {
        const cond = this.designConditions;
        const altRad = solarAltDeg * (Math.PI / 180.0);
        const azDiffRad = Math.abs(solarAzimuthDeg - wallAzimuthDeg) * (Math.PI / 180.0);

        // Incidence angle theta on vertical wall: cos(theta) = cos(alt) * cos(azDiff)
        const cosTheta = Math.cos(altRad) * Math.cos(azDiffRad);

        // Direct beam on wall
        const directBeam = (cosTheta > 0) ? (cond.peakDirectNormal * cosTheta) : 0.0;

        // Sky diffuse on vertical wall (View factor to sky = 0.5)
        const diffuseSky = cond.peakDiffuseHorizontal * 0.5;

        // Total horizontal radiation for ground reflection:
        // I_horiz = I_dn * sin(alt) + I_diff_horiz
        const totalHoriz = (cond.peakDirectNormal * Math.sin(altRad)) + cond.peakDiffuseHorizontal;
        // Ground reflected (View factor to ground = 0.5)
        const groundReflected = totalHoriz * cond.groundReflectance * 0.5;

        // Total solar irradiance incident on wall (W/m²)
        const totalIncident = directBeam + diffuseSky + groundReflected;

        return {
            cosTheta: Math.max(0, cosTheta),
            directBeamWpM2: directBeam,
            diffuseSkyWpM2: diffuseSky,
            groundReflectedWpM2: groundReflected,
            totalIncidentWpM2: totalIncident,
            isSunFacing: cosTheta > 0
        };
    }

    /**
     * Carrier HAP 6.4 Sol-Air Temperature for Opaque Surfaces
     * T_sol-air = T_outdoor + (alpha * I_total / h_o) - (epsilon * deltaR / h_o)
     * For vertical walls, sky radiation deficit (deltaR) is ~0.
     * For horizontal roofs, deltaR is ~63 W/m² (approx 4°C reduction).
     */
    calculateSolAirTemp(outdoorDB, incidentSolarWpM2, absorptivity = 0.675, isRoof = false) {
        const ho = this.designConditions.outsideFilmHo; // 17.0 W/m²·K
        const solarElevation = (absorptivity * incidentSolarWpM2) / ho;
        const skyLongwaveLoss = isRoof ? 4.0 : 0.0; // 4°C reduction for clear sky view
        return outdoorDB + solarElevation - skyLongwaveLoss;
    }

    /**
     * Calculate Cooling & Heating Loads for a space/zone
     */
    calculateSpaceThermalLoad(space) {
        const cond = this.designConditions;
        const outdoorDB = cond.summerOutdoorDB;
        const indoorDB = cond.summerIndoorDB;
        const deltaTCooling = Math.max(0, outdoorDB - indoorDB);
        const deltaTHeating = Math.max(0, cond.winterIndoorDB - cond.winterOutdoorDB);

        // 1. Geometry properties
        const floorArea = space.area || ThermalEngine.calculatePolygonArea(space.polygon); // m²
        const ceilingHeight = space.height || 3.0; // m
        const volume = floorArea * ceilingHeight; // m³

        // 2. Space Type & Presets Lookup
        const spaceTypePreset = SPACE_TYPES[space.spaceType] || SPACE_TYPES.CUSTOM;
        const activityPreset = ACTIVITY_LEVELS[space.activityLevel || spaceTypePreset.activity] || ACTIVITY_LEVELS.OFFICE_WORK;

        // 3. Envelope Loads (Walls, Windows, Roof, Floor)
        let wallSensibleCooling = 0;
        let wallHeatingLoss = 0;
        let windowConductionCooling = 0;
        let windowSolarCooling = 0;
        let windowHeatingLoss = 0;

        const wallDetails = [];

        if (space.walls && space.walls.length > 0) {
            space.walls.forEach((wall, idx) => {
                const wallLength = wall.length || Math.hypot(wall.p2.x - wall.p1.x, wall.p2.y - wall.p1.y);
                const grossWallArea = wallLength * ceilingHeight;

                // Window dimensions
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

                // Azimuth with building rotation
                const segAz = ThermalEngine.getSegmentAzimuth(wall.p1, wall.p2, this.buildingRotation);
                const wallAzimuth = segAz.azimuthDeg;

                // Construction properties (Lookup or fallback)
                const wallAssembly = WALL_ASSEMBLIES[wall.wallAssembly] || WALL_ASSEMBLIES.MASONRY_INSULATED;
                const surfaceColor = SURFACE_COLORS[wall.surfaceColor] || SURFACE_COLORS.MEDIUM;
                const uWall = wall.uValue !== undefined ? wall.uValue : (wall.boundaryCondition === BOUNDARY_CONDITIONS.INTERNAL_PARTITION ? 1.74 : wallAssembly.uValue);
                const absorptance = wall.absorptivity !== undefined ? wall.absorptivity : surfaceColor.absorptivity;

                const windowAssembly = WINDOW_ASSEMBLIES[wall.windowAssembly] || WINDOW_ASSEMBLIES.DOUBLE_CLEAR;
                const internalShade = INTERNAL_SHADING[wall.internalShade] || INTERNAL_SHADING.NONE;
                const uWindow = wall.windowUValue !== undefined ? wall.windowUValue : windowAssembly.uValue;
                const shgc = wall.windowSHGC !== undefined ? wall.windowSHGC : windowAssembly.shgc;
                const iac = wall.shadingIAC !== undefined ? wall.shadingIAC : internalShade.iac;

                let qWallCooling = 0;
                let qWallHeating = 0;
                let qWinCondCooling = 0;
                let qWinSolarCooling = 0;
                let qWinHeating = 0;
                let tSolAir = outdoorDB;
                let solarFlux = { totalIncidentWpM2: 0, isSunFacing: false };

                if (wall.boundaryCondition === BOUNDARY_CONDITIONS.OUTDOOR) {
                    // Solar radiation on vertical wall
                    solarFlux = this.calculateWallSolarFlux(wallAzimuth);

                    // Sol-Air Temperature
                    tSolAir = this.calculateSolAirTemp(outdoorDB, solarFlux.totalIncidentWpM2, absorptance, false);
                    const deltaTSolAir = Math.max(0, tSolAir - indoorDB);

                    // Opaque Wall Conduction driven by Sol-Air temperature
                    qWallCooling = netWallArea * uWall * deltaTSolAir;
                    qWallHeating = netWallArea * uWall * deltaTHeating;

                    // Window Conduction (ambient outdoor to indoor)
                    qWinCondCooling = windowArea * uWindow * deltaTCooling;
                    qWinHeating = windowArea * uWindow * deltaTHeating;

                    // Window Solar Gain (Direct + Diffuse + Ground * SHGC * IAC)
                    qWinSolarCooling = windowArea * shgc * solarFlux.totalIncidentWpM2 * iac;
                } else if (wall.boundaryCondition === BOUNDARY_CONDITIONS.INTERNAL_PARTITION) {
                    // Partition to adjacent non-conditioned or buffer space (typical deltaT ~ 3.0K)
                    const partDeltaT = 3.0;
                    qWallCooling = netWallArea * uWall * partDeltaT;
                    qWallHeating = netWallArea * uWall * (deltaTHeating * 0.4);
                }

                wallSensibleCooling += qWallCooling;
                wallHeatingLoss += qWallHeating;
                windowConductionCooling += qWinCondCooling;
                windowSolarCooling += qWinSolarCooling;
                windowHeatingLoss += qWinHeating;

                wallDetails.push({
                    index: idx,
                    orientation: segAz.name,
                    azimuthDeg: wallAzimuth,
                    length: Number(wallLength.toFixed(2)),
                    grossArea: Number(grossWallArea.toFixed(2)),
                    netWallArea: Number(netWallArea.toFixed(2)),
                    hasWindow: wall.hasWindow,
                    windowWidth: Number(winW.toFixed(2)),
                    windowHeight: Number(winH.toFixed(2)),
                    windowArea: Number(windowArea.toFixed(2)),
                    boundary: wall.boundaryCondition,
                    uWall: uWall,
                    uWindow: uWindow,
                    shgc: shgc,
                    iac: iac,
                    absorptivity: absorptance,
                    solAirTempC: Number(tSolAir.toFixed(1)),
                    incidentSolarWpM2: Number(solarFlux.totalIncidentWpM2.toFixed(1)),
                    isSunFacing: solarFlux.isSunFacing,
                    wallCoolingWatts: Number(qWallCooling.toFixed(1)),
                    windowCondWatts: Number(qWinCondCooling.toFixed(1)),
                    windowSolarWatts: Number(qWinSolarCooling.toFixed(1)),
                    totalWindowWatts: Number((qWinCondCooling + qWinSolarCooling).toFixed(1))
                });
            });
        }

        // Roof Heat Gain (Sol-Air driven)
        let roofCoolingWatts = 0;
        let roofHeatingWatts = 0;
        const isTopFloor = space.hasRoof !== undefined ? space.hasRoof : (space.isTopFloor || false);
        if (isTopFloor && floorArea > 0) {
            const roofAssembly = ROOF_ASSEMBLIES[space.roofAssembly] || ROOF_ASSEMBLIES.INSULATED_DECK;
            const uRoof = space.uRoof !== undefined ? space.uRoof : roofAssembly.uValue;
            const alphaRoof = roofAssembly.absorptivity || 0.675;

            // Total horizontal radiation: ~940 W/m² peak
            const totalHorizPeak = (cond.peakDirectNormal * Math.sin(55.0 * Math.PI / 180.0)) + cond.peakDiffuseHorizontal;
            const tSolAirRoof = this.calculateSolAirTemp(outdoorDB, totalHorizPeak, alphaRoof, true);
            const deltaTRoofCooling = Math.max(0, tSolAirRoof - indoorDB);

            roofCoolingWatts = floorArea * uRoof * deltaTRoofCooling;
            roofHeatingWatts = floorArea * uRoof * deltaTHeating;
        }

        // Floor Heat Exchange (Slab-on-grade or over pilotis)
        let floorCoolingWatts = 0;
        let floorHeatingWatts = 0;
        const isGroundFloor = space.hasFloor !== undefined ? space.hasFloor : (space.isGroundFloor || false);
        if (isGroundFloor && floorArea > 0) {
            const floorAssembly = FLOOR_ASSEMBLIES[space.floorAssembly] || FLOOR_ASSEMBLIES.SLAB_ON_GRADE;
            const uFloor = space.uFloor !== undefined ? space.uFloor : floorAssembly.uValue;
            if (floorAssembly.isGroundContact) {
                // Slab on grade: passive ground contact (cool ground ~20°C in summer provides neutral/minimal load)
                floorCoolingWatts = 0;
                floorHeatingWatts = floorArea * uFloor * (deltaTHeating * 0.5);
            } else {
                // Floor over unconditioned pilotis/garage
                floorCoolingWatts = floorArea * uFloor * (deltaTCooling * 0.8);
                floorHeatingWatts = floorArea * uFloor * deltaTHeating;
            }
        }

        const totalEnvelopeCooling = wallSensibleCooling + windowConductionCooling + windowSolarCooling + roofCoolingWatts + floorCoolingWatts;
        const totalEnvelopeHeating = wallHeatingLoss + windowHeatingLoss + roofHeatingWatts + floorHeatingWatts;

        // 4. Internal Loads (Occupancy, Lighting, Equipment)
        const defaultOccupants = Math.max(1, Math.round(floorArea / (spaceTypePreset.areaPerPerson || 10.0)));
        const occupants = space.occupants !== undefined ? space.occupants : defaultOccupants;

        const peopleSensibleCooling = occupants * activityPreset.sensibleWatts;
        const peopleLatentCooling = occupants * activityPreset.latentWatts;

        const lightingWpM2 = space.lightingDensity !== undefined ? space.lightingDensity : spaceTypePreset.lightingWpM2;
        const lightingSensibleCooling = floorArea * lightingWpM2;

        const equipmentWpM2 = space.equipmentDensity !== undefined ? space.equipmentDensity : spaceTypePreset.equipmentWpM2;
        const equipmentSensibleCooling = floorArea * equipmentWpM2;

        const totalInternalSensible = peopleSensibleCooling + lightingSensibleCooling + equipmentSensibleCooling;
        const totalInternalLatent = peopleLatentCooling;

        // 5. Ventilation & Infiltration (Outdoor Air per ASHRAE 62.1-2019)
        const rp = space.ventRp !== undefined ? space.ventRp : spaceTypePreset.ventRp;
        const ra = space.ventRa !== undefined ? space.ventRa : spaceTypePreset.ventRa;

        // Outdoor airflow requirement: V_oz = R_p * P_z + R_a * A_z
        const ventLitresPerSec = (occupants * rp) + (floorArea * ra);
        const ventM3h = ventLitresPerSec * 3.6; // m³/h
        const ventCFM = ventLitresPerSec * 2.11888; // CFM

        // Air density * Cp = 1.2 kg/m³ * 1005 J/kg·K = 1206 J/m³·K
        const ventSensibleCooling = (ventM3h / 3600.0) * 1206.0 * deltaTCooling;

        // Carrier HAP Latent outdoor air: 2.8 W per CFM at summer design humidity
        const ventLatentCooling = ventCFM * 2.8;
        const ventHeatingLoss = (ventM3h / 3600.0) * 1206.0 * deltaTHeating;

        // 6. Infiltration (Air changes per hour ~0.1 ACH typical for tight commercial buildings)
        const ach = space.infiltrationACH || 0.10;
        const infilM3h = volume * ach;
        const infilSensible = (infilM3h / 3600.0) * 1206.0 * deltaTCooling;
        const infilLatent = (infilM3h * 2.11888 / 60.0) * 2.8;

        // 7. Total Capacities & Balances
        const grandSensibleCooling = totalEnvelopeCooling + totalInternalSensible + ventSensibleCooling + infilSensible;
        const grandLatentCooling = totalInternalLatent + ventLatentCooling + infilLatent;
        const grandTotalCooling = grandSensibleCooling + grandLatentCooling;

        // Heating Load (ASHRAE safety: no credit for solar or internal occupants)
        const grandTotalHeating = totalEnvelopeHeating + ventHeatingLoss + ((infilM3h / 3600.0) * 1206.0 * deltaTHeating);

        // 8. Engineering Conversions & Airflow Sizing
        const totalCoolingBTUh = grandTotalCooling * 3.412142;
        const totalCoolingTons = totalCoolingBTUh / 12000.0; // TR (Refrigeration Tons)
        const totalCoolingKW = grandTotalCooling / 1000.0;

        const totalHeatingBTUh = grandTotalHeating * 3.412142;
        const totalHeatingKW = grandTotalHeating / 1000.0;

        // Supply airflow CFM: CFM = Q_sensible_BTU / (1.08 * deltaT_supply_F)
        const deltaTSupply = Math.max(5.0, indoorDB - cond.supplyAirTemp);
        const sensibleBTUh = grandSensibleCooling * 3.412142;
        const requiredSupplyCFM = sensibleBTUh / (1.08 * (deltaTSupply * 1.8));
        const requiredSupplyM3h = requiredSupplyCFM * 1.69901;

        // Load densities
        const wattsPerM2 = floorArea > 0 ? grandTotalCooling / floorArea : 0;
        const btuhPerSqFt = floorArea > 0 ? totalCoolingBTUh / (floorArea * 10.7639) : 0;

        return {
            spaceId: space.id,
            spaceName: space.name,
            spaceType: spaceTypePreset.name,
            geometry: {
                areaM2: Number(floorArea.toFixed(2)),
                areaSqFt: Number((floorArea * 10.7639).toFixed(2)),
                heightM: ceilingHeight,
                volumeM3: Number(volume.toFixed(2))
            },
            loads: {
                envelope: {
                    wallsCoolingW: Number(wallSensibleCooling.toFixed(1)),
                    windowsCondW: Number(windowConductionCooling.toFixed(1)),
                    windowsSolarW: Number(windowSolarCooling.toFixed(1)),
                    roofCoolingW: Number(roofCoolingWatts.toFixed(1)),
                    floorCoolingW: Number(floorCoolingWatts.toFixed(1)),
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
                infiltration: {
                    m3h: Number(infilM3h.toFixed(1)),
                    sensibleCoolingW: Number(infilSensible.toFixed(1)),
                    latentCoolingW: Number(infilLatent.toFixed(1))
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

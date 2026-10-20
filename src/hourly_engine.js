/**
 * Kapi 24-Hour Dynamic Solar & Schedule Engine
 * Clean-room reconstruction of:
 * - Carrier HAP 6.4 DesignWeatherCalcs.CalcDesignSolar & WeatherCalculations
 * - Carrier HAP 6.4 Sol-Air hourly heat transfer
 * - ASHRAE Clear-Sky Solar & Hourly Profile Schedules
 */

import {
    ACTIVITY_LEVELS,
    SPACE_TYPES,
    WALL_ASSEMBLIES,
    SURFACE_COLORS,
    WINDOW_ASSEMBLIES,
    INTERNAL_SHADING,
    ROOF_ASSEMBLIES
} from './hap_library.js';

export class HourlyEngine {
    constructor(latitude = -23.55) { // Default latitude (e.g. São Paulo / Subtropical -23.55°)
        this.latitude = latitude;
        this.dayOfYear = 21; // January 21st (Summer peak design day for Southern Hemisphere)
        this.buildingRotation = 0; // Degrees (0° to 359°)

        // Default 24h Schedules (Fractions 0.0 to 1.0)
        this.schedules = {
            occupancy: [
                0.0, 0.0, 0.0, 0.0, 0.0, 0.0, // 00h - 05h
                0.1, 0.4, 0.8, 1.0, 1.0, 0.9, // 06h - 11h
                0.6, 0.9, 1.0, 1.0, 0.9, 0.6, // 12h - 17h
                0.2, 0.05, 0.0, 0.0, 0.0, 0.0 // 18h - 23h
            ],
            lighting: [
                0.05, 0.05, 0.05, 0.05, 0.05, 0.1,
                0.3, 0.8, 1.0, 1.0, 1.0, 1.0,
                0.8, 1.0, 1.0, 1.0, 1.0, 0.8,
                0.4, 0.15, 0.05, 0.05, 0.05, 0.05
            ],
            equipment: [
                0.2, 0.2, 0.2, 0.2, 0.2, 0.2,
                0.4, 0.8, 1.0, 1.0, 1.0, 1.0,
                0.8, 1.0, 1.0, 1.0, 1.0, 0.8,
                0.5, 0.3, 0.2, 0.2, 0.2, 0.2
            ]
        };
    }

    /**
     * Compute outdoor dry-bulb temperature for given hour based on daily range
     * ASHRAE standard daily temperature profile
     */
    getHourlyOutdoorTemp(hour, maxOutdoorDB = 35.0, dailyRange = 10.0) {
        const ashraeRangeFraction = [
            0.87, 0.92, 0.96, 0.99, 1.00, 0.98, // 00h - 05h (Coolest around 05h)
            0.93, 0.84, 0.71, 0.56, 0.39, 0.23, // 06h - 11h
            0.11, 0.03, 0.00, 0.03, 0.10, 0.21, // 12h - 17h (Peak warmest at 14h-15h)
            0.34, 0.47, 0.58, 0.68, 0.76, 0.82  // 18h - 23h
        ];
        const fraction = ashraeRangeFraction[hour % 24];
        return maxOutdoorDB - (fraction * dailyRange);
    }

    /**
     * Calculates Solar Position (Altitude beta, Azimuth phi) and Clear Sky Irradiance
     * Carrier HAP DesignWeatherCalcs.CalcDesignSolar
     */
    getSolarPosition(hour) {
        const hourAngleDeg = (hour - 12.0) * 15.0;
        const hourAngleRad = hourAngleDeg * (Math.PI / 180.0);

        // Declination
        const deltaDeg = 23.45 * Math.sin((360.0 / 365.0) * (284 + this.dayOfYear) * (Math.PI / 180.0));
        const deltaRad = deltaDeg * (Math.PI / 180.0);
        const latRad = this.latitude * (Math.PI / 180.0);

        // Solar altitude
        const sinBeta = Math.sin(latRad) * Math.sin(deltaRad) +
                        Math.cos(latRad) * Math.cos(deltaRad) * Math.cos(hourAngleRad);
        const altitudeRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinBeta)));
        const altitudeDeg = altitudeRad * (180.0 / Math.PI);

        if (altitudeDeg <= 0) {
            return {
                isSunUp: false,
                altitudeDeg: 0,
                azimuthDeg: 0,
                directNormalIrradiance: 0,
                diffuseHorizontalIrradiance: 0,
                totalHorizontalIrradiance: 0
            };
        }

        // Solar azimuth
        const cosPhi = (Math.sin(altitudeRad) * Math.sin(latRad) - Math.sin(deltaRad)) /
                       (Math.cos(altitudeRad) * Math.cos(latRad));
        let azimuthRad = Math.acos(Math.max(-1.0, Math.min(1.0, cosPhi)));
        let azimuthDeg = azimuthRad * (180.0 / Math.PI);

        if (hourAngleDeg > 0) {
            azimuthDeg = 360.0 - azimuthDeg;
        }

        // Clear sky direct normal and diffuse
        const A = 1150.0;
        const B = 0.175;
        const C = 0.095;

        const directNormal = Math.max(0, A * Math.exp(-B / Math.max(0.05, Math.sin(altitudeRad))));
        const diffuseHorizontal = C * directNormal;
        const totalHorizontal = (directNormal * Math.sin(altitudeRad)) + diffuseHorizontal;

        return {
            isSunUp: true,
            altitudeDeg: Number(altitudeDeg.toFixed(1)),
            azimuthDeg: Number(azimuthDeg.toFixed(1)),
            directNormalIrradiance: Number(directNormal.toFixed(1)),
            diffuseHorizontalIrradiance: Number(diffuseHorizontal.toFixed(1)),
            totalHorizontalIrradiance: Number(totalHorizontal.toFixed(1))
        };
    }

    /**
     * Determines direct beam, diffuse sky and ground reflected radiation on wall
     */
    getWallSolarIncidence(wallAzimuthDeg, solarPos) {
        if (!solarPos.isSunUp) {
            return {
                cosTheta: 0,
                incidentBeamWatts: 0,
                incidentDiffuseWatts: 0,
                incidentGroundWatts: 0,
                totalIncidentWatts: 0,
                isSunFacing: false
            };
        }

        const altRad = solarPos.altitudeDeg * (Math.PI / 180.0);
        const azDiffDeg = Math.abs(solarPos.azimuthDeg - wallAzimuthDeg);
        const azDiffRad = azDiffDeg * (Math.PI / 180.0);

        const cosTheta = Math.cos(altRad) * Math.cos(azDiffRad);
        const beamWatts = (cosTheta > 0) ? (solarPos.directNormalIrradiance * cosTheta) : 0;
        const diffuseWatts = solarPos.diffuseHorizontalIrradiance * 0.5;
        const groundWatts = solarPos.totalHorizontalIrradiance * 0.20 * 0.5;
        const totalWatts = beamWatts + diffuseWatts + groundWatts;

        return {
            cosTheta: Math.max(0, Number(cosTheta.toFixed(3))),
            incidentBeamWatts: Number(beamWatts.toFixed(1)),
            incidentDiffuseWatts: Number(diffuseWatts.toFixed(1)),
            incidentGroundWatts: Number(groundWatts.toFixed(1)),
            totalIncidentWatts: Number(totalWatts.toFixed(1)),
            isSunFacing: cosTheta > 0
        };
    }

    /**
     * Compute Space Thermal Load for a specific hour of the day with Carrier HAP Sol-Air dynamics
     */
    calculateSpaceHour(space, hour, designConditions) {
        const outdoorDB = this.getHourlyOutdoorTemp(hour, designConditions.summerOutdoorDB);
        const indoorDB = designConditions.summerIndoorDB;
        const deltaT = Math.max(0, outdoorDB - indoorDB);

        const solarPos = this.getSolarPosition(hour);

        // Schedules
        const occFraction = this.schedules.occupancy[hour];
        const lightFraction = this.schedules.lighting[hour];
        const equipFraction = this.schedules.equipment[hour];

        const floorArea = space.area || 30.0;
        const ceilingHeight = space.height || 3.0;

        // Space type & activity
        const spaceTypePreset = SPACE_TYPES[space.spaceType] || SPACE_TYPES.CUSTOM;
        const activityPreset = ACTIVITY_LEVELS[space.activityLevel || spaceTypePreset.activity] || ACTIVITY_LEVELS.OFFICE_WORK;

        // Envelope Transmission & Solar
        let wallCoolingW = 0;
        let windowCoolingW = 0;
        let solarGainW = 0;

        if (space.walls) {
            space.walls.forEach(wall => {
                const wallLength = wall.length || 5.0;
                const grossArea = wallLength * ceilingHeight;
                let winArea = 0;
                let winW = wall.windowWidth !== undefined ? wall.windowWidth : (wall.hasWindow ? Math.min(wallLength * 0.5, 1.8) : 0);
                let winH = wall.windowHeight !== undefined ? wall.windowHeight : (wall.hasWindow ? Math.min(ceilingHeight * 0.6, 1.4) : 0);
                if (wall.hasWindow) {
                    if (wall.windowWidth !== undefined && wall.windowHeight !== undefined) {
                        winArea = Math.min(grossArea * 0.85, Math.max(0.1, wall.windowWidth * wall.windowHeight));
                    } else if (wall.windowArea) {
                        winArea = Math.min(grossArea * 0.85, wall.windowArea);
                    } else {
                        winArea = Math.min(grossArea * 0.85, winW * winH);
                    }
                }
                const netWallArea = Math.max(0, grossArea - winArea);

                if (wall.boundaryCondition === 'OutdoorAir') {
                    const wallAssembly = WALL_ASSEMBLIES[wall.wallAssembly] || WALL_ASSEMBLIES.MASONRY_INSULATED;
                    const surfaceColor = SURFACE_COLORS[wall.surfaceColor] || SURFACE_COLORS.MEDIUM;
                    const uWall = wall.uValue !== undefined ? wall.uValue : wallAssembly.uValue;
                    const alpha = wall.absorptivity !== undefined ? wall.absorptivity : surfaceColor.absorptivity;

                    const windowAssembly = WINDOW_ASSEMBLIES[wall.windowAssembly] || WINDOW_ASSEMBLIES.DOUBLE_CLEAR;
                    const internalShade = INTERNAL_SHADING[wall.internalShade] || INTERNAL_SHADING.NONE;
                    const uWin = wall.windowUValue !== undefined ? wall.windowUValue : windowAssembly.uValue;
                    const shgc = wall.windowSHGC !== undefined ? wall.windowSHGC : windowAssembly.shgc;
                    const iac = wall.shadingIAC !== undefined ? wall.shadingIAC : internalShade.iac;

                    // Base orientation + building rotation
                    const baseAzimuth = wall.orientation ? (wall.orientation.angle || wall.orientation.azimuthDeg || 0) : 0;
                    const wallAzimuth = (baseAzimuth + (this.buildingRotation || 0)) % 360;
                    const solarInc = this.getWallSolarIncidence(wallAzimuth, solarPos);

                    // Sol-Air Temperature
                    const tSolAir = outdoorDB + (alpha * solarInc.totalIncidentWatts / 17.0);
                    const dtWall = Math.max(0, tSolAir - indoorDB);

                    // Wall Conduction
                    wallCoolingW += netWallArea * uWall * dtWall;

                    // Window Conduction
                    windowCoolingW += winArea * uWin * deltaT;

                    // Window Solar Transmission
                    solarGainW += winArea * shgc * solarInc.totalIncidentWatts * iac;
                } else if (wall.boundaryCondition === 'ModeledOtherSide') {
                    const uPart = wall.uValue || 1.74;
                    wallCoolingW += netWallArea * uPart * 2.5; // Buffer space
                }
            });
        }

        // Roof Sol-Air
        let roofCoolingW = 0;
        if (space.hasRoof || space.isTopFloor) {
            const roofAssembly = ROOF_ASSEMBLIES[space.roofAssembly] || ROOF_ASSEMBLIES.INSULATED_DECK;
            const uRoof = space.uRoof || roofAssembly.uValue;
            const alphaRoof = roofAssembly.absorptivity || 0.675;
            const tSolAirRoof = outdoorDB + (alphaRoof * solarPos.totalHorizontalIrradiance / 17.0) - (solarPos.isSunUp ? 4.0 : 0.0);
            const dtRoof = Math.max(0, tSolAirRoof - indoorDB);
            roofCoolingW = floorArea * uRoof * dtRoof;
        }

        // Internal Loads
        const maxOccupants = space.occupants !== undefined ? space.occupants : Math.max(1, Math.round(floorArea / (spaceTypePreset.areaPerPerson || 10.0)));
        const peopleSensible = maxOccupants * occFraction * activityPreset.sensibleWatts;
        const peopleLatent = maxOccupants * occFraction * activityPreset.latentWatts;

        const lpd = space.lightingDensity !== undefined ? space.lightingDensity : spaceTypePreset.lightingWpM2;
        const lightingSensible = floorArea * lpd * lightFraction;

        const epd = space.equipmentDensity !== undefined ? space.equipmentDensity : spaceTypePreset.equipmentWpM2;
        const equipmentSensible = floorArea * epd * equipFraction;

        // Fresh Air Ventilation (ASHRAE 62.1 scaled with occupancy)
        const currentOccupants = maxOccupants * occFraction;
        const rp = space.ventRp !== undefined ? space.ventRp : spaceTypePreset.ventRp;
        const ra = space.ventRa !== undefined ? space.ventRa : spaceTypePreset.ventRa;
        const ventLitresPerSec = (currentOccupants * rp) + (floorArea * ra);
        const ventM3h = ventLitresPerSec * 3.6;
        const ventCFM = ventLitresPerSec * 2.11888;
        const ventSensible = (ventM3h / 3600.0) * 1206.0 * deltaT;
        const ventLatent = ventCFM * 2.8 * (outdoorDB > 26 ? 1.0 : 0.4);

        const totalSensible = wallCoolingW + windowCoolingW + solarGainW + roofCoolingW + peopleSensible + lightingSensible + equipmentSensible + ventSensible;
        const totalLatent = peopleLatent + ventLatent;
        const grandTotal = totalSensible + totalLatent;

        const totalBTUh = grandTotal * 3.412142;
        const totalTR = totalBTUh / 12000.0;
        const internalSensibleW = peopleSensible + lightingSensible + equipmentSensible;

        return {
            hour: hour,
            outdoorTemp: Number(outdoorDB.toFixed(1)),
            solarPos: solarPos,
            wallCoolingW: Number(wallCoolingW.toFixed(1)),
            windowCoolingW: Number(windowCoolingW.toFixed(1)),
            solarGainW: Number(solarGainW.toFixed(1)),
            roofCoolingW: Number(roofCoolingW.toFixed(1)),
            peopleSensibleW: Number(peopleSensible.toFixed(1)),
            peopleLatentW: Number(peopleLatent.toFixed(1)),
            lightingW: Number(lightingSensible.toFixed(1)),
            equipmentW: Number(equipmentSensible.toFixed(1)),
            ventSensibleW: Number(ventSensible.toFixed(1)),
            ventLatentW: Number(ventLatent.toFixed(1)),
            internalSensibleW: Number(internalSensibleW.toFixed(1)),
            totalSensibleW: Number(totalSensible.toFixed(1)),
            sensibleW: Number(totalSensible.toFixed(1)),
            totalLatentW: Number(totalLatent.toFixed(1)),
            latentW: Number(totalLatent.toFixed(1)),
            grandTotalW: Number(grandTotal.toFixed(1)),
            totalCoolingW: Number(grandTotal.toFixed(1)),
            totalBTUh: Number(totalBTUh.toFixed(0)),
            totalCoolingBTUh: Number(totalBTUh.toFixed(0)),
            totalTR: Number(totalTR.toFixed(2)),
            totalCoolingTR: Number(totalTR.toFixed(2)),
            densityWpM2: Number((grandTotal / floorArea).toFixed(1))
        };
    }

    /**
     * Compute 24-hour load profile for a single space
     */
    calculateSpace24Hours(space, designConditions) {
        const hourlyData = [];
        let peakHour = 0;
        let peakLoadW = 0;

        for (let h = 0; h < 24; h++) {
            const res = this.calculateSpaceHour(space, h, designConditions);
            hourlyData.push(res);
            if (res.grandTotalW > peakLoadW) {
                peakLoadW = res.grandTotalW;
                peakHour = h;
            }
        }

        return {
            spaceId: space.id,
            hourlyData: hourlyData,
            peakHour: peakHour,
            peakLoadW: peakLoadW,
            peakLoadTR: Number((peakLoadW * 3.412142 / 12000.0).toFixed(2))
        };
    }

    simulate24Hours(space, designConditions) {
        return this.calculateSpace24Hours(space, designConditions);
    }

    /**
     * Compute coincident peak for the entire building (all spaces summed by hour)
     */
    calculateBuildingCoincidentPeak(spaces, designConditions) {
        if (!spaces || spaces.length === 0) {
            return { peakHour: 14, coincidentPeakW: 0, nonCoincidentPeakW: 0, diversityFactor: 1.0, hourlyTotals: [] };
        }

        const spaces24h = spaces.map(s => this.calculateSpace24Hours(s, designConditions));
        const hourlyTotals = [];

        let coincidentPeakW = 0;
        let coincidentPeakHour = 0;

        for (let h = 0; h < 24; h++) {
            let hourSumW = 0;
            let hourSensibleSum = 0;
            let hourLatentSum = 0;

            spaces24h.forEach(sp => {
                const hData = sp.hourlyData[h];
                hourSumW += hData.grandTotalW;
                hourSensibleSum += hData.totalSensibleW;
                hourLatentSum += hData.totalLatentW;
            });

            hourlyTotals.push({
                hour: h,
                totalWatts: Number(hourSumW.toFixed(1)),
                sensibleWatts: Number(hourSensibleSum.toFixed(1)),
                latentWatts: Number(hourLatentSum.toFixed(1)),
                tonsTR: Number((hourSumW * 3.412142 / 12000.0).toFixed(2))
            });

            if (hourSumW > coincidentPeakW) {
                coincidentPeakW = hourSumW;
                coincidentPeakHour = h;
            }
        }

        // Sum of individual peaks (non-coincident)
        const nonCoincidentPeakW = spaces24h.reduce((acc, cur) => acc + cur.peakLoadW, 0);
        const diversityFactor = nonCoincidentPeakW > 0 ? coincidentPeakW / nonCoincidentPeakW : 1.0;

        return {
            coincidentPeakHour: coincidentPeakHour,
            coincidentPeakW: Number(coincidentPeakW.toFixed(1)),
            coincidentPeakTR: Number((coincidentPeakW * 3.412142 / 12000.0).toFixed(2)),
            nonCoincidentPeakW: Number(nonCoincidentPeakW.toFixed(1)),
            nonCoincidentPeakTR: Number((nonCoincidentPeakW * 3.412142 / 12000.0).toFixed(2)),
            diversityFactor: Number(diversityFactor.toFixed(3)),
            hourlyTotals: hourlyTotals,
            spacesHourly: spaces24h
        };
    }
}

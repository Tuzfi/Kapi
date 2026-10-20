/**
 * Kapi 24-Hour Dynamic Solar & Schedule Engine
 * Clean-room reconstruction of:
 * - Carrier HAP 6.4 DesignWeatherCalcs.CalcDesignSolar
 * - Carrier HAP 6.4 ExposureDirection & SurfaceAzimuth calculations
 * - ASHRAE Clear-Sky Solar & Hourly Profile Schedules
 */

export class HourlyEngine {
    constructor(latitude = -23.55) { // Default latitude (e.g. São Paulo / Subtropical -23.55°)
        this.latitude = latitude;
        this.dayOfYear = 21; // January 21st (Summer peak design day for Southern Hemisphere) or July 21st for Northern
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
        // Daily percentage multiplier of daily range (ASHRAE Fundamentals)
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
     * Calculates Solar Position (Altitude beta_s, Azimuth phi_s) and Direct Normal Irradiance
     * Clean-room implementation of Carrier HAP DesignWeatherCalcs.CalcDesignSolar
     */
    getSolarPosition(hour) {
        // Solar Hour Angle H in degrees (-180 to +180, 0 at solar noon 12:00)
        const hourAngleDeg = (hour - 12.0) * 15.0;
        const hourAngleRad = hourAngleDeg * (Math.PI / 180.0);

        // Solar Declination delta
        const deltaDeg = 23.45 * Math.sin((360.0 / 365.0) * (284 + this.dayOfYear) * (Math.PI / 180.0));
        const deltaRad = deltaDeg * (Math.PI / 180.0);
        const latRad = this.latitude * (Math.PI / 180.0);

        // Solar Altitude beta (elevation angle above horizon)
        const sinBeta = Math.sin(latRad) * Math.sin(deltaRad) +
                        Math.cos(latRad) * Math.cos(deltaRad) * Math.cos(hourAngleRad);
        const altitudeRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinBeta)));
        const altitudeDeg = altitudeRad * (180.0 / Math.PI);

        if (altitudeDeg <= 0) {
            // Sun below horizon (night)
            return {
                isSunUp: false,
                altitudeDeg: 0,
                azimuthDeg: 0,
                directNormalIrradiance: 0,
                diffuseHorizontalIrradiance: 0
            };
        }

        // Solar Azimuth phi (0° = North, 90° = East, 180° = South, 270° = West)
        const cosPhi = (Math.sin(altitudeRad) * Math.sin(latRad) - Math.sin(deltaRad)) /
                       (Math.cos(altitudeRad) * Math.cos(latRad));
        let azimuthRad = Math.acos(Math.max(-1.0, Math.min(1.0, cosPhi)));
        let azimuthDeg = azimuthRad * (180.0 / Math.PI);

        if (hourAngleDeg > 0) {
            // Afternoon: Sun is on the West side
            azimuthDeg = 360.0 - azimuthDeg;
        }

        // ASHRAE Clear Sky Direct Normal Irradiance A / exp(B / sinBeta)
        const A = 1150.0; // W/m² apparent extraterrestrial solar flux
        const B = 0.175;  // atmospheric extinction coefficient
        const C = 0.095;  // sky diffuse factor

        const directNormal = Math.max(0, A * Math.exp(-B / Math.max(0.05, Math.sin(altitudeRad))));
        const diffuseHorizontal = C * directNormal;

        return {
            isSunUp: true,
            altitudeDeg: Number(altitudeDeg.toFixed(1)),
            azimuthDeg: Number(azimuthDeg.toFixed(1)),
            directNormalIrradiance: Number(directNormal.toFixed(1)),
            diffuseHorizontalIrradiance: Number(diffuseHorizontal.toFixed(1))
        };
    }

    /**
     * Determines direct solar incidence on a wall segment
     * Mirrors Carrier HAP's ExposureDirection and normal cosine rule
     */
    getWallSolarIncidence(wallAzimuthDeg, solarPos) {
        if (!solarPos.isSunUp) {
            return { cosTheta: 0, incidentBeamWatts: 0, incidentDiffuseWatts: 0, isSunFacing: false };
        }

        const altRad = solarPos.altitudeDeg * (Math.PI / 180.0);
        const azDiffDeg = Math.abs(solarPos.azimuthDeg - wallAzimuthDeg);
        const azDiffRad = azDiffDeg * (Math.PI / 180.0);

        // For vertical wall (Tilt = 90 deg): cos(theta) = cos(alt) * cos(azDiff)
        const cosTheta = Math.cos(altRad) * Math.cos(azDiffRad);

        if (cosTheta <= 0) {
            // Wall is in shade (self-shaded)
            const diffuseWatts = solarPos.diffuseHorizontalIrradiance * 0.5; // View factor to sky = 0.5
            return {
                cosTheta: 0,
                incidentBeamWatts: 0,
                incidentDiffuseWatts: diffuseWatts,
                isSunFacing: false
            };
        }

        // Wall receives direct sun
        const beamWatts = solarPos.directNormalIrradiance * cosTheta;
        const diffuseWatts = solarPos.diffuseHorizontalIrradiance * 0.5;

        return {
            cosTheta: Number(cosTheta.toFixed(3)),
            incidentBeamWatts: Number(beamWatts.toFixed(1)),
            incidentDiffuseWatts: Number(diffuseWatts.toFixed(1)),
            isSunFacing: true
        };
    }

    /**
     * Compute Space Thermal Load for a specific hour of the day
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

        // Envelope Transmission & Solar
        let wallCoolingW = 0;
        let windowCoolingW = 0;
        let solarGainW = 0;

        if (space.walls) {
            space.walls.forEach(wall => {
                const wallLength = wall.length || 5.0;
                const grossArea = wallLength * ceilingHeight;
                let winArea = 0;
                if (wall.hasWindow) {
                    if (wall.windowWidth !== undefined && wall.windowHeight !== undefined) {
                        winArea = Math.min(grossArea * 0.85, Math.max(0.1, wall.windowWidth * wall.windowHeight));
                    } else if (wall.windowArea) {
                        winArea = Math.min(grossArea * 0.85, wall.windowArea);
                    } else {
                        const winW = Math.min(wallLength * 0.5, 1.8);
                        const winH = Math.min(ceilingHeight * 0.6, 1.4);
                        winArea = Math.min(grossArea * 0.85, winW * winH);
                    }
                }
                const netWallArea = Math.max(0, grossArea - winArea);

                if (wall.boundaryCondition === 'OutdoorAir') {
                    const uWall = wall.uValue || 0.45;
                    const uWin = wall.windowUValue || 2.4;
                    const shgc = wall.windowSHGC || 0.40;

                    // Conduction
                    wallCoolingW += netWallArea * uWall * deltaT;
                    windowCoolingW += winArea * uWin * deltaT;

                    // Solar through window
                    const baseAzimuth = wall.orientation ? wall.orientation.angle : 0;
                    const wallAzimuth = (baseAzimuth + (this.buildingRotation || 0)) % 360;
                    const solarInc = this.getWallSolarIncidence(wallAzimuth, solarPos);
                    const totalSolarFlux = solarInc.incidentBeamWatts + solarInc.incidentDiffuseWatts;
                    solarGainW += winArea * shgc * totalSolarFlux;
                } else if (wall.boundaryCondition === 'ModeledOtherSide') {
                    wallCoolingW += netWallArea * 1.8 * 2.0; // Buffer space
                }
            });
        }

        // Internal Loads
        const maxOccupants = space.occupants !== undefined ? space.occupants : Math.round(floorArea / 10.0);
        const peopleSensible = maxOccupants * occFraction * 75.0;
        const peopleLatent = maxOccupants * occFraction * 55.0;

        const lightingSensible = floorArea * (space.lightingDensity || 10.0) * lightFraction;
        const equipmentSensible = floorArea * (space.equipmentDensity || 15.0) * equipFraction;

        // Fresh Air Ventilation (ASHRAE 62.1 scaled with occupancy)
        const currentOccupants = maxOccupants * occFraction;
        const ventLitresPerSec = (currentOccupants * 5.0) + (floorArea * 0.4);
        const ventM3h = ventLitresPerSec * 3.6;
        const ventCFM = ventLitresPerSec * 2.11888;
        const ventSensible = (ventM3h / 3600.0) * 1206.0 * deltaT;
        const ventLatent = ventCFM * 2.8 * (outdoorDB > 26 ? 1.0 : 0.4);

        const totalSensible = wallCoolingW + windowCoolingW + solarGainW + peopleSensible + lightingSensible + equipmentSensible + ventSensible;
        const totalLatent = peopleLatent + ventLatent;
        const grandTotal = totalSensible + totalLatent;

        const totalBTUh = grandTotal * 3.412142;
        const totalTR = totalBTUh / 12000.0;

        return {
            hour: hour,
            outdoorTemp: Number(outdoorDB.toFixed(1)),
            solarPos: solarPos,
            totalCoolingW: Number(grandTotal.toFixed(1)),
            totalCoolingBTUh: Number(totalBTUh.toFixed(0)),
            totalCoolingTR: Number(totalTR.toFixed(2)),
            sensibleW: Number(totalSensible.toFixed(1)),
            latentW: Number(totalLatent.toFixed(1)),
            solarGainW: Number(solarGainW.toFixed(1)),
            internalSensibleW: Number((peopleSensible + lightingSensible + equipmentSensible).toFixed(1)),
            ventilationW: Number((ventSensible + ventLatent).toFixed(1)),
            loadDensityWpM2: Number((grandTotal / floorArea).toFixed(1))
        };
    }

    /**
     * Compute full 24-hour simulation for a space and determine Peak Hour
     */
    simulate24Hours(space, designConditions) {
        const hourlyData = [];
        let peakLoadW = -1;
        let peakHour = 14;

        for (let h = 0; h < 24; h++) {
            const result = this.calculateSpaceHour(space, h, designConditions);
            hourlyData.push(result);
            if (result.totalCoolingW > peakLoadW) {
                peakLoadW = result.totalCoolingW;
                peakHour = h;
            }
        }

        return {
            spaceId: space.id,
            spaceName: space.name,
            peakHour: peakHour,
            peakLoadW: peakLoadW,
            peakLoadBTUh: peakLoadW * 3.412142,
            peakLoadTR: (peakLoadW * 3.412142) / 12000.0,
            hourlyData: hourlyData
        };
    }
}

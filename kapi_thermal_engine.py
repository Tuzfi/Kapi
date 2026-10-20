"""
Kapi Thermal & Solar Engine (Python Core)
Clean-room implementation of:
- ASHRAE Standard 183 / 90.1 / 62.1
- Carrier HAP 6.4 DesignWeatherCalcs.CalcDesignSolar & Sol-Air Temperature
- Extracted reference libraries for Space Types, Activity Levels, Wall & Fenestration Assemblies
"""

import math
from typing import List, Dict, Any, Optional

class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

class BoundingBox:
    def __init__(self, x: float, y: float, width: float, height: float):
        self.x = x
        self.y = y
        self.width = width
        self.height = height

    @property
    def min_x(self) -> float: return self.x
    @property
    def min_y(self) -> float: return self.y
    @property
    def max_x(self) -> float: return self.x + self.width
    @property
    def max_y(self) -> float: return self.y + self.height

    def intersects(self, other: 'BoundingBox') -> bool:
        return not (other.max_x < self.min_x or
                    other.min_x > self.max_x or
                    other.max_y < self.min_y or
                    other.min_y > self.max_y)

    @classmethod
    def from_points(cls, points: List[Point]) -> 'BoundingBox':
        if not points:
            return cls(0, 0, 0, 0)
        xs = [p.x for p in points]
        ys = [p.y for p in points]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        return cls(min_x, min_y, max_x - min_x, max_y - min_y)


class QuadTreeNode:
    def __init__(self, bounds: BoundingBox, depth: int = 0, max_depth: int = 6, max_items: int = 4):
        self.bounds = bounds
        self.depth = depth
        self.max_depth = max_depth
        self.max_items = max_items
        self.items: List[Any] = []
        self.children: Optional[List['QuadTreeNode']] = None

    def is_leaf(self) -> bool:
        return self.children is None

    def subdivide(self):
        hw = self.bounds.width / 2.0
        hh = self.bounds.height / 2.0
        x, y = self.bounds.x, self.bounds.y
        d = self.depth + 1
        self.children = [
            QuadTreeNode(BoundingBox(x, y, hw, hh), d, self.max_depth, self.max_items),
            QuadTreeNode(BoundingBox(x + hw, y, hw, hh), d, self.max_depth, self.max_items),
            QuadTreeNode(BoundingBox(x, y + hh, hw, hh), d, self.max_depth, self.max_items),
            QuadTreeNode(BoundingBox(x + hw, y + hh, hw, hh), d, self.max_depth, self.max_items)
        ]
        existing = self.items
        self.items = []
        for it in existing:
            self.insert(it)

    def insert(self, item: Any) -> bool:
        if not self.bounds.intersects(item['bounds']):
            return False
        if self.is_leaf():
            if len(self.items) < self.max_items or self.depth >= self.max_depth:
                self.items.append(item)
                return True
            self.subdivide()
        return any(child.insert(item) for child in self.children)

    def query(self, search_bounds: BoundingBox, results: Optional[List[Any]] = None) -> List[Any]:
        if results is None:
            results = []
        if not self.bounds.intersects(search_bounds):
            return results
        for it in self.items:
            if search_bounds.intersects(it['bounds']):
                results.append(it)
        if not self.is_leaf():
            for child in self.children:
                child.query(search_bounds, results)
        return results


def get_alphanumeric_lowercase_query(query: str) -> str:
    """Mirrors Carrier HAP SpacesSearchViewModel.GetAlphaNumericLowercaseQuery"""
    if not query:
        return ""
    return "".join(c.lower() for c in query if c.isalnum())


def get_barometric_pressure(elevation_m: float) -> float:
    """
    Calculates atmospheric barometric pressure in kPa based on station elevation.
    Mirrors Carrier HAP eDesign.Core01.dll Carrier.eDesign.Psychrometrics.BaromPres.
    ASHRAE Fundamentals equation: P = 101.325 * (1 - 2.25577e-5 * Z)^5.25588
    """
    if elevation_m <= 0:
        return 101.325
    return 101.325 * ((1.0 - 2.25577e-5 * elevation_m) ** 5.25588)


def get_air_density(elevation_m: float, temp_c: float) -> float:
    """
    Calculates air density (kg/m³) adjusted for local barometric pressure and temperature.
    """
    p_pa = get_barometric_pressure(elevation_m) * 1000.0
    t_kelvin = temp_c + 273.15
    return p_pa / (287.058 * t_kelvin)


# Standard Activity Levels (Extracted from Carrier HAP ActivityLevelData.csv)
ACTIVITY_LEVELS = {
    'seated_at_rest': {'sensible': 67.4, 'latent': 35.2},
    'office_work': {'sensible': 71.8, 'latent': 60.1},
    'sedentary_work': {'sensible': 82.1, 'latent': 79.1},
    'medium_work': {'sensible': 86.5, 'latent': 133.3},
    'heavy_work': {'sensible': 153.9, 'latent': 271.1},
    'athletics': {'sensible': 208.1, 'latent': 319.5}
}

# Standard Space Types (Extracted from Carrier HAP SpaceTypes.csv)
SPACE_TYPES = {
    'office_enclosed': {'area_p': 18.0, 'act': 'office_work', 'lpd': 10.0, 'epd': 10.0, 'rp': 2.5, 'ra': 0.3},
    'office_open': {'area_p': 12.0, 'act': 'office_work', 'lpd': 8.7, 'epd': 12.0, 'rp': 2.5, 'ra': 0.3},
    'conference_room': {'area_p': 2.5, 'act': 'sedentary_work', 'lpd': 11.5, 'epd': 10.0, 'rp': 2.5, 'ra': 0.3},
    'classroom': {'area_p': 3.0, 'act': 'seated_at_rest', 'lpd': 9.9, 'epd': 6.0, 'rp': 5.0, 'ra': 0.6},
    'retail_store': {'area_p': 6.0, 'act': 'medium_work', 'lpd': 14.0, 'epd': 5.0, 'rp': 3.8, 'ra': 0.6},
    'restaurant_dining': {'area_p': 2.0, 'act': 'sedentary_work', 'lpd': 8.5, 'epd': 15.0, 'rp': 3.8, 'ra': 0.9},
    'data_center': {'area_p': 50.0, 'act': 'office_work', 'lpd': 5.0, 'epd': 150.0, 'rp': 2.5, 'ra': 0.3},
    'fitness_gym': {'area_p': 5.0, 'act': 'athletics', 'lpd': 7.0, 'epd': 10.0, 'rp': 10.0, 'ra': 0.9},
    'custom': {'area_p': 10.0, 'act': 'office_work', 'lpd': 10.0, 'epd': 15.0, 'rp': 2.5, 'ra': 0.3}
}


class SolarEngine:
    """
    Clean-room implementation of Carrier HAP DesignWeatherCalcs.CalcDesignSolar
    and ExposureDirection normal cosine calculation.
    """
    def __init__(self, latitude: float = -23.55, day_of_year: int = 21):
        self.latitude = latitude
        self.day_of_year = day_of_year

    def get_solar_position(self, hour: float) -> Dict[str, Any]:
        hour_angle_deg = (hour - 12.0) * 15.0
        hour_angle_rad = math.radians(hour_angle_deg)

        delta_deg = 23.45 * math.sin(math.radians((360.0 / 365.0) * (284 + self.day_of_year)))
        delta_rad = math.radians(delta_deg)
        lat_rad = math.radians(self.latitude)

        sin_beta = math.sin(lat_rad) * math.sin(delta_rad) + math.cos(lat_rad) * math.cos(delta_rad) * math.cos(hour_angle_rad)
        altitude_rad = math.asin(max(-1.0, min(1.0, sin_beta)))
        altitude_deg = math.degrees(altitude_rad)

        if altitude_deg <= 0:
            return {'is_sun_up': False, 'altitude_deg': 0.0, 'azimuth_deg': 0.0, 'direct_normal_w': 0.0, 'diffuse_horiz_w': 0.0}

        cos_phi = (math.sin(altitude_rad) * math.sin(lat_rad) - math.sin(delta_rad)) / (math.cos(altitude_rad) * math.cos(lat_rad))
        azimuth_deg = math.degrees(math.acos(max(-1.0, min(1.0, cos_phi))))
        if hour_angle_deg > 0:
            azimuth_deg = 360.0 - azimuth_deg

        direct_normal = max(0.0, 1150.0 * math.exp(-0.175 / max(0.05, math.sin(altitude_rad))))
        diffuse_horiz = 0.095 * direct_normal
        return {
            'is_sun_up': True,
            'altitude_deg': round(altitude_deg, 1),
            'azimuth_deg': round(azimuth_deg, 1),
            'direct_normal_w': round(direct_normal, 1),
            'diffuse_horiz_w': round(diffuse_horiz, 1)
        }

    def get_wall_solar_flux(self, wall_azimuth_deg: float, solar_pos: Dict[str, Any]) -> Dict[str, Any]:
        """Calculates solar angle of incidence and total flux on vertical wall"""
        if not solar_pos.get('is_sun_up'):
            return {'cos_theta': 0.0, 'beam_w': 0.0, 'beam_watts': 0.0, 'diffuse_w': 0.0, 'total_w': 0.0, 'is_sun_facing': False}

        alt_rad = math.radians(solar_pos['altitude_deg'])
        az_diff_rad = math.radians(abs(solar_pos['azimuth_deg'] - wall_azimuth_deg))
        cos_theta = math.cos(alt_rad) * math.cos(az_diff_rad)

        beam_w = max(0.0, solar_pos['direct_normal_w'] * cos_theta) if cos_theta > 0 else 0.0
        diffuse_sky = solar_pos['diffuse_horiz_w'] * 0.5
        total_horiz = (solar_pos['direct_normal_w'] * math.sin(alt_rad)) + solar_pos['diffuse_horiz_w']
        ground_refl = total_horiz * 0.20 * 0.5
        total_w = beam_w + diffuse_sky + ground_refl

        return {
            'cos_theta': round(max(0.0, cos_theta), 3),
            'beam_w': round(beam_w, 1),
            'beam_watts': round(beam_w, 1),
            'diffuse_w': round(diffuse_sky + ground_refl, 1),
            'total_w': round(total_w, 1),
            'is_sun_facing': cos_theta > 0
        }

    def get_wall_solar_incidence(self, wall_azimuth_deg: float, solar_pos: Dict[str, Any]) -> Dict[str, Any]:
        return self.get_wall_solar_flux(wall_azimuth_deg, solar_pos)


class ThermalEngine:
    def __init__(self, summer_outdoor_db=35.0, summer_indoor_db=24.0, winter_outdoor_db=5.0, winter_indoor_db=21.0, elevation=0.0, building_rotation=0.0):
        self.summer_outdoor_db = summer_outdoor_db
        self.summer_indoor_db = summer_indoor_db
        self.winter_outdoor_db = winter_outdoor_db
        self.winter_indoor_db = winter_indoor_db
        self.elevation = elevation
        self.building_rotation = building_rotation
        self.peak_solar_radiation = 650.0
        self.solar_engine = SolarEngine()

    def calculate_space(self, space: Dict[str, Any]) -> Dict[str, Any]:
        dt_cooling = max(0.0, self.summer_outdoor_db - self.summer_indoor_db)
        dt_heating = max(0.0, self.winter_indoor_db - self.winter_outdoor_db)

        polygon = space.get('polygon', [])
        area = 0.0
        n = len(polygon)
        if n >= 3:
            for i in range(n):
                j = (i + 1) % n
                area += polygon[i]['x'] * polygon[j]['y']
                area -= polygon[j]['x'] * polygon[i]['y']
            area = abs(area) / 2.0
        else:
            area = space.get('area', 10.0)

        height = space.get('height', 3.0)
        volume = area * height

        # Space type lookup
        st_id = space.get('spaceType', 'custom')
        st = SPACE_TYPES.get(st_id, SPACE_TYPES['custom'])
        act_id = space.get('activityLevel', st['act'])
        act = ACTIVITY_LEVELS.get(act_id, ACTIVITY_LEVELS['office_work'])

        wall_cooling_w = 0.0
        window_cooling_w = 0.0
        solar_w = 0.0
        heating_envelope_w = 0.0

        # Sol-Air solar position at design hour ~14:00
        solar_pos = self.solar_engine.get_solar_position(14.0)

        walls = space.get('walls', [])
        for w in walls:
            length = w.get('length', 5.0)
            gross_area = length * height
            has_window = w.get('hasWindow', False)
            if has_window:
                win_w = w.get('windowWidth', min(length * 0.5, 1.8))
                win_h = w.get('windowHeight', min(height * 0.6, 1.4))
                win_area = min(gross_area * 0.85, max(0.1, win_w * win_h))
            else:
                win_area = 0.0

            net_wall_area = max(0.0, gross_area - win_area)
            bc = w.get('boundaryCondition', 'OutdoorAir')

            if bc == 'OutdoorAir':
                u_wall = w.get('uValue', 0.39)
                u_win = w.get('windowUValue', 2.80)
                shgc = w.get('windowSHGC', 0.40)
                iac = w.get('shadingIAC', 1.0)
                alpha = w.get('absorptivity', 0.675)

                base_azimuth = w.get('azimuth', 0.0)
                true_azimuth = (base_azimuth + self.building_rotation) % 360.0
                flux = self.solar_engine.get_wall_solar_flux(true_azimuth, solar_pos)

                # Carrier HAP Sol-Air Temperature
                t_sol_air = self.summer_outdoor_db + (alpha * flux['total_w'] / 17.0)
                dt_sol_air = max(0.0, t_sol_air - self.summer_indoor_db)

                q_wall = net_wall_area * u_wall * dt_sol_air
                q_win_cond = win_area * u_win * dt_cooling
                q_sol = win_area * shgc * flux['total_w'] * iac

                wall_cooling_w += q_wall
                window_cooling_w += q_win_cond
                solar_w += q_sol
                heating_envelope_w += (net_wall_area * u_wall + win_area * u_win) * dt_heating
            elif bc == 'ModeledOtherSide':
                u_part = w.get('uValue', 1.74)
                wall_cooling_w += net_wall_area * u_part * 3.0
                heating_envelope_w += net_wall_area * u_part * (dt_heating * 0.4)

        # Roof
        roof_cooling_w = 0.0
        if space.get('hasRoof') or space.get('isTopFloor'):
            u_roof = space.get('uRoof', 0.35)
            alpha_roof = space.get('roofAbsorptivity', 0.675)
            # Sol-Air roof
            t_sol_roof = self.summer_outdoor_db + (alpha_roof * 900.0 / 17.0) - 4.0
            dt_roof = max(0.0, t_sol_roof - self.summer_indoor_db)
            roof_cooling_w = area * u_roof * dt_roof
            heating_envelope_w += area * u_roof * dt_heating

        # Floor
        floor_cooling_w = 0.0
        if space.get('hasFloor') or space.get('isGroundFloor'):
            u_floor = space.get('uFloor', 0.70)
            # Slab on grade provides neutral cooling in summer
            heating_envelope_w += area * u_floor * (dt_heating * 0.5)

        # Internal Loads
        default_occ = max(1, round(area / st['area_p']))
        occupants = space.get('occupants', default_occ)
        people_sensible_w = occupants * act['sensible']
        people_latent_w = occupants * act['latent']

        lighting_w = area * space.get('lightingDensity', st['lpd'])
        equip_w = area * space.get('equipmentDensity', st['epd'])

        total_internal_sensible = people_sensible_w + lighting_w + equip_w
        total_internal_latent = people_latent_w

        # Ventilation ASHRAE 62.1
        rp = space.get('ventRp', st['rp'])
        ra = space.get('ventRa', st['ra'])
        vent_l_s = (occupants * rp) + (area * ra)
        vent_m3h = vent_l_s * 3.6
        vent_cfm = vent_l_s * 2.11888
        vent_sensible_w = (vent_m3h / 3600.0) * 1206.0 * dt_cooling
        vent_latent_w = vent_cfm * 2.8
        vent_heating_w = (vent_m3h / 3600.0) * 1206.0 * dt_heating

        # Infiltration
        ach = space.get('infiltrationACH', 0.10)
        infil_m3h = volume * ach
        infil_sensible_w = (infil_m3h / 3600.0) * 1206.0 * dt_cooling
        infil_latent_w = (infil_m3h * 2.11888 / 60.0) * 2.8

        grand_sensible = wall_cooling_w + window_cooling_w + solar_w + roof_cooling_w + total_internal_sensible + vent_sensible_w + infil_sensible_w
        grand_latent = total_internal_latent + vent_latent_w + infil_latent_w
        grand_total_cooling = grand_sensible + grand_latent
        grand_total_heating = heating_envelope_w + vent_heating_w + ((infil_m3h / 3600.0) * 1206.0 * dt_heating)

        cooling_btuh = grand_total_cooling * 3.412142
        cooling_tr = cooling_btuh / 12000.0
        airflow_cfm = (grand_sensible * 3.412142) / (1.08 * (11.0 * 1.8))

        return {
            'space_id': space.get('id'),
            'name': space.get('name'),
            'area_m2': round(area, 2),
            'volume_m3': round(volume, 2),
            'cooling_watts': round(grand_total_cooling, 1),
            'cooling_kw': round(grand_total_cooling / 1000.0, 2),
            'cooling_btuh': round(cooling_btuh, 0),
            'cooling_tons_tr': round(cooling_tr, 2),
            'heating_watts': round(grand_total_heating, 1),
            'heating_kw': round(grand_total_heating / 1000.0, 2),
            'airflow_cfm': round(airflow_cfm, 0),
            'density_w_m2': round(grand_total_cooling / area, 1) if area > 0 else 0
        }

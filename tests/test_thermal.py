import unittest
from kapi_thermal_engine import (
    BoundingBox,
    QuadTreeNode,
    get_alphanumeric_lowercase_query,
    SolarEngine,
    ThermalEngine
)

class TestKapiCore(unittest.TestCase):
    def test_alphanumeric_search_query(self):
        self.assertEqual(get_alphanumeric_lowercase_query("Room #101-A (North)"), "room101anorth")
        self.assertEqual(get_alphanumeric_lowercase_query("Conference & Meeting"), "conferencemeeting")
        self.assertEqual(get_alphanumeric_lowercase_query(""), "")

    def test_quadtree_spatial_index(self):
        bounds = BoundingBox(0, 0, 100, 100)
        qt = QuadTreeNode(bounds, max_items=2)
        
        item1 = {'id': '1', 'bounds': BoundingBox(10, 10, 5, 5)}
        item2 = {'id': '2', 'bounds': BoundingBox(20, 20, 5, 5)}
        item3 = {'id': '3', 'bounds': BoundingBox(80, 80, 5, 5)}
        
        self.assertTrue(qt.insert(item1))
        self.assertTrue(qt.insert(item2))
        self.assertTrue(qt.insert(item3))
        
        results = qt.query(BoundingBox(5, 5, 15, 15))
        ids = [r['id'] for r in results]
        self.assertIn('1', ids)
        self.assertNotIn('3', ids)

    def test_solar_incidence_and_angles(self):
        solar = SolarEngine(latitude=-23.55, day_of_year=21)
        
        # Night test (02:00)
        pos_night = solar.get_solar_position(2.0)
        self.assertFalse(pos_night['is_sun_up'])
        
        # Morning test (09:00) - Sun in East quadrant
        pos_morning = solar.get_solar_position(9.0)
        self.assertTrue(pos_morning['is_sun_up'])
        self.assertGreater(pos_morning['altitude_deg'], 20.0)
        
        # East wall (Azimuth = 90 deg) should receive direct beam in morning
        inc_east_morning = solar.get_wall_solar_incidence(90.0, pos_morning)
        self.assertTrue(inc_east_morning['is_sun_facing'])
        self.assertGreater(inc_east_morning['cos_theta'], 0.3)
        self.assertGreater(inc_east_morning['beam_watts'], 100)
        
        # West wall (Azimuth = 270 deg) should be in the shade in the morning
        inc_west_morning = solar.get_wall_solar_incidence(270.0, pos_morning)
        self.assertFalse(inc_west_morning['is_sun_facing'])
        self.assertEqual(inc_west_morning['beam_watts'], 0.0)

        # Afternoon test (15:00) - West wall receives direct beam
        pos_afternoon = solar.get_solar_position(15.0)
        self.assertTrue(pos_afternoon['is_sun_up'])
        inc_west_afternoon = solar.get_wall_solar_incidence(270.0, pos_afternoon)
        self.assertTrue(inc_west_afternoon['is_sun_facing'])
        self.assertGreater(inc_west_afternoon['beam_watts'], 100)

    def test_thermal_calculation(self):
        engine = ThermalEngine()
        sample_space = {
            'id': 'office_1',
            'name': 'Executive Office',
            'height': 3.0,
            'occupants': 2,
            'lightingDensity': 10.0,
            'equipmentDensity': 15.0,
            'polygon': [
                {'x': 0, 'y': 0},
                {'x': 6, 'y': 0},
                {'x': 6, 'y': 5},
                {'x': 0, 'y': 5}
            ],
            'walls': [
                {'length': 6.0, 'boundaryCondition': 'OutdoorAir', 'hasWindow': True},
                {'length': 5.0, 'boundaryCondition': 'OutdoorAir', 'hasWindow': False},
                {'length': 6.0, 'boundaryCondition': 'ModeledOtherSide', 'hasWindow': False},
                {'length': 5.0, 'boundaryCondition': 'ModeledOtherSide', 'hasWindow': False}
            ]
        }
        res = engine.calculate_space(sample_space)
        self.assertEqual(res['area_m2'], 30.0)
        self.assertEqual(res['volume_m3'], 90.0)
        self.assertGreater(res['cooling_watts'], 1000)
        self.assertGreater(res['cooling_tons_tr'], 0.5)
        self.assertGreater(res['airflow_cfm'], 100)

    def test_custom_window_dimensions(self):
        engine = ThermalEngine()
        space_default_win = {
            'height': 3.0,
            'area': 30.0,
            'walls': [{'length': 6.0, 'boundaryCondition': 'OutdoorAir', 'hasWindow': True}]
        }
        res_default = engine.calculate_space(space_default_win)

        # Larger custom window: 3.0m x 2.0m = 6.0m²
        space_large_win = {
            'height': 3.0,
            'area': 30.0,
            'walls': [{'length': 6.0, 'boundaryCondition': 'OutdoorAir', 'hasWindow': True, 'windowWidth': 3.0, 'windowHeight': 2.0}]
        }
        res_large = engine.calculate_space(space_large_win)
        self.assertGreater(res_large['cooling_watts'], res_default['cooling_watts'])

    def test_building_rotation(self):
        # Base engine (rotation = 0) vs Rotated engine (rotation = 90)
        engine_0 = ThermalEngine(building_rotation=0.0)
        engine_90 = ThermalEngine(building_rotation=90.0)
        self.assertEqual(engine_0.building_rotation, 0.0)
        self.assertEqual(engine_90.building_rotation, 90.0)

if __name__ == '__main__':
    unittest.main()

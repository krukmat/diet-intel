"""
Test Portion Estimator Utility - FEAT-PROPORTIONS
"""

import unittest
from unittest.mock import patch
from app.utils.portion_estimator import PortionEstimator


class TestPortionEstimator(unittest.TestCase):

    def setUp(self):
        self.estimator = PortionEstimator()

    def test_estimate_from_visual_markers_basic(self):
        """Test basic portion estimation"""
        grams = self.estimator.estimate_from_visual_markers(
            ["standard_plate"],
            ["standard_plate"]
        )
        self.assertIsInstance(grams, float)
        self.assertTrue(grams > 0)
        self.assertTrue(grams < 1000)  # Reasonable bounds

    def test_estimate_from_visual_markers_with_markers(self):
        """Test estimation with visual markers"""
        grams = self.estimator.estimate_from_visual_markers(
            ["large_portion"],
            ["standard_plate"]
        )
        self.assertIsInstance(grams, float)

    def test_estimate_from_visual_markers_no_reference(self):
        """Test estimation without reference objects"""
        grams = self.estimator.estimate_from_visual_markers(
            ["full_plate"],
            []
        )
        self.assertIsInstance(grams, float)
        self.assertTrue(grams > 0)

    def test_calculate_nutritional_impact_known_ingredient(self):
        """Test nutritional calculation for known ingredient"""
        impact = self.estimator.calculate_nutritional_impact("chicken_breast", 150)

        self.assertIn("calories", impact)
        self.assertIn("protein_g", impact)
        self.assertIn("fat_g", impact)
        self.assertIn("carbs_g", impact)
        self.assertIn("confidence_factor", impact)

        # Chicken breast should be high in protein
        self.assertTrue(impact["protein_g"] > impact["fat_g"])

    def test_calculate_nutritional_impact_unknown_ingredient(self):
        """Test nutritional calculation for unknown ingredient"""
        impact = self.estimator.calculate_nutritional_impact("unknown_food", 100)

        self.assertIn("calories", impact)
        self.assertIsInstance(impact["calories"], (int, float))
        self.assertTrue(impact["calories"] > 0)

    def test_calculate_nutritional_impact_zero_grams(self):
        """Test nutritional calculation with zero grams"""
        impact = self.estimator.calculate_nutritional_impact("chicken_breast", 0)

        self.assertEqual(impact["calories"], 0)
        self.assertEqual(impact["protein_g"], 0)

    def test_calculate_nutritional_impact_large_portion(self):
        """Test nutritional calculation with large portion"""
        impact = self.estimator.calculate_nutritional_impact("rice", 500)

        # Should scale properly
        base_calories = 130  # per 100g
        expected = base_calories * 5  # 500g = 5 * 100g
        self.assertAlmostEqual(impact["calories"], expected, places=1)

    def test_estimate_from_visual_markers_error_handling(self):
        """Test error handling in estimate_from_visual_markers"""
        # This should trigger the exception handling
        result = self.estimator.estimate_from_visual_markers(["invalid"], [])
        self.assertIsInstance(result, float)
        self.assertTrue(result > 0)

    def test_calculate_nutritional_impact_error_handling(self):
        """Test error handling in calculate_nutritional_impact"""
        # Use test hook to trigger exception
        impact = self.estimator.calculate_nutritional_impact("__test_error__", 150)

        # Should return fallback values
        self.assertIsInstance(impact, dict)
        self.assertIn("calories", impact)
        self.assertIn("protein_g", impact)
        self.assertEqual(impact["confidence_factor"], 0.5)  # Fallback confidence


if __name__ == '__main__':
    unittest.main()

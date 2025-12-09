"""
Test Exercise Calculator Service - FEAT-PROPORTIONS
"""

import unittest
from app.services.exercise_calculator import ExerciseCalculator


class TestExerciseCalculator(unittest.TestCase):

    def setUp(self):
        self.calculator = ExerciseCalculator()

    def test_calculate_calorie_deficit_positive(self):
        """Test calculating positive deficit"""
        deficit = self.calculator.calculate_calorie_deficit(500, 2000)
        self.assertEqual(deficit, 1500)

    def test_calculate_calorie_deficit_negative(self):
        """Test calculating negative deficit (surplus)"""
        deficit = self.calculator.calculate_calorie_deficit(2500, 2000)
        self.assertEqual(deficit, -500)

    def test_calculate_calorie_deficit_zero(self):
        """Test calculating zero deficit"""
        deficit = self.calculator.calculate_calorie_deficit(2000, 2000)
        self.assertEqual(deficit, 0)

    def test_suggest_exercise_no_deficit(self):
        """Test no suggestions for no deficit"""
        suggestions = self.calculator.suggest_exercise(0, {"weight_kg": 70})
        self.assertEqual(suggestions, [])

    def test_suggest_exercise_small_deficit(self):
        """Test suggestions for small deficit"""
        suggestions = self.calculator.suggest_exercise(150, {"weight_kg": 70})

        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["activity_type"], "walking")
        self.assertEqual(suggestions[0]["duration_minutes"], 45)
        self.assertTrue(suggestions[0]["estimated_calories_burned"] > 0)

    def test_suggest_exercise_medium_deficit(self):
        """Test suggestions for medium deficit"""
        suggestions = self.calculator.suggest_exercise(300, {"weight_kg": 70})

        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["activity_type"], "brisk_walking")
        self.assertEqual(suggestions[0]["duration_minutes"], 50)

    def test_suggest_exercise_large_deficit(self):
        """Test suggestions for large deficit"""
        suggestions = self.calculator.suggest_exercise(500, {"weight_kg": 70})

        self.assertEqual(len(suggestions), 2)
        activities = [s["activity_type"] for s in suggestions]
        self.assertIn("running", activities)
        self.assertIn("swimming", activities)

    def test_estimate_calories_burned_walking(self):
        """Test calorie estimation for walking"""
        calories = self.calculator.estimate_calories_burned("brisk_walking", 45, 70)
        self.assertTrue(calories > 100)  # Should burn some calories
        self.assertTrue(calories < 300)  # But not too many

    def test_estimate_calories_burned_running(self):
        """Test calorie estimation for running"""
        calories = self.calculator.estimate_calories_burned("running", 30, 70)
        self.assertTrue(calories > 200)  # Higher burn than walking

    def test_estimate_calories_burned_unknown_activity(self):
        """Test fallback for unknown activity"""
        calories = self.calculator.estimate_calories_burned("unknown", 30, 70)
        self.assertIsInstance(calories, (int, float))
        self.assertTrue(calories >= 0)

    def test_estimate_calories_burned_error_handling(self):
        """Test error handling in estimate_calories_burned"""
        # Use test hook to trigger exception
        calories = self.calculator.estimate_calories_burned("__test_error__", 30, 70)
        # Should return 0.0 due to exception
        self.assertEqual(calories, 0.0)


if __name__ == '__main__':
    unittest.main()

"""
Test Food Vision Models - FEAT-PROPORTIONS
"""

import unittest
from datetime import datetime
from app.models.food_vision import (
    IdentifiedIngredient, NutritionalAnalysis, ExerciseSuggestion,
    CalorieBalance, VisionLogResponse, VisionLogWithExerciseResponse,
    LowConfidenceVisionResponse, ErrorResponse,
    VisionAnalysisRequest, VisionCorrectionRequest, PortionsEstimate
)


class TestFoodVisionModels(unittest.TestCase):

    def test_identified_ingredient_creation(self):
        """Test IdentifiedIngredient model creation"""
        ingredient = IdentifiedIngredient(
            name="chicken_breast",
            category="protein",
            estimated_grams=150.0,
            confidence_score=0.85
        )

        self.assertEqual(ingredient.name, "chicken_breast")
        self.assertEqual(ingredient.category, "protein")
        self.assertEqual(ingredient.estimated_grams, 150.0)
        self.assertEqual(ingredient.confidence_score, 0.85)

    def test_identified_ingredient_validation(self):
        """Test IdentifiedIngredient validation"""
        # Valid creation
        ingredient = IdentifiedIngredient(
            name="chicken",
            category="protein",
            estimated_grams=150.0,
            confidence_score=0.8
        )
        self.assertEqual(ingredient.name, "chicken")

        # Test confidence bounds
        with self.assertRaises(ValueError):
            IdentifiedIngredient(
                name="chicken",
                category="protein",
                estimated_grams=150.0,
                confidence_score=1.5  # Invalid
            )

    def test_nutritional_analysis_creation(self):
        """Test NutritionalAnalysis model creation"""
        analysis = NutritionalAnalysis(
            total_calories=250.0,
            macro_distribution={"protein": 42, "fat": 35, "carbs": 23},
            food_quality_score=0.8
        )

        self.assertEqual(analysis.total_calories, 250.0)
        self.assertEqual(analysis.macro_distribution["protein"], 42)
        self.assertEqual(analysis.food_quality_score, 0.8)

    def test_exercise_suggestion_creation(self):
        """Test ExerciseSuggestion model creation"""
        suggestion = ExerciseSuggestion(
            activity_type="walking",
            duration_minutes=30,
            estimated_calories_burned=120,
            intensity_level="moderate",
            reasoning="Balanced exercise",
            health_benefits=["Cardiovascular health"]
        )

        self.assertEqual(suggestion.activity_type, "walking")
        self.assertEqual(suggestion.duration_minutes, 30)
        self.assertEqual(suggestion.estimated_calories_burned, 120)

    def test_calorie_balance_creation(self):
        """Test CalorieBalance model creation"""
        balance = CalorieBalance(
            consumed_calories=500.0,
            target_calories=2000.0,
            calorie_deficit=1500.0,
            exercise_needed=True,
            balance_status="under_target"
        )

        self.assertEqual(balance.consumed_calories, 500.0)
        self.assertEqual(balance.target_calories, 2000.0)
        self.assertEqual(balance.calorie_deficit, 1500.0)
        self.assertTrue(balance.exercise_needed)

    def test_vision_log_response_creation(self):
        """Test VisionLogResponse model creation"""
        ingredient = IdentifiedIngredient(
            name="chicken",
            category="protein",
            estimated_grams=150.0,
            confidence_score=0.85
        )

        nutrition = NutritionalAnalysis(
            total_calories=250.0,
            macro_distribution={"protein": 40, "fat": 30, "carbs": 30},
            food_quality_score=0.8
        )

        response = VisionLogResponse(
            id="test-id",
            user_id="user-123",
            meal_type="lunch",
            identified_ingredients=[ingredient],
            estimated_portions={"total_calories": 250, "confidence_score": 0.85},
            nutritional_analysis=nutrition,
            created_at=datetime.now(),
            processing_time_ms=1200
        )

        self.assertEqual(response.id, "test-id")
        self.assertEqual(response.user_id, "user-123")
        self.assertEqual(response.meal_type, "lunch")
        self.assertEqual(len(response.identified_ingredients), 1)

    def test_vision_log_with_exercise_creation(self):
        """Test VisionLogWithExerciseResponse model creation"""
        ingredient = IdentifiedIngredient(
            name="chicken",
            category="protein",
            estimated_grams=150.0,
            confidence_score=0.85
        )

        nutrition = NutritionalAnalysis(
            total_calories=250.0,
            macro_distribution={"protein": 40, "fat": 30, "carbs": 30},
            food_quality_score=0.8
        )

        balance = CalorieBalance(
            consumed_calories=250.0,
            target_calories=2000.0,
            calorie_deficit=1750.0,
            exercise_needed=True,
            balance_status="under_target"
        )

        response = VisionLogWithExerciseResponse(
            id="test-id",
            user_id="user-123",
            meal_type="lunch",
            identified_ingredients=[ingredient],
            estimated_portions={"total_calories": 250, "confidence_score": 0.85},
            nutritional_analysis=nutrition,
            created_at=datetime.now(),
            processing_time_ms=1200,
            calorie_balance=balance
        )

        self.assertEqual(response.id, "test-id")
        self.assertIsNotNone(response.calorie_balance)
        self.assertEqual(response.calorie_balance.exercise_needed, True)

    def test_low_confidence_response_creation(self):
        """Test LowConfidenceVisionResponse model creation"""
        ingredient = IdentifiedIngredient(
            name="unknown",
            category="unknown",
            estimated_grams=100.0,
            confidence_score=0.4
        )

        response = LowConfidenceVisionResponse(
            id="low-conf-id",
            confidence_score=0.45,
            partial_identification=[ingredient],
            suggested_corrections=["Take photo from above", "Better lighting"],
            created_at=datetime.now()
        )

        self.assertEqual(response.id, "low-conf-id")
        self.assertEqual(response.confidence_score, 0.45)
        self.assertTrue(response.requires_manual_review)
        self.assertGreater(len(response.suggested_corrections), 0)

    def test_error_response_creation(self):
        """Test ErrorResponse model creation"""
        error = ErrorResponse(
            error="Invalid image format",
            detail="File must be JPEG or PNG",
            error_code="INVALID_IMAGE_FORMAT"
        )

        self.assertEqual(error.error, "Invalid image format")
        self.assertEqual(error.error_code, "INVALID_IMAGE_FORMAT")

    def test_vision_analysis_request_creation(self):
        """Test VisionAnalysisRequest model creation"""
        request = VisionAnalysisRequest(
            image_data="base64_data_here",
            meal_type="lunch",
            user_context={"weight_kg": 70, "activity_level": "moderate"}
        )

        self.assertEqual(request.meal_type, "lunch")
        self.assertEqual(request.user_context["weight_kg"], 70)

    def test_vision_correction_request_creation(self):
        """Test VisionCorrectionRequest model creation"""
        correction = VisionCorrectionRequest(
            correction_notes="La porción era más grande",
            corrected_portions={"actual_grams": 180}
        )

        self.assertEqual(correction.correction_notes, "La porción era más grande")
        self.assertEqual(correction.corrected_portions["actual_grams"], 180)

    def test_portions_estimate_creation(self):
        """Test PortionsEstimate model creation"""
        estimate = PortionsEstimate(
            total_calories=250.0,
            total_protein_g=30.0,
            total_fat_g=8.0,
            total_carbs_g=5.0,
            confidence_score=0.85
        )

        self.assertEqual(estimate.total_calories, 250.0)
        self.assertEqual(estimate.total_protein_g, 30.0)
        self.assertEqual(estimate.confidence_score, 0.85)


if __name__ == '__main__':
    unittest.main()

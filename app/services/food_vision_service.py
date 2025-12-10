"""
Food Vision Service - Main service for photo-based meal analysis

Part of FEAT-PROPORTIONS implementation
Orchestrates food analysis, exercise suggestions, and data persistence
"""

import logging
import time
import uuid
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.models.food_vision import (
    VisionLogResponse, VisionLogWithExerciseResponse,
    LowConfidenceVisionResponse, ErrorResponse
)
from app.services.vision_analyzer import VisionAnalyzer
from app.services.exercise_calculator import ExerciseCalculator
from app.services.database import db_service
from app.models.exercise_suggestion import ExerciseRecommendation

logger = logging.getLogger(__name__)

class FoodVisionService:
    """Main service for analyzing food images and providing nutritional insights"""

    def __init__(self):
        self.vision_analyzer = VisionAnalyzer()
        self.exercise_calculator = ExerciseCalculator()

    async def analyze_food_image(
        self,
        image_data: bytes,
        user_id: str,
        meal_type: str = "lunch",
        user_context: Optional[Dict[str, Any]] = None
    ) -> VisionLogResponse:
        """
        Analyze food image and return complete nutritional analysis

        Args:
            image_data: Raw image bytes
            user_id: User identifier
            meal_type: Type of meal (breakfast|lunch|dinner)
            user_context: Additional user context (weight, goals, etc.)

        Returns:
            Complete analysis response
        """

        analysis_id = str(uuid.uuid4())
        start_time = time.time()

        try:
            logger.info(f"Starting food analysis for user {user_id}, meal: {meal_type}")

            # Analyze image using vision analyzer
            analysis_result = await self.vision_analyzer.analyze_image(
                image_data=image_data
            )

            # Calculate processing time
            processing_time = int((time.time() - start_time) * 1000)

            # Build nutritional analysis
            nutritional_analysis = self._build_nutritional_analysis(analysis_result)

            # Determine if exercise suggestions are needed
            exercise_suggestions = []
            calorie_balance = None

            if user_context and nutritional_analysis["total_calories"] > 2000:  # Mock target
                # Calculate deficit (assuming over target)
                deficit = nutritional_analysis["total_calories"] - 2000
                exercise_suggestions = await self._get_exercise_suggestions(deficit, user_context)

                calorie_balance = {
                    "consumed_calories": nutritional_analysis["total_calories"],
                    "target_calories": 2000,  # Mock target
                    "calorie_deficit": deficit,
                    "exercise_needed": bool(exercise_suggestions),
                    "balance_status": "over_target" if deficit > 0 else "under_target"
                }

            # Create response based on whether exercise suggestions are included
            if exercise_suggestions:
                response = VisionLogWithExerciseResponse(
                    id=analysis_id,
                    user_id=user_id,
                    image_url=f"/api/v1/vision/image/{analysis_id}",
                    meal_type=meal_type,
                    identified_ingredients=analysis_result.get("identified_ingredients", []),
                    estimated_portions=self._build_portions_estimate(analysis_result),
                    nutritional_analysis=nutritional_analysis,
                    exercise_suggestions=exercise_suggestions,
                    calorie_balance=calorie_balance,
                    created_at=datetime.utcnow().isoformat(),
                    processing_time_ms=processing_time
                )
            else:
                response = VisionLogResponse(
                    id=analysis_id,
                    user_id=user_id,
                    image_url=f"/api/v1/vision/image/{analysis_id}",
                    meal_type=meal_type,
                    identified_ingredients=analysis_result.get("identified_ingredients", []),
                    estimated_portions=self._build_portions_estimate(analysis_result),
                    nutritional_analysis=nutritional_analysis,
                    exercise_suggestions=[],
                    created_at=datetime.utcnow().isoformat(),
                    processing_time_ms=processing_time
                )

            # TODO: Persist analysis result to database
            logger.info(f"Completed analysis {analysis_id} in {processing_time}ms")
            return response

        except Exception as e:
            logger.error(f"Error in food image analysis: {e}", exc_info=True)
            raise Exception(f"Analysis failed: {str(e)}")

    async def get_analysis_history(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get user's analysis history

        MVP: Return empty list until BD is implemented
        """
        logger.info(f"Retrieving analysis history for user {user_id}")

        # TODO: Implement database query when vision_logs table is available
        return {
            "logs": [],
            "total_count": 0,
            "has_more": False
        }

    async def submit_correction(
        self,
        log_id: str,
        user_id: str,
        correction_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Submit user correction for improved analysis

        Args:
            log_id: Analysis ID to correct
            user_id: User making the correction
            correction_data: Correction details
        """
        logger.info(f"Processing correction for analysis {log_id} by user {user_id}")

        try:
            # TODO: Validate correction data
            # TODO: Store correction in vision_corrections table
            # TODO: Calculate improvement score

            # Mock implementation
            improvement_score = 0.15  # 15% improvement assumed

            correction_record = {
                "id": str(uuid.uuid4()),
                "vision_log_id": log_id,
                "user_id": user_id,
                "correction_type": correction_data.get("feedback_type", "general"),
                "original_data": correction_data.get("original_data", {}),
                "corrected_data": correction_data.get("corrected_data", {}),
                "improvement_score": improvement_score,
                "created_at": datetime.utcnow().isoformat()
            }

            # TODO: Persist correction_record to database

            return {
                "success": True,
                "message": "Correction recorded for future improvements",
                "improvement_score": improvement_score
            }

        except Exception as e:
            logger.error(f"Error processing correction: {e}")
            raise Exception(f"Correction failed: {str(e)}")

    def _build_nutritional_analysis(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """Build complete nutritional analysis from raw results"""
        identified = analysis_result.get("identified_ingredients", [])

        if not identified:
            return {
                "total_calories": 0,
                "macro_distribution": {"protein_percent": 0, "fat_percent": 0, "carbs_percent": 0},
                "food_quality_score": 0.0,
                "health_benefits": []
            }

        total_calories = analysis_result.get("estimated_portions", {}).get("total_calories", 0)

        # Calculate macro distribution
        protein_cal = analysis_result.get("estimated_portions", {}).get("total_protein_g", 0) * 4
        fat_cal = analysis_result.get("estimated_portions", {}).get("total_fat_g", 0) * 9
        carb_cal = analysis_result.get("estimated_portions", {}).get("total_carbs_g", 0) * 4

        macro_distribution = {}
        if total_calories > 0:
            macro_distribution = {
                "protein_percent": round((protein_cal / total_calories) * 100),
                "fat_percent": round((fat_cal / total_calories) * 100),
                "carbs_percent": round((carb_cal / total_calories) * 100)
            }

        # Determine health benefits based on identified foods
        health_benefits = self._determine_health_benefits(identified)

        # Quality score based on ingredient variety and nutrients
        quality_score = min(0.9, len(identified) * 0.1 + 0.5)

        return {
            "total_calories": total_calories,
            "macro_distribution": macro_distribution,
            "food_quality_score": quality_score,
            "health_benefits": health_benefits
        }

    def _build_portions_estimate(self, analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """Build portions estimate from analysis"""
        return analysis_result.get("portion_estimate", {
            "total_calories": 0,
            "total_protein_g": 0,
            "total_fat_g": 0,
            "total_carbs_g": 0,
            "confidence_score": 0.0
        })

    async def _get_exercise_suggestions(
        self,
        deficit_calories: float,
        user_context: Dict[str, Any]
    ) -> List[ExerciseRecommendation]:
        """Generate exercise suggestions based on caloric deficit"""
        try:
            suggestions = self.exercise_calculator.suggest_exercise(
                abs(deficit_calories),
                user_context
            )

            # Convert to ExerciseRecommendation model
            return [
                ExerciseRecommendation(
                    activity=s["activity_type"],
                    duration_min=s["duration_minutes"],
                    calories_burn=s["estimated_calories_burned"],
                    intensity=s["intensity_level"],
                    reasoning=s["reasoning"],
                    health_benefits=s["health_benefits"]
                )
                for s in suggestions
            ]

        except Exception as e:
            logger.warning(f"Could not generate exercise suggestions: {e}")
            return []

    def _determine_health_benefits(self, identified_ingredients: List[Dict[str, Any]]) -> List[str]:
        """Determine health benefits based on identified ingredients"""
        benefits = set()

        for ingredient in identified_ingredients:
            name = ingredient.get("name", "").lower()
            category = ingredient.get("category", "").lower()

            if "pollo" in name or "chicken" in name or "proteína" in category:
                benefits.add("Alto contenido de proteína")
                benefits.add("Bajo en grasas saturadas")

            if "vegetal" in category or "verdura" in category:
                benefits.add("Rico en vitaminas y minerales")
                benefits.add("Alto contenido de fibra")

            if "fruta" in category or "fruit" in name:
                benefits.add("Fuente natural de antioxidantes")
                benefits.add("Ayuda a la digestión")

        return list(benefits)

    @staticmethod
    def _coerce_float(value: Any, default: float = 0.0) -> float:
        """Safely convert arbitrary values to float."""
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _normalize_ingredient(self, ingredient: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure ingredient data has all mandatory fields."""
        base = ingredient if isinstance(ingredient, dict) else {}
        visual_markers = base.get("visual_markers")
        if not isinstance(visual_markers, list):
            visual_markers = []
        nutrition_per_100g = base.get("nutrition_per_100g")
        if not isinstance(nutrition_per_100g, dict):
            nutrition_per_100g = {}

        return {
            "name": base.get("name", "unknown"),
            "category": base.get("category", "unknown"),
            "estimated_grams": self._coerce_float(base.get("estimated_grams"), 0.0),
            "confidence_score": self._coerce_float(base.get("confidence_score"), 0.0),
            "visual_markers": visual_markers,
            "nutrition_per_100g": nutrition_per_100g,
        }

    def _normalize_nutritional_analysis(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Fill missing nutritional analysis fields with defaults."""
        source = data if isinstance(data, dict) else {}
        macros = source.get("macro_distribution")
        if not isinstance(macros, dict):
            macros = {"protein": 0.0, "carbs": 0.0, "fat": 0.0}

        health_benefits = source.get("health_benefits")
        if not isinstance(health_benefits, list):
            health_benefits = []

        return {
            "total_calories": self._coerce_float(source.get("total_calories"), 0.0),
            "macro_distribution": macros,
            "micronutrients": source.get("micronutrients"),
            "food_quality_score": self._coerce_float(source.get("food_quality_score"), 0.0),
            "health_benefits": health_benefits,
        }


    async def save_analysis(self, user_id: str, response: VisionLogResponse) -> VisionLogResponse:
        """Persist analysis result to database"""
        try:
            # Map VisionLogResponse to dict for database storage
            vision_log_dict = {
                "id": response.id,
                "user_id": user_id,
                "image_url": response.image_url,
                "meal_type": response.meal_type,
                "identified_ingredients": [ingred.dict() for ingred in response.identified_ingredients],
                "estimated_portions": response.estimated_portions.dict() if hasattr(response.estimated_portions, 'dict') else response.estimated_portions,
                "nutritional_analysis": response.nutritional_analysis.dict(),
                "exercise_suggestions": [ex.dict() for ex in response.exercise_suggestions],
                "confidence_score": response.estimated_portions.get("confidence_score", 0.0),
                "processing_time_ms": response.processing_time_ms,
                "created_at": response.created_at,
            }

            persisted = await db_service.create_vision_log(vision_log_dict)

            logger.info(f"Analysis {response.id} persisted for user {user_id}")
            return VisionLogResponse(**persisted)

        except Exception as e:
            logger.error(f"Failed to persist analysis {response.id}: {e}")
            raise

    async def get_user_history(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user history with date filtering
        """
        try:
            # Get records from database
            rows, total_count = await db_service.list_vision_logs(
                user_id=user_id,
                limit=limit,
                offset=offset,
                date_from=date_from,
                date_to=date_to
            )

            # Convert to VisionLogResponse objects
            logs = []
            for row in rows:
                # Parse identified_ingredients
                identified_ingredients = []
                if row.get("identified_ingredients"):
                    if isinstance(row["identified_ingredients"], str):
                        identified_ingredients = json.loads(row["identified_ingredients"])
                    else:
                        identified_ingredients = row["identified_ingredients"]

                # Parse exercise_suggestions
                exercise_suggestions = []
                if row.get("exercise_suggestions"):
                    if isinstance(row["exercise_suggestions"], str):
                        exercise_suggestions = json.loads(row["exercise_suggestions"])
                    else:
                        exercise_suggestions = row["exercise_suggestions"]

                estimated_portions = row.get("estimated_portions", {})
                if isinstance(estimated_portions, str):
                    estimated_portions = json.loads(estimated_portions)

                nutritional_analysis = row.get("nutritional_analysis", {})
                if isinstance(nutritional_analysis, str):
                    nutritional_analysis = json.loads(nutritional_analysis)

                sanitized_ingredients = [
                    self._normalize_ingredient(ingredient)
                    for ingredient in identified_ingredients or []
                ]

                log = VisionLogResponse(
                    id=row["id"],
                    user_id=row["user_id"],
                    image_url=row["image_url"],
                    meal_type=row["meal_type"],
                    identified_ingredients=sanitized_ingredients,
                    estimated_portions=estimated_portions or {},
                    nutritional_analysis=self._normalize_nutritional_analysis(nutritional_analysis),
                    exercise_suggestions=exercise_suggestions,
                    created_at=row["created_at"].isoformat() if isinstance(row["created_at"], datetime) else row["created_at"],
                    processing_time_ms=row.get("processing_time_ms", 0)
                )
                logs.append(log)

            has_more = offset + len(logs) < total_count

            return {
                "logs": [log.dict() for log in logs],
                "total_count": total_count,
                "has_more": has_more
            }

        except Exception as e:
            logger.error(f"Failed to get user history for {user_id}: {e}")
            raise

    async def submit_correction(
        self,
        log_id: str,
        user_id: str,
        correction_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Submit correction and return processed result
        """
        try:
            # Verify log belongs to user
            log = await db_service.get_vision_log(log_id)
            if not log:
                raise Exception(f"Analysis log {log_id} not found")
            if log["user_id"] != user_id:
                raise Exception("Unauthorized to correct this analysis")

            # Calculate improvement score
            improvement_score = self._calculate_improvement_score(correction_data)

            # Prepare correction record
            correction_dict = {
                "vision_log_id": log_id,
                "user_id": user_id,
                "correction_type": correction_data.get("feedback_type", "general"),
                "original_data": correction_data.get("original_data", {}),
                "corrected_data": correction_data.get("corrected_data", {}),
                "improvement_score": improvement_score,
                "created_at": datetime.utcnow(),
            }

            correction_result = await db_service.create_vision_correction(correction_dict)

            # Log the correction
            logger.info(f"Correction submitted for log {log_id} by user {user_id}, improvement: {improvement_score}")

            return {
                "success": True,
                "correction_id": correction_result["id"],
                "improvement_score": improvement_score,
                "message": "Correction recorded for future improvements"
            }

        except Exception as e:
            logger.error(f"Failed to submit correction for {log_id}: {e}")
            raise Exception(f"Correction failed: {str(e)}")

    def _calculate_improvement_score(self, correction_data: Dict[str, Any]) -> float:
        """Calculate improvement score based on correction type and data"""
        feedback_type = correction_data.get("feedback_type", "general")

        # Base scores by feedback type
        base_scores = {
            "portion_correction": 0.3,
            "ingredient_misidentification": 0.5,
            "missing_ingredient": 0.4,
            "general": 0.2
        }

        score = base_scores.get(feedback_type, 0.2)

        # Bonus if specific corrections provided
        if correction_data.get("corrected_portions"):
            score += 0.2

        if correction_data.get("correction_notes"):
            score += 0.1

        return min(0.9, score)  # Cap at 90% improvement


# Singleton instance
food_vision_service = FoodVisionService()

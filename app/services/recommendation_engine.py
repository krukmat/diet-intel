"""
Personalized Recipe Recommendation Engine
Phase R.3.1.1: User Taste Profile Analysis Implementation - Task 8
"""

import logging
import statistics
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple, Set
from datetime import datetime

from app.services.recipe_database import RecipeDatabaseService
from app.services.recipe_ai_engine import GeneratedRecipe, RecipeGenerationRequest as EngineRequest
from app.models.product import Nutriments

logger = logging.getLogger(__name__)


@dataclass
class UserPreferenceProfile:
    """Lightweight container for cached user preference data (legacy compatibility)."""

    favorite_foods: Set[str] = field(default_factory=set)
    avoided_foods: Set[str] = field(default_factory=set)
    preferred_cuisines: List[str] = field(default_factory=list)
    macro_preferences: Dict[str, float] = field(default_factory=dict)
    meal_timing_patterns: Dict[str, List[str]] = field(default_factory=dict)
    seasonal_preferences: Dict[str, List[str]] = field(default_factory=dict)
    interaction_count: int = 0
    last_updated: datetime = field(default_factory=datetime.utcnow)


class RecommendationEngine:
    """Service for personalized recipe recommendations and scoring"""

    def __init__(self, db_service: Optional[RecipeDatabaseService] = None):
        """Initialize recommendation engine with database connection"""
        self.db_service = db_service or RecipeDatabaseService()
        # Legacy state used by tests and older API integrations
        self.user_profiles: Dict[str, UserPreferenceProfile] = {}
        self.feedback_history: List[Any] = []
        self.recommendation_cache_ttl: int = 300
        self.scoring_weights: Dict[str, float] = {
            'nutritional_quality': 0.4,
            'user_preference': 0.3,
            'goal_alignment': 0.1,
            'dietary_compatibility': 0.1,
            'seasonal_factor': 0.05,
            'popularity_factor': 0.05,
        }
        self.macro_targets: Dict[str, float] = {
            'protein_min_percent': 0.18,
            'protein_max_percent': 0.35,
            'fat_min_percent': 0.20,
            'fat_max_percent': 0.35,
            'carbs_min_percent': 0.30,
            'carbs_max_percent': 0.60,
        }

    async def apply_personalization(self, request: EngineRequest, user_id: str) -> Tuple[EngineRequest, Dict[str, Any]]:
        """
        Apply user's taste profile to enhance recipe generation request
        Returns: (enhanced_request, personalization_metadata)
        """
        try:
            # Get user's taste profile
            profile = await self.db_service.get_user_taste_profile(user_id)

            if not profile or profile['profile_confidence'] < 0.3:
                logger.info(f"User {user_id} has insufficient taste profile data for personalization")
                return request, {'applied': False, 'reason': 'insufficient_profile_confidence'}

            logger.info(f"Applying personalization for user {user_id} (confidence: {profile['profile_confidence']})")

            # Create enhanced request copy
            enhanced_request = EngineRequest(
                user_id=request.user_id,
                cuisine_preferences=request.cuisine_preferences.copy() if request.cuisine_preferences else [],
                dietary_restrictions=request.dietary_restrictions.copy() if request.dietary_restrictions else [],
                difficulty_preference=request.difficulty_preference,
                meal_type=request.meal_type,
                target_calories_per_serving=request.target_calories_per_serving,
                target_protein_g=request.target_protein_g,
                target_carbs_g=request.target_carbs_g,
                target_fat_g=request.target_fat_g,
                servings=request.servings,
                max_prep_time_minutes=request.max_prep_time_minutes,
                max_cook_time_minutes=request.max_cook_time_minutes,
                # Use available_ingredients instead of preferred_ingredients
                available_ingredients=getattr(request, 'available_ingredients', []),
                excluded_ingredients=request.excluded_ingredients.copy() if request.excluded_ingredients else []
            )

            personalization_metadata = {
                'applied': True,
                'profile_confidence': profile['profile_confidence'],
                'enhancements': []
            }

            # 1. Enhance cuisine preferences
            if not enhanced_request.cuisine_preferences:
                top_cuisines = sorted(
                    profile['cuisine_preferences'],
                    key=lambda x: x['score'],
                    reverse=True
                )[:3]

                if top_cuisines:
                    enhanced_request.cuisine_preferences = [c['cuisine'] for c in top_cuisines if c['score'] > 0.2]
                    personalization_metadata['enhancements'].append({
                        'type': 'cuisine_preferences',
                        'added': enhanced_request.cuisine_preferences,
                        'reason': 'learned_from_ratings'
                    })

            # 2. Apply preferred cooking times
            if not enhanced_request.max_prep_time_minutes and profile['preferred_prep_time_minutes']:
                enhanced_request.max_prep_time_minutes = int(profile['preferred_prep_time_minutes'] * 1.2)  # 20% buffer
                personalization_metadata['enhancements'].append({
                    'type': 'prep_time',
                    'value': enhanced_request.max_prep_time_minutes,
                    'learned_preference': profile['preferred_prep_time_minutes']
                })

            if not enhanced_request.max_cook_time_minutes and profile['preferred_cook_time_minutes']:
                enhanced_request.max_cook_time_minutes = int(profile['preferred_cook_time_minutes'] * 1.2)
                personalization_metadata['enhancements'].append({
                    'type': 'cook_time',
                    'value': enhanced_request.max_cook_time_minutes,
                    'learned_preference': profile['preferred_cook_time_minutes']
                })

            # 3. Apply nutritional preferences
            if not enhanced_request.target_calories_per_serving:
                enhanced_request.target_calories_per_serving = profile['preferred_calories_per_serving']
                personalization_metadata['enhancements'].append({
                    'type': 'calories',
                    'value': enhanced_request.target_calories_per_serving,
                    'reason': 'learned_preference'
                })

            # 4. Exclude strongly disliked ingredients
            disliked_ingredients = [
                ing['ingredient'] for ing in profile['disliked_ingredients']
                if ing['preference'] < -0.5
            ]

            if disliked_ingredients:
                # Add to excluded ingredients, avoiding duplicates
                new_excluded = list(set(enhanced_request.excluded_ingredients + disliked_ingredients))
                if len(new_excluded) > len(enhanced_request.excluded_ingredients):
                    enhanced_request.excluded_ingredients = new_excluded
                    personalization_metadata['enhancements'].append({
                        'type': 'excluded_ingredients',
                        'added': [ing for ing in disliked_ingredients if ing not in enhanced_request.excluded_ingredients],
                        'reason': 'strongly_disliked'
                    })

            # 5. Prefer liked ingredients
            liked_ingredients = [
                ing['ingredient'] for ing in profile['liked_ingredients']
                if ing['preference'] > 0.5
            ]

            if liked_ingredients:
                # Add top 5 liked ingredients to available ingredients list
                new_available = list(set(enhanced_request.available_ingredients + liked_ingredients[:5]))
                if len(new_available) > len(enhanced_request.available_ingredients):
                    enhanced_request.available_ingredients = new_available
                    personalization_metadata['enhancements'].append({
                        'type': 'available_ingredients',
                        'added': [ing for ing in liked_ingredients[:5] if ing not in enhanced_request.available_ingredients],
                        'reason': 'highly_rated'
                    })

            # 6. Adjust difficulty based on patterns
            if profile.get('modification_tendency', 0) > 0.7:
                # User often modifies recipes, might prefer easier ones
                if enhanced_request.difficulty_preference == 'hard':
                    enhanced_request.difficulty_preference = 'medium'
                    personalization_metadata['enhancements'].append({
                        'type': 'difficulty',
                        'from': 'hard',
                        'to': 'medium',
                        'reason': 'high_modification_tendency'
                    })

            return enhanced_request, personalization_metadata

        except Exception as e:
            logger.error(f"Error applying personalization for user {user_id}: {e}")
            return request, {'applied': False, 'error': str(e)}

    async def score_recipe_personalization(self, recipe: GeneratedRecipe, user_id: str) -> Dict[str, Any]:
        """
        Score how well a generated recipe matches user's taste profile
        Returns personalization scoring metrics
        """
        try:
            # Get user's taste profile
            profile = await self.db_service.get_user_taste_profile(user_id)

            if not profile:
                return {
                    'overall_score': 0.0,
                    'cuisine_score': 0.0,
                    'ingredient_score': 0.0,
                    'time_score': 0.0,
                    'nutrition_score': 0.0,
                    'confidence': 0.0,
                    'explanation': 'No taste profile available'
                }

            # Calculate individual scoring components
            cuisine_score = self._score_cuisine_match(recipe, profile)
            ingredient_score = self._score_ingredient_match(recipe, profile)
            time_score = self._score_time_match(recipe, profile)
            nutrition_score = self._score_nutrition_match(recipe, profile)

            # Calculate weighted overall score
            weights = {
                'cuisine': 0.35,
                'ingredient': 0.30,
                'time': 0.20,
                'nutrition': 0.15
            }

            overall_score = (
                cuisine_score * weights['cuisine'] +
                ingredient_score * weights['ingredient'] +
                time_score * weights['time'] +
                nutrition_score * weights['nutrition']
            )

            return {
                'overall_score': round(overall_score, 3),
                'cuisine_score': round(cuisine_score, 3),
                'ingredient_score': round(ingredient_score, 3),
                'time_score': round(time_score, 3),
                'nutrition_score': round(nutrition_score, 3),
                'confidence': profile['profile_confidence'],
                'explanation': self._generate_score_explanation(
                    cuisine_score, ingredient_score, time_score, nutrition_score
                )
            }

        except Exception as e:
            logger.error(f"Error scoring recipe personalization for user {user_id}: {e}")
            return {
                'overall_score': 0.0,
                'error': str(e)
            }

    def _score_cuisine_match(self, recipe: GeneratedRecipe, profile: Dict[str, Any]) -> float:
        """Score how well recipe cuisine matches user preferences"""
        cuisine_preferences = profile.get('cuisine_preferences', [])

        if not cuisine_preferences:
            return 0.5  # Neutral score if no preferences

        # Find matching cuisine preference
        recipe_cuisine = recipe.cuisine_type.lower()
        for pref in cuisine_preferences:
            if pref['cuisine'].lower() == recipe_cuisine:
                # Convert preference score (-1 to 1) to 0 to 1 scale
                return max(0.0, min(1.0, (pref['score'] + 1.0) / 2.0))

        # If no exact match, return average preference for unknown cuisines
        avg_score = statistics.mean([pref['score'] for pref in cuisine_preferences])
        return max(0.0, min(1.0, (avg_score + 1.0) / 2.0))

    def _score_ingredient_match(self, recipe: GeneratedRecipe, profile: Dict[str, Any]) -> float:
        """Score how well recipe ingredients match user preferences"""
        liked_ingredients = profile.get('liked_ingredients', [])
        disliked_ingredients = profile.get('disliked_ingredients', [])

        if not liked_ingredients and not disliked_ingredients:
            return 0.5  # Neutral score

        recipe_ingredients = [ing.name.lower() for ing in recipe.ingredients]

        positive_score = 0.0
        negative_score = 0.0
        matches = 0

        # Check for liked ingredients
        for liked in liked_ingredients:
            ingredient_name = liked['ingredient'].lower()
            if any(ingredient_name in recipe_ing for recipe_ing in recipe_ingredients):
                positive_score += liked['preference']
                matches += 1

        # Check for disliked ingredients
        for disliked in disliked_ingredients:
            ingredient_name = disliked['ingredient'].lower()
            if any(ingredient_name in recipe_ing for recipe_ing in recipe_ingredients):
                negative_score += abs(disliked['preference'])  # Penalty
                matches += 1

        if matches == 0:
            return 0.5  # No ingredient matches, neutral

        # Calculate net score (positive - negative, normalized)
        net_score = (positive_score - negative_score) / matches
        return max(0.0, min(1.0, (net_score + 1.0) / 2.0))

    def _score_time_match(self, recipe: GeneratedRecipe, profile: Dict[str, Any]) -> float:
        """Score how well recipe timing matches user preferences"""
        preferred_prep = profile.get('preferred_prep_time_minutes', 30)
        preferred_cook = profile.get('preferred_cook_time_minutes', 45)

        # Calculate time preference scores (closer = better)
        prep_diff = abs(recipe.prep_time_minutes - preferred_prep)
        cook_diff = abs(recipe.cook_time_minutes - preferred_cook)

        # Convert differences to scores (max penalty of 30 minutes)
        prep_score = max(0.0, 1.0 - (prep_diff / 30.0))
        cook_score = max(0.0, 1.0 - (cook_diff / 45.0))

        return (prep_score + cook_score) / 2.0

    def _score_nutrition_match(self, recipe: GeneratedRecipe, profile: Dict[str, Any]) -> float:
        """Score how well recipe nutrition matches user preferences"""
        if not recipe.nutrition:
            return 0.5  # Can't score without nutrition data

        preferred_calories = profile.get('preferred_calories_per_serving', 400)

        # Score based on calorie preference match
        calorie_diff = abs(recipe.nutrition.calories_per_serving - preferred_calories)
        calorie_score = max(0.0, 1.0 - (calorie_diff / 200.0))  # Max penalty of 200 calories

        # Could expand to include protein/fat/carb ratios if needed
        return calorie_score

    def _calculate_nutritional_quality(self, nutriments: Optional[Nutriments]) -> float:
        """Legacy helper retained for compatibility with historical tests."""

        if nutriments is None:
            return 0.0

        try:
            protein = nutriments.protein_g_per_100g or 0.0
            fiber = getattr(nutriments, "fiber_g_per_100g", None) or 0.0
            sugars = nutriments.sugars_g_per_100g or 0.0
            salt = nutriments.salt_g_per_100g or 0.0

            positive = protein + fiber
            negative = sugars + salt

            score = positive - 0.5 * negative
            return max(0.0, min(1.0, score / 20.0))
        except Exception as exc:
            logger.warning(f"Failed to calculate nutritional quality: {exc}")
            return 0.0

    def _generate_score_explanation(self, cuisine_score: float, ingredient_score: float,
                                  time_score: float, nutrition_score: float) -> str:
        """Generate human-readable explanation of personalization score"""
        explanations = []

        if cuisine_score > 0.7:
            explanations.append("matches your favorite cuisines")
        elif cuisine_score < 0.3:
            explanations.append("cuisine doesn't match your usual preferences")

        if ingredient_score > 0.7:
            explanations.append("includes ingredients you typically enjoy")
        elif ingredient_score < 0.3:
            explanations.append("contains ingredients you tend to avoid")

        if time_score > 0.7:
            explanations.append("fits your preferred cooking time")
        elif time_score < 0.3:
            explanations.append("requires more/less time than you typically prefer")

        if nutrition_score > 0.7:
            explanations.append("aligns with your nutritional preferences")

        if not explanations:
            return "moderately matches your taste profile"

        return "; ".join(explanations)


# Global recommendation engine instance
recommendation_engine = RecommendationEngine()


class SmartRecommendationEngine(RecommendationEngine):
    """Backward-compatible alias for legacy tests and integrations."""

    pass

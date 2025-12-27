"""
Nutrition Match Scorer

Scores how well a recipe's nutritional content matches the user's nutritional preferences.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import GeneratedRecipe
from app.services.recommendations.scorers.base_scorer import RecipeScorer

logger = logging.getLogger(__name__)


class NutritionScorer(RecipeScorer):
    """
    Scorer that evaluates nutritional content match between recipe and user preferences.

    Currently focuses on calorie preference matching.
    Can be extended to evaluate macro ratios (protein/fat/carbs).

    Extracted from: recommendation_engine.py lines 333-345
    """

    def __init__(
        self,
        preferred_calories_per_serving: float = 400.0,
        max_calorie_penalty: float = 200.0
    ):
        """
        Initialize nutrition scorer with calorie preferences.

        Args:
            preferred_calories_per_serving: User's preferred serving calories (default 400)
            max_calorie_penalty: Max penalty for calorie deviation (default 200 kcal)
        """
        self.preferred_calories_per_serving = preferred_calories_per_serving
        self.max_calorie_penalty = max_calorie_penalty

    def score(
        self,
        recipe: GeneratedRecipe,
        profile: Dict[str, Any]
    ) -> float:
        """Score how well recipe nutrition matches user preferences."""

        # If no nutrition data, neutral score
        if not recipe.nutrition:
            return 0.5

        # Get profile preference or use default
        preferred_calories = profile.get(
            'preferred_calories_per_serving',
            self.preferred_calories_per_serving
        )

        # Score based on calorie preference match
        recipe_calories = recipe.nutrition.calories_per_serving or 0.0
        calorie_diff = abs(recipe_calories - preferred_calories)
        calorie_score = max(0.0, 1.0 - (calorie_diff / self.max_calorie_penalty))

        # Could extend to include protein/fat/carb ratios if needed
        # For now, calorie score is the primary signal
        return calorie_score

    def explain(self, score: float) -> str:
        """Generate explanation for nutrition score."""
        if score >= 0.7:
            return "aligns with your nutritional preferences"
        elif score <= 0.3:
            return "nutritional content differs from your preferences"
        else:
            return "nutritional content is moderately aligned with your preferences"

    def get_scorer_type(self) -> str:
        """Get scorer type."""
        return "nutrition"

    def get_scorer_name(self) -> str:
        """Get scorer name."""
        return "Nutrition Match Scorer"

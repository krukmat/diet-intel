"""
Ingredient Match Scorer

Scores how well a recipe's ingredients match the user's liked and disliked ingredients.

Task: Phase 2 Tarea 4 - Recommendation Engine Refactoring
"""

import logging
from typing import Dict, Any

from app.services.recipe_ai_engine import GeneratedRecipe
from app.services.recommendations.scorers.base_scorer import RecipeScorer

logger = logging.getLogger(__name__)


class IngredientScorer(RecipeScorer):
    """
    Scorer that evaluates ingredient match between recipe and user preferences.

    Evaluates both liked ingredients (positive) and disliked ingredients (negative).
    Scores based on the net effect of preferences found in the recipe.

    Extracted from: recommendation_engine.py lines 283-316
    """

    def score(
        self,
        recipe: GeneratedRecipe,
        profile: Dict[str, Any]
    ) -> float:
        """Score how well recipe ingredients match user preferences."""

        liked_ingredients = profile.get('liked_ingredients', [])
        disliked_ingredients = profile.get('disliked_ingredients', [])

        # If no preference data, neutral score
        if not liked_ingredients and not disliked_ingredients:
            return 0.5

        # Get recipe ingredient names
        recipe_ingredients = [ing.name.lower() for ing in recipe.ingredients] \
            if recipe.ingredients else []

        positive_score = 0.0
        negative_score = 0.0
        matches = 0

        # Check for liked ingredients (positive contribution)
        for liked in liked_ingredients:
            ingredient_name = liked.get('ingredient', '').lower()
            if ingredient_name and any(ingredient_name in recipe_ing for recipe_ing in recipe_ingredients):
                positive_score += liked.get('preference', 0.0)
                matches += 1

        # Check for disliked ingredients (negative contribution)
        for disliked in disliked_ingredients:
            ingredient_name = disliked.get('ingredient', '').lower()
            if ingredient_name and any(ingredient_name in recipe_ing for recipe_ing in recipe_ingredients):
                negative_score += abs(disliked.get('preference', 0.0))  # Penalty
                matches += 1

        # No ingredient matches, neutral score
        if matches == 0:
            return 0.5

        # Calculate net score (positive - negative, normalized)
        net_score = (positive_score - negative_score) / matches
        return max(0.0, min(1.0, (net_score + 1.0) / 2.0))

    def explain(self, score: float) -> str:
        """Generate explanation for ingredient score."""
        if score >= 0.7:
            return "includes ingredients you typically enjoy"
        elif score <= 0.3:
            return "contains ingredients you tend to avoid"
        else:
            return "ingredient mix is moderately aligned with your preferences"

    def get_scorer_type(self) -> str:
        """Get scorer type."""
        return "ingredient"

    def get_scorer_name(self) -> str:
        """Get scorer name."""
        return "Ingredient Match Scorer"

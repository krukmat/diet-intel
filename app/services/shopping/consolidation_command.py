"""
Consolidation Command for Shopping Optimization

Consolidates similar ingredients from multiple recipes.
Uses existing IngredientConsolidator logic wrapped as a Command.

Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
"""

import logging
from typing import List, Optional

from app.services.shopping_optimization import IngredientConsolidator, IngredientMatcher
from .base_command import OptimizationCommand
from .optimization_context import OptimizationContext, RecipeIngredient, ConsolidatedIngredient

logger = logging.getLogger(__name__)


class ConsolidationCommand(OptimizationCommand):
    """Command to consolidate similar ingredients.

    Extracts all ingredients from recipes and groups similar items together,
    optimizing quantities and choosing best names for consolidated ingredients.
    """

    def __init__(self):
        """Initialize consolidation command with matcher and consolidator."""
        self.matcher = IngredientMatcher()
        self.consolidator = IngredientConsolidator()

    async def execute(self, context: OptimizationContext) -> None:
        """Execute ingredient consolidation.

        Extracts ingredients from recipes and consolidates similar ones.
        Populates context with consolidated_ingredients and updates metrics.

        Args:
            context: OptimizationContext to update with consolidated ingredients
        """
        try:
            # Extract all ingredients from recipes
            self._extract_ingredients(context)

            if not context.all_ingredients:
                logger.warning("No ingredients found to consolidate")
                return

            # Consolidate ingredients using existing consolidator
            consolidation_input = self._prepare_consolidation_input(context.all_ingredients)
            consolidated = self.consolidator.consolidate_ingredients(consolidation_input)

            # Convert results to ConsolidatedIngredient objects
            for ing in consolidated:
                consolidated_ing = ConsolidatedIngredient(
                    name=ing.get('ingredient_name', ''),
                    quantity=ing.get('quantity', 0),
                    unit=ing.get('unit', ''),
                    sources=ing.get('sources', []),
                    confidence=ing.get('confidence', 1.0)
                )
                context.consolidated_ingredients.append(consolidated_ing)

            # Update metrics
            context.metrics['consolidation'] = {
                'input_ingredients': len(context.all_ingredients),
                'consolidated_ingredients': len(context.consolidated_ingredients),
                'consolidation_ratio': len(context.all_ingredients) / max(len(context.consolidated_ingredients), 1)
            }

            logger.info(
                f"Consolidated {len(context.all_ingredients)} ingredients into "
                f"{len(context.consolidated_ingredients)} groups"
            )

        except Exception as e:
            logger.error(f"Error in consolidation command: {e}")
            context.add_error(f"Consolidation failed: {str(e)}")
            raise

    def get_command_name(self) -> str:
        """Get command name for logging."""
        return "Ingredient Consolidation"

    def _extract_ingredients(self, context: OptimizationContext) -> None:
        """Extract ingredients from recipe data.

        Args:
            context: Context to populate with all_ingredients
        """
        for recipe in context.recipes_data:
            recipe_id = recipe.get('id', 'unknown')
            ingredients = recipe.get('ingredients', [])

            for ing_data in ingredients:
                ingredient = RecipeIngredient(
                    name=ing_data.get('ingredient_name', ''),
                    quantity=ing_data.get('quantity', 0),
                    unit=ing_data.get('unit', ''),
                    recipe_id=recipe_id,
                    calories_per_unit=ing_data.get('calories_per_unit'),
                    protein_g_per_unit=ing_data.get('protein_g_per_unit'),
                    fat_g_per_unit=ing_data.get('fat_g_per_unit'),
                    carbs_g_per_unit=ing_data.get('carbs_g_per_unit'),
                )
                context.all_ingredients.append(ingredient)

    def _prepare_consolidation_input(self, ingredients: List[RecipeIngredient]) -> List[dict]:
        """Prepare ingredients for consolidator in expected format.

        Args:
            ingredients: List of RecipeIngredient objects

        Returns:
            List of dictionaries in format expected by IngredientConsolidator
        """
        return [
            {
                'ingredient_name': ing.name,
                'quantity': ing.quantity,
                'unit': ing.unit,
                'recipe_id': ing.recipe_id,
            }
            for ing in ingredients
        ]

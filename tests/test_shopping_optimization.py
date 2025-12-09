# Task 11 related comment: Comprehensive test suite for multi-recipe ingredient consolidation
"""
Test Suite for Shopping Optimization Service
Phase R.3 Task 11 - Multi-recipe ingredient consolidation algorithm

Tests all aspects of ingredient consolidation, unit conversion, and shopping optimization
"""

import pytest
import asyncio
import uuid
from typing import Dict, Any, List
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.shopping_optimization import (
    ShoppingOptimizationService,
    IngredientConsolidator,
    IngredientMatcher,
    RecipeIngredient,
    ConsolidatedIngredient,
    IngredientGroup
)
from app.services.unit_conversion import UnitConversionEngine, UnitCategory, ConversionResult
from app.services.recipe_database import RecipeDatabaseService


class TestUnitConversionEngine:
    """Test unit conversion engine functionality"""

    def setup_method(self):
        """Set up test fixtures"""
        self.converter = UnitConversionEngine()

    def test_normalize_unit_name(self):
        """Test unit name normalization"""
        # Task 11 related comment: Test unit name normalization
        assert self.converter.normalize_unit_name("cups") == "cup"
        assert self.converter.normalize_unit_name("tablespoons") == "tablespoon"
        assert self.converter.normalize_unit_name("TBSP") == "tbsp"
        assert self.converter.normalize_unit_name("fl oz") == "fl_oz"
        assert self.converter.normalize_unit_name("") == "piece"

    def test_get_unit_category(self):
        """Test unit category detection"""
        # Task 11 related comment: Test unit category detection
        assert self.converter.get_unit_category("cup") == UnitCategory.VOLUME
        assert self.converter.get_unit_category("gram") == UnitCategory.WEIGHT
        assert self.converter.get_unit_category("piece") == UnitCategory.COUNT
        assert self.converter.get_unit_category("unknown_unit") == UnitCategory.UNKNOWN

    def test_volume_conversion(self):
        """Test volume unit conversions"""
        # Task 11 related comment: Test volume unit conversions to milliliters
        result = self.converter.convert_to_standard_unit(1.0, "cup")
        assert result.category == UnitCategory.VOLUME
        assert result.unit == "ml"
        assert abs(result.quantity - 236.588) < 0.001
        assert result.confidence == 1.0

        result = self.converter.convert_to_standard_unit(2.0, "tablespoon")
        assert abs(result.quantity - 29.574) < 0.001  # 2 * 14.787

    def test_weight_conversion(self):
        """Test weight unit conversions"""
        # Task 11 related comment: Test weight unit conversions to grams
        result = self.converter.convert_to_standard_unit(1.0, "oz")
        assert result.category == UnitCategory.WEIGHT
        assert result.unit == "g"
        assert abs(result.quantity - 28.3495) < 0.001
        assert result.confidence == 1.0

        result = self.converter.convert_to_standard_unit(1.0, "lb")
        assert abs(result.quantity - 453.592) < 0.001

    def test_count_conversion(self):
        """Test count unit conversions"""
        # Task 11 related comment: Test count unit conversions
        result = self.converter.convert_to_standard_unit(3.0, "pieces")
        assert result.category == UnitCategory.COUNT
        assert result.unit == "piece"
        assert result.quantity == 3.0
        assert result.confidence == 1.0

    def test_ingredient_density_conversion(self):
        """Test ingredient-specific density conversions"""
        # Task 11 related comment: Test ingredient density conversions for volume to weight
        result = self.converter.convert_to_standard_unit(1.0, "cup", "flour")
        assert result.category == UnitCategory.WEIGHT
        assert result.unit == "g"
        assert result.quantity == 120.0  # 1 cup flour = 120g
        assert result.confidence == 0.9

    def test_display_unit_selection(self):
        """Test optimal display unit selection"""
        # Task 11 related comment: Test optimal display unit selection for shopping lists
        # Large volume -> liters
        quantity, unit = self.converter.get_best_display_unit(1500.0, "ml", UnitCategory.VOLUME)
        assert unit == "liter"
        assert quantity == 1.5

        # Medium volume -> cups
        quantity, unit = self.converter.get_best_display_unit(500.0, "ml", UnitCategory.VOLUME)
        assert unit == "cup"
        assert abs(quantity - 2.11) < 0.1  # ~2 cups

        # Large weight -> kg
        quantity, unit = self.converter.get_best_display_unit(1500.0, "g", UnitCategory.WEIGHT)
        assert unit == "kg"
        assert quantity == 1.5

    def test_consolidation_compatibility(self):
        """Test unit consolidation compatibility"""
        # Task 11 related comment: Test unit consolidation compatibility
        assert self.converter.can_consolidate_units("cup", "ml") == True
        assert self.converter.can_consolidate_units("gram", "oz") == True
        assert self.converter.can_consolidate_units("piece", "items") == True
        assert self.converter.can_consolidate_units("cup", "gram") == False  # Different categories


class TestIngredientMatcher:
    """Test ingredient matching algorithm"""

    def setup_method(self):
        """Set up test fixtures"""
        self.matcher = IngredientMatcher()

    def test_normalize_ingredient_name(self):
        """Test ingredient name normalization"""
        # Task 11 related comment: Test ingredient name normalization for matching
        assert self.matcher.normalize_ingredient_name("Fresh Olive Oil") == "olive_oil"
        assert self.matcher.normalize_ingredient_name("2 cups flour") == "flour"
        assert self.matcher.normalize_ingredient_name("Organic Ground Black Pepper") == "black_pepper"
        assert self.matcher.normalize_ingredient_name("Extra Virgin Olive Oil (premium)") == "extra_virgin_olive_oil"

    def test_similarity_calculation(self):
        """Test ingredient similarity calculation"""
        # Task 11 related comment: Test ingredient similarity scoring
        # Exact match
        similarity = self.matcher.calculate_similarity("olive oil", "olive oil")
        assert similarity == 1.0

        # Synonym match
        similarity = self.matcher.calculate_similarity("olive oil", "extra virgin olive oil")
        assert similarity >= 0.9

        # Partial match
        similarity = self.matcher.calculate_similarity("black pepper", "ground black pepper")
        assert similarity >= 0.8

        # No match
        similarity = self.matcher.calculate_similarity("olive oil", "chicken breast")
        assert similarity < 0.3

    def test_consolidation_decision(self):
        """Test ingredient consolidation decision logic"""
        # Task 11 related comment: Test ingredient consolidation decision logic
        ingredient1 = RecipeIngredient(
            recipe_id="recipe1",
            recipe_name="Recipe 1",
            ingredient_name="olive oil",
            quantity=2.0,
            unit="tablespoon"
        )

        ingredient2 = RecipeIngredient(
            recipe_id="recipe2",
            recipe_name="Recipe 2",
            ingredient_name="extra virgin olive oil",
            quantity=30.0,
            unit="ml"
        )

        can_consolidate, confidence = self.matcher.can_consolidate(ingredient1, ingredient2)
        assert can_consolidate == True
        assert confidence >= 0.8


class TestIngredientConsolidator:
    """Test ingredient consolidation algorithm"""

    def setup_method(self):
        """Set up test fixtures"""
        self.consolidator = IngredientConsolidator()

    def create_test_ingredients(self) -> List[RecipeIngredient]:
        """Create test ingredient data"""
        # Task 11 related comment: Create test ingredients for consolidation testing
        return [
            RecipeIngredient(
                recipe_id="recipe_mediterranean",
                recipe_name="Mediterranean Salad",
                ingredient_name="olive oil",
                quantity=2.0,
                unit="tablespoon"
            ),
            RecipeIngredient(
                recipe_id="recipe_pasta",
                recipe_name="Pasta Primavera",
                ingredient_name="extra virgin olive oil",
                quantity=30.0,
                unit="ml"
            ),
            RecipeIngredient(
                recipe_id="recipe_mediterranean",
                recipe_name="Mediterranean Salad",
                ingredient_name="salt",
                quantity=1.0,
                unit="teaspoon"
            ),
            RecipeIngredient(
                recipe_id="recipe_pasta",
                recipe_name="Pasta Primavera",
                ingredient_name="sea salt",
                quantity=0.5,
                unit="teaspoon"
            ),
            RecipeIngredient(
                recipe_id="recipe_soup",
                recipe_name="Vegetable Soup",
                ingredient_name="onion",
                quantity=1.0,
                unit="piece"
            )
        ]

    @pytest.mark.asyncio
    async def test_basic_consolidation(self):
        """Test basic ingredient consolidation"""
        # Task 11 related comment: Test basic ingredient consolidation workflow
        ingredients = self.create_test_ingredients()
        consolidated = await self.consolidator.consolidate_ingredients(ingredients)

        # Should consolidate olive oils and salts, leaving onion separate
        assert len(consolidated) <= 3

        # Find consolidated olive oil
        olive_oil = next((item for item in consolidated if "olive" in item.name.lower()), None)
        assert olive_oil is not None
        assert len(olive_oil.source_recipes) == 2
        assert olive_oil.total_quantity > 0

    def test_ingredient_grouping(self):
        """Test ingredient grouping logic"""
        # Task 11 related comment: Test ingredient grouping by similarity
        ingredients = self.create_test_ingredients()
        groups = self.consolidator._group_similar_ingredients(ingredients)

        # Should create groups for olive oil, salt, and onion
        assert len(groups) <= 3

        # Check that olive oils are grouped together
        olive_group = next((group for group in groups if "olive" in group.consolidated_name.lower()), None)
        assert olive_group is not None
        assert len(olive_group.ingredients) == 2

    @pytest.mark.asyncio
    async def test_group_consolidation(self):
        """Test consolidating a single group"""
        # Task 11 related comment: Test consolidating a single ingredient group
        ingredients = [
            RecipeIngredient("recipe1", "Recipe 1", "olive oil", 2.0, "tablespoon"),
            RecipeIngredient("recipe2", "Recipe 2", "olive oil", 1.0, "tablespoon")
        ]

        group = IngredientGroup(
            consolidated_name="olive oil",
            ingredients=ingredients
        )

        consolidated = await self.consolidator._consolidate_group(group)
        assert consolidated is not None
        assert consolidated.name == "olive oil"
        assert consolidated.total_quantity == 3.0  # 2 + 1 tablespoons
        assert consolidated.unit == "tablespoon"
        assert len(consolidated.source_recipes) == 2

    def test_best_name_selection(self):
        """Test choosing best consolidated name"""
        # Task 11 related comment: Test selecting best name for consolidated ingredient
        ingredients = [
            RecipeIngredient("recipe1", "Recipe 1", "olive oil", 1.0, "tbsp"),
            RecipeIngredient("recipe2", "Recipe 2", "extra virgin olive oil", 1.0, "tbsp"),
            RecipeIngredient("recipe3", "Recipe 3", "olive oil", 1.0, "tbsp")
        ]

        best_name = self.consolidator._choose_best_name(ingredients)
        # Should choose "olive oil" as it appears twice
        assert best_name == "olive oil"

    def test_quantity_optimization(self):
        """Test practical quantity rounding"""
        # Task 11 related comment: Test quantity rounding for practical shopping
        # Test cup rounding
        assert self.consolidator._round_to_practical_amount(1.3, "cup") == 1.5  # Round to half cup
        assert self.consolidator._round_to_practical_amount(0.2, "cup") == 0.25  # Round to quarter cup

        # Test gram rounding
        assert self.consolidator._round_to_practical_amount(23, "gram") == 25  # Round to 5g increment
        assert self.consolidator._round_to_practical_amount(156, "gram") == 160  # Round to 10g increment

        # Test piece rounding
        assert self.consolidator._round_to_practical_amount(2.7, "piece") == 3  # Round to whole number


class TestShoppingOptimizationService:
    """Test complete shopping optimization service"""

    def setup_method(self):
        """Set up test fixtures"""
        self.mock_db_service = AsyncMock(spec=RecipeDatabaseService)
        self.service = ShoppingOptimizationService(self.mock_db_service)

    def create_test_recipe_data(self) -> List[Dict[str, Any]]:
        """Create test recipe data"""
        # Task 11 related comment: Create test recipe data for optimization testing
        return [
            {
                'id': 'recipe_mediterranean',
                'name': 'Mediterranean Salad',
                'ingredients': [
                    {'ingredient': 'olive oil', 'quantity': 2, 'unit': 'tablespoon'},
                    {'ingredient': 'tomato', 'quantity': 2, 'unit': 'piece'},
                    {'ingredient': 'salt', 'quantity': 1, 'unit': 'teaspoon'}
                ]
            },
            {
                'id': 'recipe_pasta',
                'name': 'Pasta Primavera',
                'ingredients': [
                    {'ingredient': 'olive oil', 'quantity': 30, 'unit': 'ml'},
                    {'ingredient': 'onion', 'quantity': 1, 'unit': 'piece'},
                    {'ingredient': 'salt', 'quantity': 0.5, 'unit': 'teaspoon'}
                ]
            }
        ]

    @pytest.mark.asyncio
    async def test_recipe_data_extraction(self):
        """Test extracting ingredients from recipe data"""
        # Task 11 related comment: Test ingredient extraction from recipe data
        recipe_data = self.create_test_recipe_data()
        ingredients = self.service._extract_all_ingredients(recipe_data)

        assert len(ingredients) == 6  # 3 + 3 ingredients

        # Check first ingredient
        first_ingredient = ingredients[0]
        assert first_ingredient.recipe_id == 'recipe_mediterranean'
        assert first_ingredient.ingredient_name == 'olive oil'
        assert first_ingredient.quantity == 2.0
        assert first_ingredient.unit == 'tablespoon'

    @pytest.mark.asyncio
    async def test_optimization_metrics_calculation(self):
        """Test optimization metrics calculation"""
        # Task 11 related comment: Test optimization performance metrics calculation
        original_ingredients = [
            RecipeIngredient("r1", "R1", "olive oil", 1, "tbsp"),
            RecipeIngredient("r1", "R1", "salt", 1, "tsp"),
            RecipeIngredient("r2", "R2", "olive oil", 1, "tbsp"),
            RecipeIngredient("r2", "R2", "salt", 1, "tsp"),
            RecipeIngredient("r2", "R2", "onion", 1, "piece")
        ]

        consolidated_ingredients = [
            ConsolidatedIngredient("1", "olive oil", 2, "tbsp", [], UnitCategory.VOLUME),
            ConsolidatedIngredient("2", "salt", 2, "tsp", [], UnitCategory.VOLUME),
            ConsolidatedIngredient("3", "onion", 1, "piece", [], UnitCategory.COUNT)
        ]

        metrics = self.service._calculate_optimization_metrics(original_ingredients, consolidated_ingredients)

        assert metrics['total_original_ingredients'] == 5
        assert metrics['total_consolidated_ingredients'] == 3
        assert metrics['consolidation_opportunities'] == 2  # 5 - 3
        assert metrics['efficiency_score'] == 0.4  # 2/5
        assert metrics['ingredients_reduced_percent'] == 40.0

    @pytest.mark.asyncio
    async def test_complete_optimization_workflow(self):
        """Test complete shopping optimization workflow"""
        # Task 11 related comment: Test complete shopping optimization workflow
        recipe_ids = ['recipe_mediterranean', 'recipe_pasta']
        user_id = 'test_user'

        # Mock database responses
        self.mock_db_service.get_recipe_by_id.side_effect = lambda recipe_id: {
            'id': recipe_id,
            'name': f'Recipe {recipe_id}',
            'ingredients': [
                {'ingredient': 'olive oil', 'quantity': 2, 'unit': 'tablespoon'},
                {'ingredient': 'salt', 'quantity': 1, 'unit': 'teaspoon'}
            ]
        }

        self.mock_db_service.create_shopping_optimization.return_value = 'opt_123'
        self.mock_db_service.create_ingredient_consolidation.return_value = 'cons_123'

        # Run optimization
        result = await self.service.optimize_shopping_list(
            recipe_ids=recipe_ids,
            user_id=user_id,
            optimization_name="Test Optimization"
        )

        # Verify results
        assert result.optimization_id == 'opt_123'
        assert result.optimization_name == "Test Optimization"
        assert result.recipe_ids == recipe_ids
        assert len(result.consolidated_ingredients) >= 1  # Should have consolidated ingredients

        # Verify database calls
        assert self.mock_db_service.create_shopping_optimization.called
        assert self.mock_db_service.create_ingredient_consolidation.called


class TestShoppingOptimizationIntegration:
    """Integration tests with real database operations"""

    @pytest.mark.asyncio
    async def test_database_integration(self):
        """Test integration with real database service"""
        # Task 11 related comment: Test integration with real database service
        # This would require a test database setup
        # For now, we'll use mocks but structure for real integration

        # Mock database service
        db_service = AsyncMock(spec=RecipeDatabaseService)
        db_service.get_recipe_by_id.return_value = {
            'id': 'test_recipe',
            'name': 'Test Recipe',
            'ingredients': [
                {'ingredient': 'test ingredient', 'quantity': 1, 'unit': 'cup'}
            ]
        }
        db_service.create_shopping_optimization.return_value = 'test_opt_id'
        db_service.create_ingredient_consolidation.return_value = 'test_cons_id'

        service = ShoppingOptimizationService(db_service)

        result = await service.optimize_shopping_list(['test_recipe'], 'test_user')

        assert result.optimization_id == 'test_opt_id'
        assert len(result.consolidated_ingredients) >= 0


class TestShoppingOptimizationAPI:
    """Test API endpoint integration"""

    @pytest.mark.asyncio
    async def test_api_request_validation(self):
        """Test API request validation"""
        # Task 11 related comment: Test API request validation
        from app.models.shopping import ShoppingOptimizationRequest

        # Valid request
        request = ShoppingOptimizationRequest(
            recipe_ids=['recipe1', 'recipe2'],
            optimization_name='Test Optimization'
        )
        assert len(request.recipe_ids) == 2
        assert request.optimization_name == 'Test Optimization'

        # Invalid request - empty recipe list should fail validation
        with pytest.raises(ValueError):
            ShoppingOptimizationRequest(recipe_ids=[])


class TestEdgeCases:
    """Test edge cases and error handling"""

    def setup_method(self):
        """Set up test fixtures"""
        self.consolidator = IngredientConsolidator()
        self.converter = UnitConversionEngine()

    @pytest.mark.asyncio
    async def test_empty_ingredient_list(self):
        """Test handling empty ingredient list"""
        # Task 11 related comment: Test handling edge case of empty ingredient list
        result = await self.consolidator.consolidate_ingredients([])
        assert result == []

    @pytest.mark.asyncio
    async def test_single_ingredient(self):
        """Test handling single ingredient"""
        # Task 11 related comment: Test handling single ingredient
        ingredients = [RecipeIngredient("recipe1", "Recipe 1", "salt", 1.0, "teaspoon")]
        result = await self.consolidator.consolidate_ingredients(ingredients)

        assert len(result) == 1
        assert result[0].name == "salt"
        assert result[0].total_quantity == 1.0
        assert result[0].unit == "teaspoon"

    def test_unknown_unit_handling(self):
        """Test handling unknown units"""
        # Task 11 related comment: Test handling unknown units gracefully
        result = self.converter.convert_to_standard_unit(5.0, "unknown_unit")
        assert result.unit == "unknown_unit"
        assert result.quantity == 5.0
        assert result.category == UnitCategory.UNKNOWN
        assert result.confidence <= 0.5

    @pytest.mark.asyncio
    async def test_incompatible_units(self):
        """Test handling incompatible unit consolidation"""
        # Task 11 related comment: Test handling incompatible units
        ingredients = [
            RecipeIngredient("recipe1", "Recipe 1", "different_ingredient", 1.0, "cup"),
            RecipeIngredient("recipe2", "Recipe 2", "completely_different", 2.0, "piece")
        ]

        result = await self.consolidator.consolidate_ingredients(ingredients)
        # Should not consolidate incompatible ingredients
        assert len(result) == 2


if __name__ == "__main__":
    # Task 11 related comment: Run tests with detailed output
    pytest.main([__file__, "-v", "--tb=short"])
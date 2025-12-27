"""
Shopping Optimization Command Chain Integration Tests

Tests the complete command pipeline for shopping list optimization.
Verifies that ConsolidationCommand, BulkAnalysisCommand, and CostCalculationCommand
work together correctly through the OptimizationContext.

Task: Phase 2 Tarea 6 - Shopping Optimization Refactoring
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.shopping import (
    ConsolidationCommand,
    BulkAnalysisCommand,
    CostCalculationCommand,
    OptimizationContext,
    RecipeIngredient,
    ConsolidatedIngredient,
    BulkOpportunity,
)


class TestCommandChainIntegration:
    """Test integration of command pipeline"""

    @pytest.fixture
    def sample_recipes_data(self):
        """Sample recipe data for testing"""
        return [
            {
                'id': 'recipe_1',
                'name': 'Mediterranean Salad',
                'ingredients': [
                    {
                        'ingredient_name': 'olive oil',
                        'quantity': 50.0,
                        'unit': 'ml',
                        'calories_per_unit': 8.8,
                        'protein_g_per_unit': 0,
                        'fat_g_per_unit': 1.0,
                        'carbs_g_per_unit': 0,
                    },
                    {
                        'ingredient_name': 'salt',
                        'quantity': 5.0,
                        'unit': 'g',
                        'calories_per_unit': 0,
                        'protein_g_per_unit': 0,
                        'fat_g_per_unit': 0,
                        'carbs_g_per_unit': 0,
                    },
                ]
            },
            {
                'id': 'recipe_2',
                'name': 'Pasta with Oil',
                'ingredients': [
                    {
                        'ingredient_name': 'olive oil',
                        'quantity': 30.0,
                        'unit': 'ml',
                        'calories_per_unit': 8.8,
                        'protein_g_per_unit': 0,
                        'fat_g_per_unit': 1.0,
                        'carbs_g_per_unit': 0,
                    },
                    {
                        'ingredient_name': 'salt',
                        'quantity': 3.0,
                        'unit': 'g',
                        'calories_per_unit': 0,
                        'protein_g_per_unit': 0,
                        'fat_g_per_unit': 0,
                        'carbs_g_per_unit': 0,
                    },
                ]
            },
        ]

    @pytest.mark.asyncio
    async def test_consolidation_command_extracts_and_groups(self, sample_recipes_data):
        """Test ConsolidationCommand extracts and consolidates ingredients"""
        context = OptimizationContext(sample_recipes_data, 'test_user')
        command = ConsolidationCommand()

        # Execute consolidation
        await command.execute(context)

        # Verify context is populated
        assert len(context.all_ingredients) > 0, "Should extract all ingredients"
        assert len(context.consolidated_ingredients) > 0, "Should consolidate ingredients"
        assert len(context.consolidated_ingredients) < len(
            context.all_ingredients
        ), "Should reduce ingredient count through consolidation"

        # Verify metrics are recorded
        assert 'consolidation' in context.metrics
        assert context.metrics['consolidation']['input_ingredients'] > 0
        assert context.metrics['consolidation']['consolidated_ingredients'] > 0

    @pytest.mark.asyncio
    async def test_bulk_analysis_command_detects_opportunities(self, sample_recipes_data):
        """Test BulkAnalysisCommand detects bulk buying opportunities"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # First consolidate
        consolidation_cmd = ConsolidationCommand()
        await consolidation_cmd.execute(context)

        # Then analyze bulk opportunities
        bulk_cmd = BulkAnalysisCommand()
        await bulk_cmd.execute(context)

        # Verify bulk opportunities are detected
        assert 'bulk_analysis' in context.metrics
        assert context.metrics['bulk_analysis']['analyzed_ingredients'] > 0
        assert context.metrics['bulk_analysis']['bulk_opportunities'] >= 0

    @pytest.mark.asyncio
    async def test_cost_calculation_command_calculates_metrics(self, sample_recipes_data):
        """Test CostCalculationCommand calculates cost and savings metrics"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # First consolidate
        consolidation_cmd = ConsolidationCommand()
        await consolidation_cmd.execute(context)

        # Then analyze bulk opportunities
        bulk_cmd = BulkAnalysisCommand()
        await bulk_cmd.execute(context)

        # Finally calculate costs
        cost_cmd = CostCalculationCommand()
        await cost_cmd.execute(context)

        # Verify cost metrics
        assert context.total_cost > 0, "Should calculate total cost"
        assert context.estimated_savings >= 0, "Should calculate savings"
        assert 0.0 <= context.optimization_score <= 1.0, "Score should be 0-1"

        # Verify cost analysis metrics
        assert 'cost_analysis' in context.metrics
        assert 'total_ingredient_cost' in context.metrics['cost_analysis']
        assert 'bulk_savings' in context.metrics['cost_analysis']
        assert 'optimization_score' in context.metrics['cost_analysis']

    @pytest.mark.asyncio
    async def test_full_command_chain_execution(self, sample_recipes_data):
        """Test complete command chain from recipes to optimization score"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # Execute full pipeline
        consolidation_cmd = ConsolidationCommand()
        bulk_cmd = BulkAnalysisCommand()
        cost_cmd = CostCalculationCommand()

        await consolidation_cmd.execute(context)
        await bulk_cmd.execute(context)
        await cost_cmd.execute(context)

        # Verify complete context is populated
        assert len(context.all_ingredients) > 0
        assert len(context.consolidated_ingredients) > 0
        assert context.total_cost > 0
        assert 0.0 <= context.optimization_score <= 1.0

        # Verify all metrics recorded
        assert 'consolidation' in context.metrics
        assert 'bulk_analysis' in context.metrics
        assert 'cost_analysis' in context.metrics

    @pytest.mark.asyncio
    async def test_command_error_handling_consolidation(self, sample_recipes_data):
        """Test consolidation command error handling"""
        # Empty recipes data
        context = OptimizationContext([], 'test_user')
        command = ConsolidationCommand()

        # Should not raise, should log warning
        await command.execute(context)

        # Should have no ingredients
        assert len(context.all_ingredients) == 0
        assert len(context.consolidated_ingredients) == 0

    @pytest.mark.asyncio
    async def test_command_error_handling_bulk(self, sample_recipes_data):
        """Test bulk analysis command error handling"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # Skip consolidation, test bulk with no ingredients
        bulk_cmd = BulkAnalysisCommand()

        # Should not raise, should handle gracefully
        await bulk_cmd.execute(context)

        # Should have no opportunities
        assert len(context.bulk_opportunities) == 0

    @pytest.mark.asyncio
    async def test_command_error_handling_cost(self, sample_recipes_data):
        """Test cost calculation command error handling"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # Skip prior commands, test cost with no ingredients
        cost_cmd = CostCalculationCommand()

        # Should not raise, should handle gracefully
        await cost_cmd.execute(context)

        # Should have default values
        assert context.total_cost == 0.0
        assert context.estimated_savings == 0.0
        assert context.optimization_score == 0.0

    @pytest.mark.asyncio
    async def test_context_persistence_across_commands(self, sample_recipes_data):
        """Test that OptimizationContext properly persists state across commands"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # Execute first command
        consolidation_cmd = ConsolidationCommand()
        await consolidation_cmd.execute(context)
        initial_ingredient_count = len(context.consolidated_ingredients)

        # Execute second command (should not lose first command's results)
        bulk_cmd = BulkAnalysisCommand()
        await bulk_cmd.execute(context)
        assert (
            len(context.consolidated_ingredients) == initial_ingredient_count
        ), "Consolidation results should persist"

        # Execute third command (should not lose prior results)
        cost_cmd = CostCalculationCommand()
        await cost_cmd.execute(context)
        assert (
            len(context.consolidated_ingredients) == initial_ingredient_count
        ), "Consolidation results should still persist"
        assert len(context.bulk_opportunities) >= 0, "Bulk opportunities should be available"
        assert context.total_cost > 0, "Cost calculations should be available"

    @pytest.mark.asyncio
    async def test_optimization_score_calculation(self, sample_recipes_data):
        """Test that optimization score is calculated correctly"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # Run full pipeline
        await ConsolidationCommand().execute(context)
        await BulkAnalysisCommand().execute(context)
        await CostCalculationCommand().execute(context)

        # Verify score calculation
        assert context.optimization_score >= 0.0
        assert context.optimization_score <= 1.0

        # Score should consider savings and consolidation
        cost_metrics = context.metrics.get('cost_analysis', {})
        assert 'optimization_score' in cost_metrics
        assert cost_metrics['optimization_score'] == round(context.optimization_score, 2)

    @pytest.mark.asyncio
    async def test_metrics_accumulation(self, sample_recipes_data):
        """Test that metrics accumulate properly across commands"""
        context = OptimizationContext(sample_recipes_data, 'test_user')

        # Execute each command and verify metrics accumulate
        await ConsolidationCommand().execute(context)
        assert len(context.metrics) == 1
        assert 'consolidation' in context.metrics

        await BulkAnalysisCommand().execute(context)
        assert len(context.metrics) == 2
        assert 'consolidation' in context.metrics
        assert 'bulk_analysis' in context.metrics

        await CostCalculationCommand().execute(context)
        assert len(context.metrics) == 3
        assert 'consolidation' in context.metrics
        assert 'bulk_analysis' in context.metrics
        assert 'cost_analysis' in context.metrics


class TestCommandChainEdgeCases:
    """Test edge cases in command chain execution"""

    @pytest.mark.asyncio
    async def test_large_recipe_set(self):
        """Test command chain with large number of recipes"""
        # Create 20 recipes with multiple ingredients each
        recipes_data = [
            {
                'id': f'recipe_{i}',
                'name': f'Recipe {i}',
                'ingredients': [
                    {
                        'ingredient_name': f'ingredient_{j}',
                        'quantity': 100.0 + (i * j),
                        'unit': 'g',
                        'calories_per_unit': 1.5,
                        'protein_g_per_unit': 0.1,
                        'fat_g_per_unit': 0.05,
                        'carbs_g_per_unit': 0.2,
                    }
                    for j in range(5)
                ]
            }
            for i in range(20)
        ]

        context = OptimizationContext(recipes_data, 'test_user')

        # Execute pipeline
        await ConsolidationCommand().execute(context)
        await BulkAnalysisCommand().execute(context)
        await CostCalculationCommand().execute(context)

        # Verify results
        assert len(context.all_ingredients) > 0
        assert len(context.consolidated_ingredients) > 0
        assert context.optimization_score > 0

    @pytest.mark.asyncio
    async def test_duplicate_ingredients_consolidation(self):
        """Test that duplicate ingredients are properly consolidated"""
        recipes_data = [
            {
                'id': 'recipe_1',
                'name': 'Dish 1',
                'ingredients': [
                    {
                        'ingredient_name': 'salt',
                        'quantity': 10.0,
                        'unit': 'g',
                        'calories_per_unit': 0,
                        'protein_g_per_unit': 0,
                        'fat_g_per_unit': 0,
                        'carbs_g_per_unit': 0,
                    },
                ]
            },
            {
                'id': 'recipe_2',
                'name': 'Dish 2',
                'ingredients': [
                    {
                        'ingredient_name': 'salt',
                        'quantity': 5.0,
                        'unit': 'g',
                        'calories_per_unit': 0,
                        'protein_g_per_unit': 0,
                        'fat_g_per_unit': 0,
                        'carbs_g_per_unit': 0,
                    },
                ]
            },
        ]

        context = OptimizationContext(recipes_data, 'test_user')
        await ConsolidationCommand().execute(context)

        # Should consolidate duplicate salt into one ingredient
        salt_items = [ing for ing in context.consolidated_ingredients if 'salt' in ing.name.lower()]
        assert len(salt_items) == 1, "Duplicate salt should be consolidated into one item"
        assert salt_items[0].quantity == pytest.approx(15.0), "Quantity should be summed"

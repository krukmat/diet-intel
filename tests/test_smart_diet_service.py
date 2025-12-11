import pytest
from unittest.mock import AsyncMock

from app.models.smart_diet import (
    OptimizationSuggestion,
    SuggestionCategory,
    SuggestionType,
    SmartDietContext,
)
from app.services.smart_diet import OptimizationEngine


class _SimpleMacros:
    def __init__(self, calories, protein, fat, carbs, fiber=0.0):
        self.calories = calories
        self.protein_g = protein
        self.fat_g = fat
        self.carbs_g = carbs
        self.fiber_g = fiber


class _SimpleMealItem:
    def __init__(self, name, macros):
        self.name = name
        self.macros = macros


class _SimpleMeal:
    def __init__(self, items):
        self.items = items


@pytest.fixture
def optimization_engine():
    return OptimizationEngine()


def test_calculate_meal_nutrition_sums_macros(optimization_engine):
    macros = _SimpleMacros(calories=200, protein=12, fat=8, carbs=25, fiber=4)
    meal = _SimpleMeal(items=[_SimpleMealItem("Oats", macros)])
    totals = optimization_engine._calculate_meal_nutrition(meal)
    assert totals["calories"] == 200
    assert totals["protein_g"] == 12
    assert totals["fiber_g"] == 4


def test_should_apply_rule_triggers_low_protein(optimization_engine):
    rule = optimization_engine.optimization_rules[0]
    nutrition = {"protein_g": 5}
    goals = {"target_calories": 2000}
    assert optimization_engine._should_apply_rule(rule, nutrition, goals) is True
    nutrition["protein_g"] = 30
    assert optimization_engine._should_apply_rule(rule, nutrition, goals) is False


@pytest.mark.asyncio
async def test_create_optimization_from_rule_variants(optimization_engine):
    meal = _SimpleMeal(items=[])
    nutrition = {}
    goals = {}

    swap = {
        "swap": {"type": "grain", "pattern": "white rice"},
        "to": {"name": "Quinoa", "barcode": "OPT_QUINOA"},
        "benefit": {"protein_g": 6},
    }
    addition = {
        "add": {"name": "Greek Yogurt", "barcode": "OPT_GREEK", "amount": "150g"},
        "benefit": {"protein_g": 15},
    }
    adjust = {
        "adjust": {"type": "portion", "reduction": 0.2},
        "benefit": {"calories": -50},
    }

    swap_suggestion = await optimization_engine._create_optimization_from_rule(
        swap, meal, nutrition, goals
    )
    add_suggestion = await optimization_engine._create_optimization_from_rule(
        addition, meal, nutrition, goals
    )
    adjust_suggestion = await optimization_engine._create_optimization_from_rule(
        adjust, meal, nutrition, goals
    )

    assert swap_suggestion is not None and swap_suggestion.optimization_type == "swap"
    assert add_suggestion is not None and add_suggestion.optimization_type == "add"
    assert adjust_suggestion is not None and adjust_suggestion.optimization_type == "adjust"


def test_categorize_food_items_matches_keywords(optimization_engine):
    assert (
        optimization_engine._categorize_food_item("quinoa bowl with greens")
        == "grain_products"
    )
    assert optimization_engine._categorize_food_item("mystery item") is None


def _dummy_optimization():
    return OptimizationSuggestion(
        id="opt-1",
        suggestion_type=SuggestionType.OPTIMIZATION,
        category=SuggestionCategory.FOOD_SWAP,
        title="Swap item",
        description="Swap to a better option",
        reasoning="Improves macros",
        suggested_item={"name": "Tofu", "barcode": "OPT_TOFU"},
        nutritional_benefit={"protein_g": 4},
        calorie_impact=0,
        macro_impact={},
        confidence_score=0.85,
        priority_score=0.6,
        meal_context="dinner",
        planning_context=SmartDietContext.OPTIMIZE,
        implementation_complexity="simple",
        optimization_type="intelligent_swap",
        target_improvement={"protein_g": 4},
    )


@pytest.mark.asyncio
async def test_generate_swap_suggestions_uses_alternatives(monkeypatch, optimization_engine):
    meal_item = _SimpleMealItem("Chicken", _SimpleMacros(300, 18, 12, 20))
    meal = _SimpleMeal(items=[meal_item])

    mock_alternatives = AsyncMock(
        return_value=[
            {
                "name": "Seitan",
                "barcode": "SEITAN",
                "benefits": {"protein_g": 6},
                "confidence": 0.9,
            }
        ]
    )
    mock_suggestion = AsyncMock(return_value=_dummy_optimization())

    monkeypatch.setattr(
        optimization_engine,
        "_find_healthier_alternatives",
        mock_alternatives,
    )
    monkeypatch.setattr(
        optimization_engine,
        "_create_intelligent_swap_suggestion",
        mock_suggestion,
    )

    suggestions = await optimization_engine._generate_swap_suggestions(meal, {})
    assert len(suggestions) == 1
    mock_alternatives.assert_awaited()
    mock_suggestion.assert_awaited_with(meal_item, mock_alternatives.return_value[0], "protein_sources")

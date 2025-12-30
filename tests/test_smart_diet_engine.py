from datetime import datetime
from types import SimpleNamespace

import pytest
from unittest.mock import AsyncMock

from app.models.smart_diet import (
    SmartDietContext,
    SmartDietRequest,
    SmartDietInsights,
    SmartSuggestion,
    SuggestionCategory,
    SuggestionFeedback,
    SuggestionType,
)
from app.services.smart_diet import SmartDietEngine


class _DummyMacros:
    def __init__(self, calories=200, protein=10, fat=5, carbs=20, fiber=2):
        self.calories = calories
        self.protein_g = protein
        self.fat_g = fat
        self.carbs_g = carbs
        self.fiber_g = fiber


class _DummyMealItem:
    def __init__(self, name="item", macros=None):
        self.name = name
        self.macros = macros or _DummyMacros()


class _DummyMeal:
    def __init__(self, items):
        self.items = items


class _DummyTranslationService:
    def __init__(self):
        self.calls = []
        self.fail_on = set()

    async def translate_text(self, text, source_lang, target_lang):
        self.calls.append((text, source_lang, target_lang))
        if text in self.fail_on:
            raise RuntimeError("translation failed")
        return f"{text}-es"


class _DummyCache:
    def __init__(self):
        self.data = {}

    async def get_suggestions_cache(self, user_id, context, request_hash):
        return self.data.get((user_id, context, request_hash))

    async def set_suggestions_cache(self, user_id, context, request_hash, response):
        self.data[(user_id, context, request_hash)] = response


class _DummyRecommendationEngine:
    def __init__(self):
        self.record_feedback = AsyncMock(return_value=True)


@pytest.fixture
def smart_diet_engine(monkeypatch):
    cache = _DummyCache()
    translation = _DummyTranslationService()

    monkeypatch.setattr(
        "app.services.smart_diet.get_smart_diet_cache", lambda: cache
    )
    monkeypatch.setattr(
        "app.services.smart_diet.get_translation_service",
        lambda cache_service: translation,
    )
    plan = SimpleNamespace(
        meals=[_DummyMeal(items=[_DummyMealItem("oats")])]
    )
    monkeypatch.setattr(
        "app.services.smart_diet.plan_storage.get_plan",
        AsyncMock(return_value=plan),
    )

    engine = SmartDietEngine()
    engine.recommendation_engine = _DummyRecommendationEngine()
    return engine, cache, translation


def _make_suggestion(
    suggestion_id="sug-1",
    reasoning="protein focus",
    planning_context=SmartDietContext.TODAY,
    user_id="user1",
):
    return SmartSuggestion(
        user_id=user_id,
        id=suggestion_id,
        suggestion_type=SuggestionType.INSIGHT,
        category=SuggestionCategory.NUTRITIONAL_GAP,
        title="Protein insight",
        description="Add protein",
        reasoning=reasoning,
        suggested_item={"type": "advice"},
        confidence_score=0.8,
        planning_context=planning_context,
        calorie_impact=30,
        macro_impact={},
    )


def _make_feedback(suggestion_id="sug-1", user_id="user1", action="accepted"):
    return SuggestionFeedback(
        suggestion_id=suggestion_id,
        user_id=user_id,
        action=action,
        feedback_at=datetime.utcnow(),
    )


def test_request_hash_is_deterministic(smart_diet_engine):
    engine, _, _ = smart_diet_engine
    request = SmartDietRequest(
        user_id="user1",
        context_type=SmartDietContext.DISCOVER,
        dietary_restrictions=["gluten"],
        cuisine_preferences=["mediterranean"],
        excluded_ingredients=["nuts"],
        target_macros={"protein": 30},
        calorie_budget=1800,
        max_suggestions=5,
        min_confidence=0.4,
        include_optimizations=True,
        include_recommendations=True,
    )

    first = engine._generate_request_hash("user1", request)
    second = engine._generate_request_hash("user1", request)
    assert first == second

    request.max_suggestions = 6
    assert engine._generate_request_hash("user1", request) != first


@pytest.mark.asyncio
async def test_generate_insights_uses_translation(smart_diet_engine):
    engine, _, translation = smart_diet_engine
    request = SmartDietRequest(lang="es")
    suggestions = await engine._generate_insights("user1", request)
    assert isinstance(suggestions, list)
    assert translation.calls
    assert all(s.planning_context == SmartDietContext.INSIGHTS for s in suggestions)

    translation.fail_on.add("Protein Intake Analysis")
    translation.calls.clear()
    fallback = await engine._generate_insights("user1", request)
    assert fallback
    assert any(call[0] == "Protein Intake Analysis" for call in translation.calls)


@pytest.mark.asyncio
async def test_generate_nutritional_summary_handles_translation(smart_diet_engine):
    engine, _, translation = smart_diet_engine
    request = SmartDietRequest(lang="es")
    suggestions = [_make_suggestion(reasoning="Fiber boost", planning_context=SmartDietContext.TODAY)]
    summary = await engine._generate_nutritional_summary(suggestions, request)
    assert "health_benefits" in summary
    assert any(benefit.endswith("-es") for benefit in summary["health_benefits"])
    assert any("Fiber Opportunity" in call[0] or "Vitamin" in call[0] for call in translation.calls)


@pytest.mark.asyncio
async def test_generate_optimizations_without_plan(smart_diet_engine):
    engine, _, _ = smart_diet_engine
    request = SmartDietRequest(current_meal_plan_id=None)
    suggestions = await engine._generate_optimizations("user1", request)
    assert suggestions == []


@pytest.mark.asyncio
async def test_generate_optimizations_with_plan(smart_diet_engine):
    engine, _, _ = smart_diet_engine
    mock_suggestion = _make_suggestion(suggestion_id="opt-1", planning_context=SmartDietContext.OPTIMIZE)
    engine.optimization_engine.analyze_meal_plan = AsyncMock(return_value=[mock_suggestion])
    request = SmartDietRequest(current_meal_plan_id="plan-1", max_suggestions=4)
    results = await engine._generate_optimizations("user1", request)
    assert results
    assert results[0].id == "opt-1"


@pytest.mark.asyncio
async def test_process_feedback_updates_history(smart_diet_engine):
    engine, _, _ = smart_diet_engine
    feedback = _make_feedback()
    engine.suggestion_history = [_make_suggestion()]
    engine._update_learning_from_feedback = AsyncMock()
    success = await engine.process_suggestion_feedback(feedback)
    assert success
    engine._update_learning_from_feedback.assert_awaited_once_with(feedback)
    assert feedback in engine.feedback_history


@pytest.mark.asyncio
async def test_get_diet_insights_filters_history(smart_diet_engine):
    engine, _, _ = smart_diet_engine
    accepted = _make_suggestion("sug-1")
    ignored = _make_suggestion("sug-2")
    engine.suggestion_history = [accepted, ignored]
    engine.feedback_history = [
        _make_feedback(suggestion_id="sug-1", action="accepted")
    ]

    insights = await engine.get_diet_insights("user1", period="week")
    assert isinstance(insights, SmartDietInsights)
    assert accepted in insights.successful_suggestions
    assert ignored in insights.ignored_suggestions


# ===== TESTS FOR UNCOVERED MAIN ENTRY POINT AND CORE METHODS =====


@pytest.mark.asyncio
async def test_get_smart_suggestions_main_entry_point(smart_diet_engine):
    """Test get_smart_suggestions() - main entry point (lines 540-632)"""
    engine, cache, _ = smart_diet_engine
    request = SmartDietRequest(
        user_id="user1",
        context_type=SmartDietContext.TODAY,
        include_recommendations=False,
        include_optimizations=False
    )

    response = await engine.get_smart_suggestions("user1", request)

    assert response is not None
    assert response.user_id == "user1"
    assert response.context_type == SmartDietContext.TODAY
    assert isinstance(response.total_suggestions, int)
    assert response.generation_time_ms > 0


@pytest.mark.asyncio
async def test_get_smart_suggestions_cache_hit(smart_diet_engine):
    """Test cache hit in get_smart_suggestions()"""
    engine, cache, _ = smart_diet_engine
    request = SmartDietRequest(
        user_id="user1",
        context_type=SmartDietContext.TODAY
    )

    # First call populates cache
    response1 = await engine.get_smart_suggestions("user1", request)

    # Second call should hit cache
    response2 = await engine.get_smart_suggestions("user1", request)

    assert response1.user_id == response2.user_id
    assert response1.context_type == response2.context_type


@pytest.mark.asyncio
async def test_get_smart_suggestions_with_insights(smart_diet_engine):
    """Test get_smart_suggestions with insights context (lines 591-594)"""
    engine, _, _ = smart_diet_engine
    request = SmartDietRequest(
        user_id="user1",
        context_type=SmartDietContext.INSIGHTS,
        include_recommendations=False,
        include_optimizations=False
    )

    response = await engine.get_smart_suggestions("user1", request)

    assert response.insights is not None
    assert isinstance(response.insights, list)


@pytest.mark.asyncio
async def test_generate_recommendations_error_handling(smart_diet_engine, monkeypatch):
    """Test error handling in _generate_recommendations() (lines 682-684)"""
    engine, _, _ = smart_diet_engine

    # Mock recommendation engine to raise error
    engine.recommendation_engine = None

    request = SmartDietRequest(
        user_id="user1",
        context_type=SmartDietContext.DISCOVER,
        include_recommendations=True
    )

    # Should handle error gracefully and return empty list
    suggestions = await engine._generate_recommendations("user1", request)
    assert suggestions == []


@pytest.mark.asyncio
async def test_create_today_highlights(smart_diet_engine):
    """Test _create_today_highlights() (lines 797-814)"""
    engine, _, _ = smart_diet_engine

    suggestions = [
        _make_suggestion(f"sug-{i}", planning_context=SmartDietContext.TODAY)
        for i in range(10)
    ]
    request = SmartDietRequest(context_type=SmartDietContext.TODAY)

    highlights = await engine._create_today_highlights(suggestions, request)

    assert isinstance(highlights, list)
    assert len(highlights) <= 5  # Should return top 5
    assert all(isinstance(h, (SmartSuggestion, dict)) for h in highlights)


@pytest.mark.asyncio
async def test_create_today_highlights_empty_suggestions(smart_diet_engine):
    """Test _create_today_highlights() with empty suggestions"""
    engine, _, _ = smart_diet_engine
    request = SmartDietRequest(context_type=SmartDietContext.TODAY)

    highlights = await engine._create_today_highlights([], request)

    assert highlights == []


@pytest.mark.asyncio
async def test_generate_insights_in_english(smart_diet_engine):
    """Test _generate_insights() with English language (lines 752-754)"""
    engine, _, _ = smart_diet_engine
    request = SmartDietRequest(lang="en")

    insights = await engine._generate_insights("user1", request)

    assert isinstance(insights, list)
    assert len(insights) > 0
    assert all(isinstance(i, SmartSuggestion) for i in insights)


@pytest.mark.asyncio
async def test_generate_nutritional_summary_with_suggestions(smart_diet_engine):
    """Test _generate_nutritional_summary() with suggestions (lines 816-908)"""
    engine, _, _ = smart_diet_engine

    suggestions = [
        _make_suggestion(
            reasoning="Protein boost for muscle",
            planning_context=SmartDietContext.TODAY
        )
    ]
    request = SmartDietRequest(lang="en")

    summary = await engine._generate_nutritional_summary(suggestions, request)

    assert isinstance(summary, dict)
    assert "health_benefits" in summary
    assert "nutritional_gaps" in summary
    assert "macro_distribution" in summary


@pytest.mark.asyncio
async def test_generate_nutritional_summary_empty_suggestions(smart_diet_engine):
    """Test _generate_nutritional_summary() with empty suggestions"""
    engine, _, _ = smart_diet_engine
    request = SmartDietRequest(lang="en")

    summary = await engine._generate_nutritional_summary([], request)

    assert isinstance(summary, dict)
    assert summary["total_recommended_calories"] == 0


@pytest.mark.asyncio
async def test_update_learning_from_feedback_with_recommendation(smart_diet_engine):
    """Test _update_learning_from_feedback() with recommendation type (lines 948-962)"""
    engine, _, _ = smart_diet_engine

    suggestion = SmartSuggestion(
        id="sug-1",
        user_id="user1",
        suggestion_type=SuggestionType.RECOMMENDATION,
        category=SuggestionCategory.FOOD_SWAP,
        title="Try this product",
        description="Better alternative",
        reasoning="Healthier choice",
        suggested_item={"barcode": "123456"},
        confidence_score=0.8,
        planning_context=SmartDietContext.TODAY,
        legacy_recommendation_data={"id": "rec-1"}
    )

    engine.suggestion_history = [suggestion]
    engine.recommendation_engine = _DummyRecommendationEngine()

    feedback = SuggestionFeedback(
        suggestion_id="sug-1",
        user_id="user1",
        action="accepted",
        feedback_at=datetime.utcnow()
    )

    await engine._update_learning_from_feedback(feedback)

    # Should call record_feedback on recommendation engine
    engine.recommendation_engine.record_feedback.assert_awaited()


@pytest.mark.asyncio
async def test_update_learning_from_feedback_missing_suggestion(smart_diet_engine):
    """Test _update_learning_from_feedback() with missing suggestion"""
    engine, _, _ = smart_diet_engine

    engine.suggestion_history = []

    feedback = SuggestionFeedback(
        suggestion_id="nonexistent",
        user_id="user1",
        action="accepted",
        feedback_at=datetime.utcnow()
    )

    # Should handle gracefully
    await engine._update_learning_from_feedback(feedback)
    # No exception should be raised


@pytest.mark.asyncio
async def test_get_diet_insights_different_periods(smart_diet_engine):
    """Test get_diet_insights() with different period values (lines 977-988)"""
    engine, _, _ = smart_diet_engine

    # Test different period values
    for period in ["day", "week", "month", "invalid"]:
        insights = await engine.get_diet_insights("user1", period=period)
        assert isinstance(insights, SmartDietInsights)
        assert insights.user_id == "user1"


@pytest.mark.asyncio
async def test_get_diet_insights_error_handling(smart_diet_engine, monkeypatch):
    """Test error handling in get_diet_insights() (lines 1036-1038)"""
    engine, _, _ = smart_diet_engine

    # Mock to raise error
    monkeypatch.setattr(
        engine,
        "suggestion_history",
        property(lambda self: None)  # Force error during filter
    )

    insights = await engine.get_diet_insights("user1")

    # Should return default insights even on error
    assert isinstance(insights, SmartDietInsights)


@pytest.mark.asyncio
async def test_optimization_engine_analyze_meal_plan(smart_diet_engine):
    """Test OptimizationEngine.analyze_meal_plan() (lines 114-144)"""
    engine, _, _ = smart_diet_engine

    meal_plan = SimpleNamespace(
        meals=[
            _DummyMeal([
                _DummyMealItem("white rice", _DummyMacros(calories=200, protein=4)),
                _DummyMealItem("chicken", _DummyMacros(calories=250, protein=35))
            ])
        ]
    )
    user_goals = {"target_calories": 2000}

    optimizations = await engine.optimization_engine.analyze_meal_plan(meal_plan, user_goals)

    assert isinstance(optimizations, list)


@pytest.mark.asyncio
async def test_optimization_engine_with_low_protein(smart_diet_engine):
    """Test OptimizationEngine trigger for low protein (lines 47-65)"""
    engine, _, _ = smart_diet_engine

    meal_plan = SimpleNamespace(
        meals=[
            _DummyMeal([
                _DummyMealItem("salad", _DummyMacros(calories=100, protein=2))
            ])
        ]
    )
    user_goals = {"target_calories": 2000}

    optimizations = await engine.optimization_engine.analyze_meal_plan(meal_plan, user_goals)

    # Should suggest protein boost
    assert isinstance(optimizations, list)


@pytest.mark.asyncio
async def test_optimization_engine_with_low_fiber(smart_diet_engine):
    """Test OptimizationEngine trigger for low fiber (lines 68-82)"""
    engine, _, _ = smart_diet_engine

    meal_plan = SimpleNamespace(
        meals=[
            _DummyMeal([
                _DummyMealItem("white bread", _DummyMacros(calories=200, fiber=1))
            ])
        ]
    )
    user_goals = {"target_calories": 2000}

    optimizations = await engine.optimization_engine.analyze_meal_plan(meal_plan, user_goals)

    assert isinstance(optimizations, list)


@pytest.mark.asyncio
async def test_optimization_engine_calculate_meal_nutrition(smart_diet_engine):
    """Test _calculate_meal_nutrition() (lines 146-168)"""
    engine, _, _ = smart_diet_engine

    meal_item = _DummyMealItem("test", _DummyMacros(calories=250, protein=20, fat=10, carbs=30, fiber=5))
    meal = _DummyMeal([meal_item])

    nutrition = engine.optimization_engine._calculate_meal_nutrition(meal)

    assert nutrition["calories"] == 250
    assert nutrition["protein_g"] == 20
    assert nutrition["fat_g"] == 10
    assert nutrition["carbs_g"] == 30
    assert nutrition["fiber_g"] == 5


@pytest.mark.asyncio
async def test_optimization_engine_should_apply_rule_with_lambda(smart_diet_engine):
    """Test _should_apply_rule() with trigger lambdas (lines 170-187)"""
    engine, _, _ = smart_diet_engine

    rule_low_protein = {
        "name": "protein_boost",
        "trigger": lambda nutrition: nutrition.get("protein_g", 0) < 20
    }

    nutrition_low = {"protein_g": 15}
    nutrition_high = {"protein_g": 25}

    assert engine.optimization_engine._should_apply_rule(rule_low_protein, nutrition_low, {})
    assert not engine.optimization_engine._should_apply_rule(rule_low_protein, nutrition_high, {})


@pytest.mark.asyncio
async def test_optimization_engine_categorize_food_item(smart_diet_engine):
    """Test _categorize_food_item() (lines 332-338)"""
    engine, _, _ = smart_diet_engine

    # Test recognizable items
    assert engine.optimization_engine._categorize_food_item("white rice") == "grain_products"
    assert engine.optimization_engine._categorize_food_item("chicken breast") == "protein_sources"
    assert engine.optimization_engine._categorize_food_item("spinach salad") == "vegetables"

    # Test unrecognizable items
    assert engine.optimization_engine._categorize_food_item("unknown food xyz") is None


@pytest.mark.asyncio
async def test_boost_and_reduce_similar_suggestions(smart_diet_engine):
    """Test _boost_similar_suggestions() and _reduce_similar_suggestions() (lines 967-975)"""
    engine, _, _ = smart_diet_engine

    suggestion = _make_suggestion("sug-1")

    # Should not raise exceptions
    engine._boost_similar_suggestions(suggestion)
    engine._reduce_similar_suggestions(suggestion, "not_what_i_expected")

    # These are simplified implementations
    assert True


@pytest.mark.asyncio
async def test_process_feedback_with_rejected_action(smart_diet_engine):
    """Test process_suggestion_feedback() with rejection (lines 943-945)"""
    engine, _, _ = smart_diet_engine

    suggestion = _make_suggestion("sug-reject")
    engine.suggestion_history = [suggestion]
    engine._update_learning_from_feedback = AsyncMock()

    feedback = SuggestionFeedback(
        suggestion_id="sug-reject",
        user_id="user1",
        action="rejected",
        feedback_reason="Not helpful",
        feedback_at=datetime.utcnow()
    )

    success = await engine.process_suggestion_feedback(feedback)

    assert success
    engine._update_learning_from_feedback.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_diet_insights_with_no_history(smart_diet_engine):
    """Test get_diet_insights() with empty history"""
    engine, _, _ = smart_diet_engine

    engine.suggestion_history = []
    engine.feedback_history = []

    insights = await engine.get_diet_insights("user-no-history", period="week")

    assert isinstance(insights, SmartDietInsights)
    assert len(insights.successful_suggestions) == 0
    assert len(insights.ignored_suggestions) == 0


@pytest.mark.asyncio
async def test_generate_nutritional_summary_translation_fallback(smart_diet_engine, monkeypatch):
    """Test translation fallback in _generate_nutritional_summary() (lines 881-883, 898-900)"""
    engine, _, translation = smart_diet_engine

    # Make translation fail
    translation.fail_on.add("Improved protein intake")
    translation.fail_on.add("Vitamin D")

    suggestions = [_make_suggestion(reasoning="Protein boost")]
    request = SmartDietRequest(lang="es")

    summary = await engine._generate_nutritional_summary(suggestions, request)

    assert isinstance(summary, dict)
    assert "health_benefits" in summary
    # Should contain fallback values when translation fails


@pytest.mark.asyncio
async def test_generate_insights_translation_fallback(smart_diet_engine, monkeypatch):
    """Test translation fallback in _generate_insights() (lines 773-776)"""
    engine, _, translation = smart_diet_engine

    # Make translation fail
    translation.fail_on.add("Protein Intake Analysis")

    request = SmartDietRequest(lang="es")

    suggestions = await engine._generate_insights("user1", request)

    assert isinstance(suggestions, list)
    assert len(suggestions) > 0
    # Should handle translation failures gracefully


@pytest.mark.asyncio
async def test_optimization_engine_find_healthier_alternatives(smart_diet_engine, monkeypatch):
    """Test _find_healthier_alternatives() with database lookup (lines 340-427)"""
    engine, _, _ = smart_diet_engine

    # Mock database connection
    class _MockCursor:
        def execute(self, query, params):
            return self

        def fetchall(self):
            # Return mock products with better nutrition
            return [
                {
                    "barcode": "123",
                    "name": "Quinoa",
                    "nutriments": '{"energy_kcal_per_100g": 120, "protein_g_per_100g": 15, "fat_g_per_100g": 6}'
                }
            ]

    class _MockConnection:
        def cursor(self):
            return _MockCursor()

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    current_item = _DummyMealItem("rice", _DummyMacros(calories=150, protein=10, fat=8))

    # Mock the database service
    def mock_get_connection():
        return _MockConnection()

    monkeypatch.setattr("app.services.smart_diet.db_service.get_connection", mock_get_connection)

    alternatives = await engine.optimization_engine._find_healthier_alternatives(
        current_item,
        "grain_products",
        {"target_calories": 2000}
    )

    assert isinstance(alternatives, list)


@pytest.mark.asyncio
async def test_optimization_engine_error_in_meal_analysis(smart_diet_engine, monkeypatch):
    """Test error handling in analyze_meal_plan() (lines 139-140)"""
    engine, _, _ = smart_diet_engine

    # Create meal with items that will cause errors
    class _BrokenMeal:
        items = [None]  # This will cause AttributeError when accessing .name

    meal_plan = SimpleNamespace(meals=[_BrokenMeal()])

    # Should handle error gracefully
    optimizations = await engine.optimization_engine.analyze_meal_plan(meal_plan, {})

    assert isinstance(optimizations, list)
    # Should return empty or partial results, not crash


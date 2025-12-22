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


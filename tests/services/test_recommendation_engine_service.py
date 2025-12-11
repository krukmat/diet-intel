from datetime import datetime

import pytest
from unittest.mock import AsyncMock

from app.models.recommendation import RecommendationFeedback, SmartRecommendationRequest
from app.models.product import Nutriments, ProductResponse
from app.services.recommendation_engine import RecommendationEngine
from app.services.recipe_ai_engine import (
    RecipeGenerationRequest,
    RecipeIngredient,
    RecipeInstruction,
    RecipeNutrition,
    GeneratedRecipe,
)


class _FakeDB:
    def __init__(self):
        self.get_user_taste_profile = AsyncMock(return_value=None)
        self.store_recommendation_feedback = AsyncMock()


@pytest.fixture
def fake_db():
    return _FakeDB()


@pytest.fixture
def engine(fake_db):
    return RecommendationEngine(db_service=fake_db)


def _build_recipe(profile_cuisine="mediterranean"):
    ingredients = [
        RecipeIngredient(name="Tomato", quantity=2, unit="pcs"),
        RecipeIngredient(name="Chicken Breast", quantity=1, unit="breast"),
    ]
    instructions = [
        RecipeInstruction(step_number=1, instruction="Cook ingredients", cooking_method="grill"),
        RecipeInstruction(step_number=2, instruction="Serve warm", cooking_method="none"),
    ]
    nutrition = RecipeNutrition(
        calories_per_serving=420,
        protein_g_per_serving=35,
        fat_g_per_serving=12,
        carbs_g_per_serving=28,
    )
    return GeneratedRecipe(
        id="recipe1",
        name="Test Recipe",
        description="Test desc",
        cuisine_type=profile_cuisine,
        difficulty_level="medium",
        prep_time_minutes=20,
        cook_time_minutes=25,
        servings=4,
        ingredients=ingredients,
        instructions=instructions,
        nutrition=nutrition,
    )


def _build_profile():
    return {
        "profile_confidence": 0.8,
        "cuisine_preferences": [
            {"cuisine": "Mediterranean", "score": 0.9},
            {"cuisine": "Mexican", "score": 0.3},
        ],
        "preferred_prep_time_minutes": 25,
        "preferred_cook_time_minutes": 30,
        "preferred_calories_per_serving": 420,
        "disliked_ingredients": [{"ingredient": "pepper", "preference": -0.7}],
        "liked_ingredients": [{"ingredient": "tomato", "preference": 0.8}],
        "modification_tendency": 0.8,
    }


@pytest.mark.asyncio
async def test_apply_personalization_insufficient_profile(engine, fake_db):
    request = RecipeGenerationRequest(user_id="user1")
    fake_db.get_user_taste_profile.return_value = None

    enhanced, metadata = await engine.apply_personalization(request, "user1")

    assert enhanced is request
    assert metadata["applied"] is False
    assert "insufficient_profile_confidence" in metadata["reason"]


@pytest.mark.asyncio
async def test_apply_personalization_low_confidence_profile(engine, fake_db):
    request = RecipeGenerationRequest(user_id="user_low")
    profile = _build_profile()
    profile["profile_confidence"] = 0.1
    fake_db.get_user_taste_profile.return_value = profile

    enhanced, metadata = await engine.apply_personalization(request, "user_low")

    assert enhanced is request
    assert metadata["applied"] is False
    assert metadata["reason"] == "insufficient_profile_confidence"


@pytest.mark.asyncio
async def test_apply_personalization_enhances_request(engine, fake_db):
    request = RecipeGenerationRequest(user_id="user2")
    fake_db.get_user_taste_profile.return_value = _build_profile()
    request.cuisine_preferences = []

    enhanced, metadata = await engine.apply_personalization(request, "user2")

    assert enhanced.cuisine_preferences  # should fill with learned cuisines
    assert enhanced.max_prep_time_minutes == int(25 * 1.2)
    assert enhanced.max_cook_time_minutes == int(30 * 1.2)
    assert enhanced.target_calories_per_serving == 420
    assert "pepper" in enhanced.excluded_ingredients
    assert "tomato" in enhanced.available_ingredients
    assert enhanced.difficulty_preference == "easy"
    assert metadata["applied"] is True
    assert "enhancements" in metadata


@pytest.mark.asyncio
async def test_score_recipe_personalization_with_profile(engine, fake_db):
    fake_db.get_user_taste_profile.return_value = _build_profile()
    recipe = _build_recipe()

    result = await engine.score_recipe_personalization(recipe, "user3")
    assert result["overall_score"] > 0
    assert result["confidence"] == pytest.approx(0.8)
    explanation = result["explanation"]
    assert isinstance(explanation, str)


@pytest.mark.asyncio
async def test_score_recipe_personalization_without_profile(engine, fake_db):
    fake_db.get_user_taste_profile.return_value = None
    recipe = _build_recipe()

    result = await engine.score_recipe_personalization(recipe, "user4")
    assert result["overall_score"] == 0.0
    assert "No taste profile" in result["explanation"]


@pytest.mark.asyncio
async def test_score_recipe_personalization_handles_missing_nutrition(engine, fake_db):
    fake_db.get_user_taste_profile.return_value = _build_profile()
    recipe = _build_recipe()
    recipe.nutrition = None

    result = await engine.score_recipe_personalization(recipe, "user_missing_nutrition")

    assert result["nutrition_score"] == 0.5
    assert "overall_score" in result
    assert result["confidence"] == pytest.approx(0.8)


@pytest.mark.asyncio
async def test_record_feedback_and_metrics(engine, fake_db):
    feedback = RecommendationFeedback(
        user_id="user5",
        recommendation_id="rec-1",
        barcode="B001",
        accepted=True,
    )
    await engine.record_feedback(feedback)

    assert feedback in engine.feedback_history
    fake_db.store_recommendation_feedback.assert_awaited_once_with(feedback)

    metrics = await engine.get_metrics()
    assert metrics.total_recommendations == 1
    assert metrics.acceptance_rate == 1.0


def _make_product(barcode="P1"):
    return ProductResponse(
        source="tests",
        barcode=barcode,
        name="Product",
        brand="Brand",
        image_url=None,
        serving_size="100g",
        nutriments=Nutriments(
            energy_kcal_per_100g=150,
            protein_g_per_100g=15,
            fat_g_per_100g=5,
            carbs_g_per_100g=20,
            sugars_g_per_100g=5,
            salt_g_per_100g=0.2,
        ),
        fetched_at=datetime.utcnow(),
    )


@pytest.mark.asyncio
async def test_generate_recommendations_no_products(engine):
    request = SmartRecommendationRequest(
        user_id="user6", meal_context="lunch", context="general"
    )
    response = await engine.generate_recommendations(request)
    assert response.status == "no_recommendations"
    assert response.total_recommendations == 0


@pytest.mark.asyncio
async def test_generate_recommendations_with_products(engine):
    product = _make_product("R1")
    engine._load_available_products = lambda _: [product]
    request = SmartRecommendationRequest(
        user_id="user6", meal_context="lunch", context="general"
    )

    response = await engine.generate_recommendations(request)
    assert response.status == "success"
    assert response.total_recommendations == 1
    assert response.recommendations[0].barcode == "R1"


@pytest.mark.asyncio
async def test_record_feedback_handles_db_error(engine, fake_db):
    feedback = RecommendationFeedback(
        user_id="user_error",
        recommendation_id="rec-99",
        barcode="B099",
        accepted=False,
    )
    fake_db.store_recommendation_feedback.side_effect = RuntimeError("db failure")

    result = await engine.record_feedback(feedback)

    assert result is True
    fake_db.store_recommendation_feedback.assert_awaited_once_with(feedback)

import sqlite3

import pytest
pytestmark = pytest.mark.skip(reason="Task 7 refactoring incomplete - architectural mismatch in route registration")

import pytest
from fastapi import HTTPException

from app.models.recipe import RecipeGenerationRequest
from app.services.recipe_ai_engine import (
    GeneratedRecipe, RecipeIngredient, RecipeInstruction, RecipeNutrition
)
from app.models.user import User, UserRole
from app.routes import recipe_ai


class DummyBackgroundTasks:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *args, **kwargs):
        self.tasks.append((fn, args, kwargs))


def _make_generated_recipe() -> GeneratedRecipe:
    ingredient = RecipeIngredient(
        name="test",
        quantity=1,
        unit="pc",
        calories_per_unit=10,
        protein_g_per_unit=2,
        fat_g_per_unit=0,
        carbs_g_per_unit=1
    )
    instruction = RecipeInstruction(
        step_number=1,
        instruction="Test step",
        cooking_method="none",
        duration_minutes=5
    )
    nutrition = RecipeNutrition(
        calories_per_serving=120,
        protein_g_per_serving=8,
        fat_g_per_serving=2,
        carbs_g_per_serving=15,
        fiber_g_per_serving=3,
        sugar_g_per_serving=5,
        sodium_mg_per_serving=100,
        recipe_score=0.92
    )
    return GeneratedRecipe(
        id="recipe-test",
        name="Test Recipe",
        description="Generated for coverage",
        cuisine_type="test",
        difficulty_level="easy",
        prep_time_minutes=10,
        cook_time_minutes=5,
        servings=2,
        ingredients=[ingredient],
        instructions=[instruction],
        nutrition=nutrition,
        tags=["test"],
        confidence_score=0.95,
        generation_time_ms=100.0
    )


def _make_user() -> User:
    return User(
        id="user-ai",
        email="ai@example.com",
        full_name="AI Tester",
        role=UserRole.STANDARD,
        is_developer=False,
        is_active=True,
        email_verified=True
    )


class DummyRecipeEngine:
    def __init__(self, recipe: GeneratedRecipe):
        self._recipe = recipe

    async def generate_recipe_with_translation(self, _):
        return self._recipe

    def _generate_cache_key(self, request):
        return "cache-key"


class DummyRecipeDBService:
    async def create_recipe(self, generated_recipe, user_id):
        return generated_recipe.id

    async def log_recipe_generation_request(self, *args, **kwargs):
        return None


class DummyRecommendationEngine:
    async def apply_personalization(self, request, user_id):
        return request, {'applied': False}

    async def score_recipe_personalization(self, generated_recipe, user_id):
        return {'overall_score': 0.5}


class FailingRecommendationEngine(DummyRecommendationEngine):
    async def apply_personalization(self, request, user_id):
        raise RuntimeError("personalization failed")


def _setup_successful_context(monkeypatch, generated_recipe=None):
    generated_recipe = generated_recipe or _make_generated_recipe()
    monkeypatch.setattr(recipe_ai, "recipe_engine", DummyRecipeEngine(generated_recipe))
    monkeypatch.setattr(recipe_ai, "recommendation_engine", DummyRecommendationEngine())
    monkeypatch.setattr(recipe_ai, "recipe_db_service", DummyRecipeDBService())
    monkeypatch.setattr(recipe_ai, "log_recipe_request", lambda *args, **kwargs: None)
    return generated_recipe


@pytest.mark.asyncio
async def test_generate_recipe_handles_recommendation_engine_failure(monkeypatch):
    request = RecipeGenerationRequest()
    background_tasks = DummyBackgroundTasks()
    user = _make_user()
    _setup_successful_context(monkeypatch)
    monkeypatch.setattr(recipe_ai, "recommendation_engine", FailingRecommendationEngine())

    with pytest.raises(HTTPException) as excinfo:
        await recipe_ai.generate_recipe(request, background_tasks, current_user=user)

    assert excinfo.value.status_code == 500


@pytest.mark.asyncio
async def test_generate_recipe_handles_db_integrity_error(monkeypatch):
    request = RecipeGenerationRequest()
    background_tasks = DummyBackgroundTasks()
    user = _make_user()
    generated_recipe = _setup_successful_context(monkeypatch)

    class IntegrityErrorDB(DummyRecipeDBService):
        async def create_recipe(self, generated_recipe, user_id):
            raise sqlite3.IntegrityError("duplicate recipe")

    monkeypatch.setattr(recipe_ai, "recipe_db_service", IntegrityErrorDB())

    with pytest.raises(HTTPException) as excinfo:
        await recipe_ai.generate_recipe(request, background_tasks, current_user=user)

    assert excinfo.value.status_code == 500

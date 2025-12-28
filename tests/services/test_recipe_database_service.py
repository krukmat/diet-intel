import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

import pytest

from app.services.recipe_ai_engine import (
    GeneratedRecipe,
    RecipeIngredient,
    RecipeInstruction,
    RecipeNutrition
)
from app.services.recipe_database import RecipeDatabaseService


def _sample_recipe():
    ingredient = RecipeIngredient(
        name="tomato",
        quantity=2,
        unit="pcs",
        calories_per_unit=20,
        protein_g_per_unit=1,
        fat_g_per_unit=0,
        carbs_g_per_unit=4
    )

    instruction = RecipeInstruction(
        step_number=1,
        instruction="Chop tomatoes",
        cooking_method="none",
        duration_minutes=5
    )

    nutrition = RecipeNutrition(
        calories_per_serving=200,
        protein_g_per_serving=10,
        fat_g_per_serving=5,
        carbs_g_per_serving=20,
        fiber_g_per_serving=4,
        sugar_g_per_serving=6,
        sodium_mg_per_serving=150,
        recipe_score=0.85
    )

    return GeneratedRecipe(
        id="recipe-1",
        name="Tomato Bowl",
        description="Test recipe",
        cuisine_type="mediterranean",
        difficulty_level="easy",
        prep_time_minutes=10,
        cook_time_minutes=5,
        servings=2,
        ingredients=[ingredient],
        instructions=[instruction],
        nutrition=nutrition,
        tags=["fresh", "daily"],
        confidence_score=0.9,
        generation_time_ms=123.4
    )


@pytest.fixture
def recipe_service(tmp_path):
    db_path = tmp_path / "recipes.db"
    service = RecipeDatabaseService(str(db_path))
    # Tables are automatically initialized via schema_service and shopping_service in __init__
    return service


@pytest.mark.asyncio
async def test_create_and_get_recipe(recipe_service):
    recipe = _sample_recipe()
    created_id = await recipe_service.create_recipe(recipe, user_id="user-1")
    assert created_id

    fetched = await recipe_service.get_recipe(created_id)
    assert fetched is not None
    assert fetched.name == recipe.name
    assert len(fetched.ingredients) == 1

    raw = await recipe_service.get_recipe_by_id(created_id)
    assert raw["cuisine_type"] == recipe.cuisine_type
    assert raw["ingredients"][0]["ingredient"] == "tomato"


def test_ensure_tables_initialized_handles_init_failures(recipe_service, monkeypatch):
    recipe_service._recipe_tables_ready = False

    def fake_init():
        raise RuntimeError("init failed")

    monkeypatch.setattr(recipe_service, "init_recipe_tables", fake_init)
    monkeypatch.setattr(recipe_service, "init_shopping_optimization_tables_sync", fake_init)

    recipe_service._ensure_tables_initialized()
    assert recipe_service._recipe_tables_ready is True


@pytest.mark.asyncio
async def test_log_recipe_generation_request_inserts_row(recipe_service):
    request_id = await recipe_service.log_recipe_generation_request(
        user_id="user-log",
        session_id="session-log",
        cache_key="cache-test",
        request_data={"key": "value"},
        generated_recipe_id="recipe-1",
        processing_time_ms=88.8,
        success=True,
        error_message=None
    )

    assert request_id
    with recipe_service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT cache_key, success FROM recipe_generation_requests WHERE id = ?", (request_id,)).fetchone()
        assert row is not None
        assert row["cache_key"] == "cache-test"
        assert row["success"] == 1

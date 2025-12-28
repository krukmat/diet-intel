import json
import os
import sqlite3
from pathlib import Path

import pytest

from app.services.recipe_ai_engine import (
    GeneratedRecipe,
    RecipeIngredient,
    RecipeInstruction,
    RecipeNutrition,
)
from app.services.recipe_database import RecipeDatabaseService


class _BrokenConnection:
    def __enter__(self):
        raise sqlite3.OperationalError("simulated outage")

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False


@pytest.fixture
def recipe_db(tmp_path):
    service = RecipeDatabaseService(str(tmp_path / "recipe-branches.db"))
    # Tables are automatically initialized via schema_service and shopping_service in __init__
    return service


def _make_recipe(
    recipe_id="recipe-branch",
    cuisine_type="italian",
    difficulty="easy",
    prep_time=10,
    tags=None,
):
    ingredient = RecipeIngredient(
        name="tomato",
        quantity=2,
        unit="pcs",
    )
    instruction = RecipeInstruction(
        step_number=1,
        instruction="Chop tomatoes",
        cooking_method="none",
    )
    nutrition = RecipeNutrition(
        calories_per_serving=200,
        protein_g_per_serving=10,
        fat_g_per_serving=5,
        carbs_g_per_serving=30,
    )
    return GeneratedRecipe(
        id=recipe_id,
        name=f"Recipe {recipe_id}",
        description="Sample recipe",
        cuisine_type=cuisine_type,
        difficulty_level=difficulty,
        prep_time_minutes=prep_time,
        cook_time_minutes=15,
        servings=2,
        ingredients=[ingredient],
        instructions=[instruction],
        nutrition=nutrition,
        tags=tags or ["tag-a"],
        confidence_score=0.8,
        generation_time_ms=75.0,
    )


def test_init_recipe_tables_manual_creation(recipe_db, monkeypatch):
    original_exists = os.path.exists

    def fake_exists(path):
        if path.endswith("02_recipe_tables.sql"):
            return False
        return original_exists(path)

    monkeypatch.setattr(os.path, "exists", fake_exists)

    recipe_db.init_recipe_tables()

    with recipe_db.get_connection() as conn:
        cursor = conn.cursor()
        tables = {
            row["name"]
            for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }

    assert "recipes" in tables
    assert "recipe_ingredients" in tables


@pytest.mark.asyncio
async def test_create_recipe_raises_on_connection_error(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    with pytest.raises(RuntimeError):
        await recipe_db.create_recipe(_make_recipe())


@pytest.mark.asyncio
async def test_search_recipes_uses_all_filters(recipe_db):
    await recipe_db.create_recipe(_make_recipe(recipe_id="r1"), user_id="user-a")
    await recipe_db.create_recipe(
        _make_recipe(recipe_id="r2", cuisine_type="mexican", difficulty="hard", prep_time=40),
        user_id="user-b",
    )

    results = await recipe_db.search_recipes(
        user_id="user-a",
        cuisine_type="italian",
        difficulty_level="easy",
        max_prep_time=15,
        limit=5,
    )

    assert len(results) == 1
    assert results[0]["id"] == "r1"


@pytest.mark.asyncio
async def test_rate_recipe_raises_on_connection_error(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    with pytest.raises(RuntimeError):
        await recipe_db.rate_recipe("user", "recipe", 4)


@pytest.mark.asyncio
async def test_get_recipe_ratings_handles_errors(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    stats = await recipe_db.get_recipe_ratings("missing")

    assert stats["total_ratings"] == 0
    assert stats["average_rating"] == 0


@pytest.mark.asyncio
async def test_get_user_taste_profile_returns_none_when_missing(recipe_db):
    assert await recipe_db.get_user_taste_profile("missing-user") is None


@pytest.mark.asyncio
async def test_get_user_ratings_for_learning_handles_errors(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    rows = await recipe_db.get_user_ratings_for_learning("user")

    assert rows == []


@pytest.mark.asyncio
async def test_update_cuisine_preference_handles_errors(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    assert not await recipe_db.update_cuisine_preference("user", "italian", {})


@pytest.mark.asyncio
async def test_get_user_learning_progress_handles_errors(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    assert await recipe_db.get_user_learning_progress("user") is None


def test_init_shopping_optimization_tables_sync_handles_missing(recipe_db, monkeypatch):
    original_exists = os.path.exists

    def fake_exists(path):
        if path.endswith("04_shopping_optimization.sql"):
            return False
        return original_exists(path)

    monkeypatch.setattr(os.path, "exists", fake_exists)

    recipe_db.init_shopping_optimization_tables_sync()


@pytest.mark.asyncio
async def test_init_shopping_optimization_tables_handles_missing(recipe_db, monkeypatch):
    original_exists = os.path.exists

    def fake_exists(path):
        if path.endswith("04_shopping_optimization.sql"):
            return False
        return original_exists(path)

    monkeypatch.setattr(os.path, "exists", fake_exists)

    await recipe_db.init_shopping_optimization_tables()


@pytest.mark.asyncio
async def test_init_shopping_optimization_tables_runs(recipe_db):
    await recipe_db.init_shopping_optimization_tables()


@pytest.mark.asyncio
async def test_shopping_preferences_and_catalog_error_paths(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    assert await recipe_db.get_user_shopping_preferences("user") is None
    assert await recipe_db.create_or_update_user_shopping_preferences("user", {}) is False
    assert await recipe_db.get_stores() == []
    assert await recipe_db.get_product_categories() == []

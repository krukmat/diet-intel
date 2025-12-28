import json
import sqlite3
from datetime import datetime, timezone

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
    return RecipeDatabaseService(str(tmp_path / "recipe-core.db"))


def _make_generated_recipe(recipe_id="recipe-1", cuisine_type="mediterranean", tags=None):
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
        difficulty_level="easy",
        prep_time_minutes=10,
        cook_time_minutes=15,
        servings=2,
        ingredients=[ingredient],
        instructions=[instruction],
        nutrition=nutrition,
        tags=tags or ["test"],
        confidence_score=0.8,
        generation_time_ms=75.0,
    )


async def _create_recipe(recipe_db, recipe_id="recipe-1", cuisine="mediterranean", tags=None):
    recipe = _make_generated_recipe(recipe_id=recipe_id, cuisine_type=cuisine, tags=tags)
    await recipe_db.create_recipe(recipe, user_id="user-core")
    return recipe


@pytest.mark.asyncio
async def test_search_recipes_filters_by_tags(recipe_db):
    await _create_recipe(recipe_db, recipe_id="r-alpha", tags=["healthy", "lean"])
    await _create_recipe(recipe_db, recipe_id="r-beta", tags=["dessert"])

    results = await recipe_db.search_recipes(tags=["healthy"], limit=10)

    assert results
    assert all("healthy" in recipe_data["tags"] for recipe_data in results)


@pytest.mark.asyncio
async def test_search_recipes_handles_connection_error(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    result = await recipe_db.search_recipes(limit=1)

    assert result == []

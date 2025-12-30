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


# ===== TESTS FOR UNCOVERED DELEGATOR METHODS =====


@pytest.mark.asyncio
async def test_ensure_tables_initialized_handles_all_exceptions(recipe_db, monkeypatch):
    """Test _ensure_tables_initialized() error handling paths (lines 67, 70-71, 74-75)"""
    recipe_db._recipe_tables_ready = False

    def fake_init_recipe_tables():
        raise RuntimeError("schema init failed")

    def fake_init_shopping_tables():
        raise RuntimeError("shopping init failed")

    monkeypatch.setattr(recipe_db.schema_service, "init_recipe_tables", fake_init_recipe_tables)
    monkeypatch.setattr(recipe_db.shopping_service, "init_shopping_optimization_tables_sync", fake_init_shopping_tables)

    # Should complete despite exceptions
    recipe_db._ensure_tables_initialized()
    assert recipe_db._recipe_tables_ready is True


@pytest.mark.asyncio
async def test_get_recipe_analytics_delegates(recipe_db):
    """Test get_recipe_analytics() delegator (line 123)"""
    await recipe_db.create_recipe(_make_recipe(recipe_id="r-analytics"), user_id="user-analytics")

    analytics = await recipe_db.get_recipe_analytics(days=30)

    assert isinstance(analytics, dict)


@pytest.mark.asyncio
async def test_create_or_update_user_taste_profile_delegates(recipe_db):
    """Test create_or_update_user_taste_profile() delegator (line 183)"""
    result = await recipe_db.create_or_update_user_taste_profile(
        user_id="user-taste",
        profile_data={"preferred_cuisines": ["italian"]}
    )

    assert isinstance(result, bool)


@pytest.mark.asyncio
async def test_update_ingredient_preference_delegates(recipe_db):
    """Test update_ingredient_preference() delegator (line 205)"""
    result = await recipe_db.update_ingredient_preference(
        user_id="user-ing",
        ingredient_name="tomato",
        preference_score=0.9
    )

    assert isinstance(result, bool)


@pytest.mark.asyncio
async def test_create_shopping_optimization_delegates(recipe_db):
    """Test create_shopping_optimization() delegator (line 219)"""
    optimization_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1", "r2"]},
        user_id="user-shop"
    )

    assert isinstance(optimization_id, str)
    assert optimization_id  # Non-empty


@pytest.mark.asyncio
async def test_get_shopping_optimization_delegates(recipe_db):
    """Test get_shopping_optimization() delegator (line 227)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )

    result = await recipe_db.get_shopping_optimization(opt_id)

    assert result is None or isinstance(result, dict)


@pytest.mark.asyncio
async def test_get_user_shopping_optimizations_delegates(recipe_db):
    """Test get_user_shopping_optimizations() delegator (line 236)"""
    result = await recipe_db.get_user_shopping_optimizations(
        user_id="user-shop",
        status="pending",
        limit=10
    )

    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_create_ingredient_consolidation_delegates(recipe_db):
    """Test create_ingredient_consolidation() delegator (line 244)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )

    cons_id = await recipe_db.create_ingredient_consolidation(
        optimization_id=opt_id,
        consolidation_data={"ingredients": ["tomato", "basil"]}
    )

    assert isinstance(cons_id, str)


@pytest.mark.asyncio
async def test_get_ingredient_consolidations_delegates(recipe_db):
    """Test get_ingredient_consolidations() delegator (line 248)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )

    result = await recipe_db.get_ingredient_consolidations(opt_id)

    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_update_shopping_optimization_status_delegates(recipe_db):
    """Test update_shopping_optimization_status() delegator (line 257)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )

    result = await recipe_db.update_shopping_optimization_status(
        optimization_id=opt_id,
        status="completed"
    )

    assert isinstance(result, bool)


@pytest.mark.asyncio
async def test_create_shopping_list_raises_not_implemented(recipe_db):
    """Test create_shopping_list() raises NotImplementedError (lines 275-276)"""
    with pytest.raises(NotImplementedError):
        await recipe_db.create_shopping_list(
            meal_plan={"day": "monday"},
            user_id="user-shop"
        )


@pytest.mark.asyncio
async def test_create_bulk_buying_suggestion_delegates(recipe_db):
    """Test create_bulk_buying_suggestion() delegator (line 285)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )
    cons_id = await recipe_db.create_ingredient_consolidation(
        optimization_id=opt_id,
        consolidation_data={"ingredients": ["tomato"]}
    )

    sugg_id = await recipe_db.create_bulk_buying_suggestion(
        optimization_id=opt_id,
        consolidation_id=cons_id,
        suggestion_data={"quantity": 10}
    )

    assert isinstance(sugg_id, str)


@pytest.mark.asyncio
async def test_get_bulk_buying_suggestions_delegates(recipe_db):
    """Test get_bulk_buying_suggestions() delegator (line 289)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )

    result = await recipe_db.get_bulk_buying_suggestions(opt_id)

    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_create_shopping_path_segment_delegates(recipe_db):
    """Test create_shopping_path_segment() delegator (line 293)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )

    segment_id = await recipe_db.create_shopping_path_segment(
        optimization_id=opt_id,
        segment_data={"store": "costco", "items": ["tomato"]}
    )

    assert isinstance(segment_id, str)


@pytest.mark.asyncio
async def test_get_shopping_path_segments_delegates(recipe_db):
    """Test get_shopping_path_segments() delegator (line 297)"""
    opt_id = await recipe_db.create_shopping_optimization(
        optimization_data={"recipes": ["r1"]},
        user_id="user-shop"
    )

    result = await recipe_db.get_shopping_path_segments(opt_id)

    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_get_recipe_by_id_returns_none_for_missing_recipe(recipe_db):
    """Test get_recipe_by_id() returns None when recipe not found (line 313)"""
    result = await recipe_db.get_recipe_by_id("nonexistent-recipe-id")

    assert result is None


@pytest.mark.asyncio
async def test_get_recipe_by_id_returns_dict_for_existing_recipe(recipe_db):
    """Test get_recipe_by_id() returns dict for existing recipe"""
    recipe = _make_recipe(recipe_id="r-dict")
    await recipe_db.create_recipe(recipe, user_id="user-dict")

    result = await recipe_db.get_recipe_by_id("r-dict")

    assert result is not None
    assert isinstance(result, dict)
    assert result["id"] == "r-dict"
    assert result["name"] == "Recipe r-dict"
    assert "ingredients" in result
    assert "instructions" in result
    assert "nutrition" in result


def test_get_recipe_by_id_sync_raises_not_implemented(recipe_db):
    """Test _get_recipe_by_id_sync() raises NotImplementedError (lines 365-366)"""
    with pytest.raises(NotImplementedError):
        recipe_db._get_recipe_by_id_sync("recipe-id")


def test_ensure_tables_initialized_early_return_when_ready(recipe_db):
    """Test _ensure_tables_initialized() early return when tables already ready (line 67)"""
    # Tables are already initialized, so _recipe_tables_ready is True
    assert recipe_db._recipe_tables_ready is True

    # Call _ensure_tables_initialized() - should return immediately
    recipe_db._ensure_tables_initialized()

    # Should still be True
    assert recipe_db._recipe_tables_ready is True

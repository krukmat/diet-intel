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
    base = Path(__file__).resolve().parents[2]
    for rel_path in (
        "database/migrations/03_user_taste_profiles.sql",
        "database/migrations/04_shopping_optimization.sql",
    ):
        script_path = base / rel_path
        if script_path.exists():
            with service.get_connection() as conn:
                conn.executescript(script_path.read_text())
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
async def test_create_shopping_list_raises_on_connection_error(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    with pytest.raises(RuntimeError):
        await recipe_db.create_shopping_list(
            user_id="user",
            name="List",
            recipe_ids=["recipe"],
            ingredients_data={"item": 1},
        )


@pytest.mark.asyncio
async def test_get_user_taste_profile_returns_none_when_missing(recipe_db):
    assert await recipe_db.get_user_taste_profile("missing-user") is None


@pytest.mark.asyncio
async def test_get_user_ratings_for_learning_handles_errors(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    rows = await recipe_db.get_user_ratings_for_learning("user")

    assert rows == []


@pytest.mark.asyncio
async def test_update_cuisine_preference_persists_row(recipe_db):
    assert await recipe_db.update_cuisine_preference(
        "user",
        "italian",
        {"preference_score": 0.7, "total_ratings": 3},
    )

    with recipe_db.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT preference_score FROM user_cuisine_preferences WHERE id = ?",
            ("user_italian",),
        ).fetchone()

    assert row is not None
    assert row["preference_score"] == 0.7


@pytest.mark.asyncio
async def test_update_cuisine_preference_handles_errors(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    assert not await recipe_db.update_cuisine_preference("user", "italian", {})


@pytest.mark.asyncio
async def test_update_ingredient_preference_category_branches(recipe_db):
    cases = [
        ("loved", 0.7, "Tomato"),
        ("liked", 0.2, "Basil"),
        ("neutral", -0.1, "Onion"),
        ("disliked", -0.3, "Garlic"),
        ("avoided", -0.7, "Mushroom"),
    ]

    for expected, score, ingredient in cases:
        assert await recipe_db.update_ingredient_preference(
            "user",
            ingredient,
            {"preference_score": score},
        )

        with recipe_db.get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute(
                "SELECT preference_category FROM user_ingredient_preferences WHERE id = ?",
                (f"user_{ingredient.lower()}",),
            ).fetchone()

        assert row is not None
        assert row["preference_category"] == expected


@pytest.mark.asyncio
async def test_get_user_learning_progress_lifecycle(recipe_db):
    assert await recipe_db.get_user_learning_progress("unknown") is None

    with recipe_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO user_learning_progress (
                user_id, ratings_milestone, cuisines_explored, ingredients_learned,
                profile_accuracy_score, recommendation_success_rate, dominant_cuisine,
                flavor_profile, cooking_complexity_preference, achievements
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "user-progress",
                10,
                4,
                12,
                0.8,
                0.75,
                "italian",
                "savory",
                "moderate",
                json.dumps(["milestone"]),
            ),
        )
        conn.commit()

    progress = await recipe_db.get_user_learning_progress("user-progress")
    assert progress is not None
    assert progress["ratings_milestone"] == 10
    assert progress["achievements"] == ["milestone"]


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
async def test_create_shopping_optimization_raises_on_connection_error(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    with pytest.raises(sqlite3.OperationalError):
        await recipe_db.create_shopping_optimization({"recipe_ids": []}, user_id="user")


@pytest.mark.asyncio
async def test_get_shopping_optimization_with_related_data(recipe_db):
    optimization_id = await recipe_db.create_shopping_optimization(
        {"recipe_ids": ["recipe-1"], "optimization_status": "pending"},
        user_id="user-opt",
    )

    consolidation_id = await recipe_db.create_ingredient_consolidation(
        optimization_id,
        {
            "consolidated_ingredient_name": "tomato",
            "source_recipes": [{"recipe_id": "recipe-1", "quantity": 2}],
            "total_consolidated_quantity": 2,
            "final_unit": "pcs",
        },
    )

    await recipe_db.create_bulk_buying_suggestion(
        optimization_id,
        consolidation_id,
        {
            "suggestion_type": "bulk_discount",
            "current_needed_quantity": 2,
            "suggested_bulk_quantity": 10,
            "bulk_unit": "pcs",
            "regular_unit_price": 0.5,
            "bulk_unit_price": 0.4,
        },
    )

    await recipe_db.create_shopping_path_segment(
        optimization_id,
        {"segment_order": 1, "store_section": "produce"},
    )

    optimization = await recipe_db.get_shopping_optimization(optimization_id)
    assert optimization is not None
    assert optimization["consolidations"]
    assert optimization["bulk_suggestions"]
    assert optimization["path_segments"]

    assert await recipe_db.get_shopping_optimization(optimization_id, user_id="other") is None


@pytest.mark.asyncio
async def test_get_user_shopping_optimizations_filters_status(recipe_db):
    await recipe_db.create_shopping_optimization(
        {"recipe_ids": ["recipe-1"], "optimization_status": "pending"},
        user_id="user-opt",
    )
    await recipe_db.create_shopping_optimization(
        {"recipe_ids": ["recipe-2"], "optimization_status": "optimized"},
        user_id="user-opt",
    )

    optimizations = await recipe_db.get_user_shopping_optimizations(
        "user-opt",
        status="optimized",
        limit=5,
    )

    assert len(optimizations) == 1
    assert optimizations[0]["optimization_status"] == "optimized"


@pytest.mark.asyncio
async def test_shopping_optimization_error_paths(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    with pytest.raises(sqlite3.OperationalError):
        await recipe_db.create_ingredient_consolidation("opt", {"consolidated_ingredient_name": "tomato", "total_consolidated_quantity": 1, "final_unit": "pcs"})

    assert await recipe_db.get_ingredient_consolidations("opt") == []

    with pytest.raises(sqlite3.OperationalError):
        await recipe_db.create_bulk_buying_suggestion(
            "opt",
            "cons",
            {
                "suggestion_type": "bulk",
                "current_needed_quantity": 1,
                "suggested_bulk_quantity": 2,
                "bulk_unit": "pcs",
                "regular_unit_price": 1.0,
                "bulk_unit_price": 0.8,
            },
        )

    assert await recipe_db.get_bulk_buying_suggestions("opt") == []

    with pytest.raises(sqlite3.OperationalError):
        await recipe_db.create_shopping_path_segment("opt", {"segment_order": 1, "store_section": "aisle"})

    assert await recipe_db.get_shopping_path_segments("opt") == []
    assert await recipe_db.update_shopping_optimization_status("opt", "optimized") is False


@pytest.mark.asyncio
async def test_shopping_preferences_and_catalog_error_paths(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    assert await recipe_db.get_user_shopping_preferences("user") is None
    assert await recipe_db.create_or_update_user_shopping_preferences("user", {}) is False
    assert await recipe_db.get_stores() == []
    assert await recipe_db.get_product_categories() == []

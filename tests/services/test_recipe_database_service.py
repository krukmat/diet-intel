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
    return RecipeDatabaseService(str(db_path))


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


@pytest.mark.asyncio
async def test_search_and_rating_flow(recipe_service):
    recipe = _sample_recipe()
    await recipe_service.create_recipe(recipe, user_id="hero")

    results = await recipe_service.search_recipes(cuisine_type="mediterranean")
    assert results
    assert results[0]["name"] == recipe.name

    rating_id = await recipe_service.rate_recipe("hero", "recipe-1", 5, review="great", made_modifications=True, would_make_again=True)
    assert rating_id

    stats = await recipe_service.get_recipe_ratings("recipe-1")
    assert stats["total_ratings"] == 1
    assert stats["average_rating"] == 5.0

    analytics = await recipe_service.get_recipe_analytics(days=1)
    assert analytics["generation_stats"]["total_requests"] >= 0

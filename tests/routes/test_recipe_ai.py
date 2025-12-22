"""Tests for recipe_ai route endpoints - Phase 3.5 coverage improvement"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.models.recipe import (
    GeneratedRecipeResponse, RecipeGenerationRequest, DifficultyLevel,
    CuisineType, MealType, CreatedBy, RecipeSearchResponse,
    RecipeRatingRequest, ShoppingListRequest, ShoppingListResponse,
    UserTasteProfileResponse, PersonalizedRecipeRequest,
    RecipeAnalyticsResponse, CuisinePreference, IngredientPreference,
    BatchRecipeTranslationRequest
)
from app.models.shopping import ShoppingOptimizationRequest, ShoppingOptimizationResponse
from app.models.user import User, UserRole
from app.routes import recipe_ai as recipe_ai_module


# ===== HELPER FUNCTIONS =====

def _create_test_user() -> User:
    """Create a valid User object for testing"""
    return User(
        id="user-123",
        email="test@example.com",
        full_name="Test User",
        avatar_url=None,
        is_active=True,
        is_developer=False,
        role="standard",
        email_verified=True,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


def _create_test_recipe_response(recipe_id: str = "recipe-123") -> GeneratedRecipeResponse:
    """Create a valid GeneratedRecipeResponse for testing"""
    return GeneratedRecipeResponse(
        id=recipe_id,
        name="Pasta Carbonara",
        description="Classic Italian pasta dish",
        cuisine_type="italian",
        difficulty_level=DifficultyLevel.EASY,
        prep_time_minutes=10,
        cook_time_minutes=20,
        servings=4,
        ingredients=[
            {
                "name": "spaghetti",
                "quantity": 400,
                "unit": "g",
                "calories_per_unit": 1.31,
                "protein_g_per_unit": 0.12,
                "fat_g_per_unit": 0.01,
                "carbs_g_per_unit": 0.25,
                "is_optional": False,
                "preparation_note": None
            }
        ],
        instructions=[
            {
                "step_number": 1,
                "instruction": "Cook pasta",
                "cooking_method": "boiling",
                "duration_minutes": 10,
                "temperature_celsius": 100
            }
        ],
        nutrition={
            "calories_per_serving": 350.0,
            "protein_g_per_serving": 12.0,
            "fat_g_per_serving": 8.0,
            "carbs_g_per_serving": 60.0,
            "fiber_g_per_serving": 2.0,
            "sugar_g_per_serving": 1.0,
            "sodium_mg_per_serving": 400.0,
            "recipe_score": 8.5
        },
        created_by=CreatedBy.AI_GENERATED,
        confidence_score=0.85,
        generation_time_ms=150.0,
        tags=["italian", "pasta", "quick"],
        created_at=datetime.now()
    )


def _create_test_generation_request() -> RecipeGenerationRequest:
    """Create a valid RecipeGenerationRequest for testing"""
    return RecipeGenerationRequest(
        cuisine_preferences=["italian"],
        dietary_restrictions=[],
        difficulty_preference=DifficultyLevel.EASY,
        meal_type=MealType.LUNCH,
        target_calories_per_serving=350.0,
        target_protein_g=15.0,
        target_carbs_g=60.0,
        target_fat_g=10.0,
        servings=4,
        max_prep_time_minutes=15,
        max_cook_time_minutes=30,
        preferred_ingredients=["pasta"],
        excluded_ingredients=[]
    )


# ===== FIXTURE SETUP =====

@pytest.fixture
def current_user() -> User:
    """Fixture for authenticated user"""
    return _create_test_user()


@pytest.fixture
def mock_recipe_engine():
    """Mock RecipeAIEngine with required methods"""
    engine = AsyncMock()
    engine.generate_recipe_with_translation = AsyncMock(
        return_value=_create_test_recipe_response()
    )
    engine.optimize_existing_recipe = AsyncMock(
        return_value=_create_test_recipe_response()
    )
    engine.generate_recipe = AsyncMock(
        return_value=_create_test_recipe_response()
    )
    engine.generate_shopping_list = AsyncMock(
        return_value={"ingredients": [{"name": "pasta", "quantity": 400}]}
    )
    engine.translate_existing_recipe = AsyncMock(
        return_value=_create_test_recipe_response()
    )
    engine.batch_translate_recipes = AsyncMock(
        return_value={"recipe-123": _create_test_recipe_response()}
    )
    return engine


@pytest.fixture
def mock_recipe_db_service():
    """Mock RecipeDatabase service"""
    service = AsyncMock()
    service.log_recipe_generation_request = AsyncMock()
    service.create_recipe = AsyncMock(return_value="recipe-123")
    service.get_recipe = AsyncMock(return_value=_create_test_recipe_response())
    # search_recipes returns list of dicts, not response objects
    service.search_recipes = AsyncMock(return_value=[
        {
            "id": "recipe-123",
            "name": "Pasta Carbonara",
            "description": "Classic Italian pasta",
            "cuisine_type": "italian",
            "difficulty_level": "easy"
        }
    ])
    service.rate_recipe = AsyncMock(return_value="rating-456")
    service.get_recipe_ratings = AsyncMock(
        return_value={
            "total_ratings": 5,
            "average_rating": 4.2,
            "would_make_again_percentage": 80.0
        }
    )
    service.create_shopping_list = AsyncMock(return_value="shopping-789")
    service.get_recipe_analytics = AsyncMock(
        return_value={
            "period_days": 30,
            "generation_stats": {"total_generated": 10},
            "popular_cuisines": [{"cuisine": "italian", "count": 5}],
            "rating_stats": {"avg_rating": 4.2}
        }
    )
    service.create_or_update_user_taste_profile = AsyncMock()
    service.get_user_taste_profile = AsyncMock(
        return_value={
            "user_id": "user-123",
            "profile_confidence": 0.8,
            "total_ratings_analyzed": 10,
            "cuisine_preferences": [{"cuisine": "italian", "score": 0.9, "count": 5}],
            "liked_ingredients": [],
            "disliked_ingredients": [],
            "preferred_prep_time_minutes": 30,
            "preferred_cook_time_minutes": 45,
            "quick_meal_preference": 0.7,
            "preferred_calories_per_serving": 400.0,
            "preferred_protein_ratio": 0.25,
            "preferred_carb_ratio": 0.45,
            "preferred_fat_ratio": 0.30,
            "modification_tendency": 0.1,
            "repeat_cooking_tendency": 0.8,
            "last_learning_update": datetime.now(),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    )
    service.get_user_learning_progress = AsyncMock(
        return_value={
            "user_id": "user-123",
            "ratings_milestone": 10,
            "cuisines_explored": 5,
            "ingredients_learned": 25,
            "profile_accuracy_score": 0.85,
            "recommendation_success_rate": 0.80,
            "learning_started_at": datetime.now()
        }
    )
    service.get_connection = MagicMock()
    return service


@pytest.fixture
def mock_taste_learning_service():
    """Mock TasteLearningService"""
    service = AsyncMock()
    service.analyze_cuisine_preferences = AsyncMock(
        return_value={
            "cuisine_preferences": {"italian": {"raw_score": 0.9, "total_ratings": 5}},
            "confidence_score": 0.8,
            "total_ratings_analyzed": 10
        }
    )
    service.update_cuisine_preferences_in_db = AsyncMock()
    service.analyze_ingredient_preferences = AsyncMock(
        return_value={
            "ingredient_preferences": {"garlic": {"raw_score": 0.8, "total_occurrences": 3}},
            "categorized_ingredients": {"loved": ["garlic"], "liked": [], "disliked": [], "avoided": []},
            "error": None
        }
    )
    service.update_ingredient_preferences_in_db = AsyncMock()
    return service


@pytest.fixture
def mock_recommendation_engine():
    """Mock RecommendationEngine"""
    engine = AsyncMock()
    engine.apply_personalization = AsyncMock(
        return_value=(MagicMock(), {"applied": True, "profile_confidence": 0.8, "enhancements": []})
    )
    engine.score_recipe_personalization = AsyncMock(
        return_value={"overall_score": 0.85}
    )
    return engine


# ===== TESTS: RECIPE GENERATION =====

@pytest.mark.asyncio
async def test_generate_recipe_success(
    current_user, mock_recipe_engine, mock_recipe_db_service,
    mock_recommendation_engine
):
    """Test successful recipe generation"""
    request = _create_test_generation_request()

    with patch.object(recipe_ai_module, 'recipe_engine', mock_recipe_engine):
        with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
            with patch.object(recipe_ai_module, 'recommendation_engine', mock_recommendation_engine):
                with patch.object(recipe_ai_module, 'current_user_dependency', return_value=current_user):
                    response = await recipe_ai_module.generate_recipe(
                        request=request,
                        background_tasks=MagicMock(),
                        current_user=current_user
                    )

    assert response.id == "recipe-123"
    assert response.name == "Pasta Carbonara"
    assert mock_recipe_db_service.create_recipe.called


@pytest.mark.asyncio
async def test_generate_recipe_error_handling(
    current_user, mock_recipe_engine, mock_recipe_db_service
):
    """Test error handling in recipe generation"""
    request = _create_test_generation_request()

    mock_recipe_engine.generate_recipe_with_translation = AsyncMock(
        side_effect=Exception("Generation failed")
    )

    with patch.object(recipe_ai_module, 'recipe_engine', mock_recipe_engine):
        with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
            with patch.object(recipe_ai_module, 'recommendation_engine', AsyncMock()):
                with pytest.raises(HTTPException) as exc_info:
                    await recipe_ai_module.generate_recipe(
                        request=request,
                        background_tasks=MagicMock(),
                        current_user=current_user
                    )

    assert exc_info.value.status_code == 500


# ===== TESTS: RECIPE OPTIMIZATION =====

@pytest.mark.asyncio
async def test_optimize_recipe_success(
    current_user, mock_recipe_engine, mock_recipe_db_service
):
    """Test successful recipe optimization"""
    from app.models.recipe import RecipeOptimizationRequest

    request = RecipeOptimizationRequest(
        recipe_data={"name": "Original Recipe"},
        optimization_goal="weight_loss"
    )

    with patch.object(recipe_ai_module, 'recipe_engine', mock_recipe_engine):
        with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
            response = await recipe_ai_module.optimize_recipe(
                request=request,
                current_user=current_user
            )

    assert response.id == "recipe-123"
    assert mock_recipe_db_service.create_recipe.called


# ===== TESTS: RECIPE SEARCH =====

@pytest.mark.asyncio
async def test_search_recipes_success(
    current_user, mock_recipe_db_service
):
    """Test successful recipe search"""
    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.search_recipes(
            query=None,
            cuisine_type="italian",
            difficulty_level=None,
            max_prep_time=None,
            dietary_restrictions=[],
            tags=[],
            page=1,
            page_size=20,
            current_user=current_user
        )

    assert isinstance(response, RecipeSearchResponse)
    assert response.total_count > 0


@pytest.mark.asyncio
async def test_search_recipes_with_optional_user(
    mock_recipe_db_service
):
    """Test recipe search with optional user (unauthenticated)"""
    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.search_recipes(
            query=None,
            cuisine_type=None,
            difficulty_level=None,
            max_prep_time=None,
            dietary_restrictions=[],
            tags=[],
            page=1,
            page_size=20,
            current_user=None
        )

    assert isinstance(response, RecipeSearchResponse)


# ===== TESTS: RECIPE RATING =====

@pytest.mark.asyncio
async def test_rate_recipe_success(
    current_user, mock_recipe_db_service
):
    """Test successful recipe rating submission"""
    rating_request = RecipeRatingRequest(
        rating=5,
        review="Delicious!",
        made_modifications=False,
        would_make_again=True
    )

    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.rate_recipe(
            recipe_id="recipe-123",
            rating_request=rating_request,
            current_user=current_user
        )

    assert response["rating_id"] == "rating-456"
    assert response["rating"] == 5


@pytest.mark.asyncio
async def test_rate_nonexistent_recipe(
    current_user, mock_recipe_db_service
):
    """Test rating a non-existent recipe"""
    mock_recipe_db_service.get_recipe = AsyncMock(return_value=None)

    rating_request = RecipeRatingRequest(rating=5)

    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        with pytest.raises(HTTPException) as exc_info:
            await recipe_ai_module.rate_recipe(
                recipe_id="nonexistent",
                rating_request=rating_request,
                current_user=current_user
            )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_recipe_ratings(
    current_user, mock_recipe_db_service
):
    """Test getting recipe rating statistics"""
    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.get_recipe_ratings(
            recipe_id="recipe-123",
            current_user=current_user
        )

    assert response.total_ratings == 5
    assert response.average_rating == 4.2


# ===== TESTS: HEALTH CHECK =====

@pytest.mark.asyncio
async def test_health_check_success(
    mock_recipe_db_service
):
    """Test health check endpoint"""
    mock_recipe_db_service.get_connection = MagicMock(
        return_value=MagicMock(__enter__=MagicMock(), __exit__=MagicMock())
    )

    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.recipe_ai_health_check()

    assert response["recipe_ai_engine"] == "healthy"
    assert "timestamp" in response


# ===== TESTS: SHOPPING LIST =====

@pytest.mark.asyncio
async def test_generate_shopping_list_success(
    current_user, mock_recipe_engine, mock_recipe_db_service
):
    """Test shopping list generation"""
    shopping_request = ShoppingListRequest(
        name="Weekly Shopping",
        recipe_ids=["recipe-123"],
        store_preferences=None,
        budget_limit=None
    )

    with patch.object(recipe_ai_module, 'recipe_engine', mock_recipe_engine):
        with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
            response = await recipe_ai_module.generate_shopping_list(
                request=shopping_request,
                current_user=current_user
            )

    assert response.id == "shopping-789"
    assert response.name == "Weekly Shopping"


# ===== TESTS: TASTE LEARNING =====

@pytest.mark.asyncio
async def test_learn_user_preferences_success(
    current_user, mock_taste_learning_service, mock_recipe_db_service
):
    """Test learning user preferences from ratings"""
    with patch.object(recipe_ai_module, 'taste_learning_service', mock_taste_learning_service):
        with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
            response = await recipe_ai_module.learn_user_preferences(
                request=None,
                current_user=current_user
            )

    assert response.user_id == "user-123"
    assert response.profile_confidence > 0


@pytest.mark.asyncio
async def test_get_user_taste_profile_success(
    current_user, mock_recipe_db_service
):
    """Test retrieving user taste profile"""
    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.get_user_taste_profile(
            user_id="user-123",
            current_user=current_user
        )

    assert response.user_id == "user-123"
    assert response.profile_confidence > 0


@pytest.mark.asyncio
async def test_get_user_taste_profile_creates_new_if_missing(
    current_user, mock_recipe_db_service, mock_taste_learning_service
):
    """Test creating new taste profile if none exists"""
    # When get_user_taste_profile returns None, it should create one
    mock_recipe_db_service.get_user_taste_profile = AsyncMock(return_value=None)

    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        with patch.object(recipe_ai_module, 'taste_learning_service', mock_taste_learning_service):
            response = await recipe_ai_module.get_user_taste_profile(
                user_id="user-123",
                current_user=current_user
            )

    assert response.user_id == "user-123"
    assert mock_taste_learning_service.analyze_cuisine_preferences.called


@pytest.mark.asyncio
async def test_get_user_learning_progress(
    current_user, mock_recipe_db_service
):
    """Test retrieving user learning progress"""
    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.get_user_learning_progress(
            user_id="user-123",
            current_user=current_user
        )

    assert response.user_id == "user-123"
    assert response.ratings_milestone >= 0


# ===== TESTS: PERSONALIZED RECIPES =====

@pytest.mark.asyncio
async def test_generate_personalized_recipe_success(
    current_user, mock_recipe_engine, mock_recipe_db_service
):
    """Test generating personalized recipe with taste profile"""
    base_request = _create_test_generation_request()
    request = PersonalizedRecipeRequest(
        user_id=current_user.id,
        base_request=base_request,
        use_taste_profile=True
    )

    with patch.object(recipe_ai_module, 'recipe_engine', mock_recipe_engine):
        with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
            response = await recipe_ai_module.generate_personalized_recipe(
                request=request,
                current_user=current_user
            )

    assert response.id == "recipe-123"
    assert mock_recipe_db_service.create_recipe.called


# ===== TESTS: ANALYTICS =====

@pytest.mark.asyncio
async def test_get_recipe_analytics_success(
    current_user, mock_recipe_db_service
):
    """Test retrieving recipe analytics"""
    current_user.is_developer = True

    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.get_recipe_analytics(
            days=30,
            current_user=current_user
        )

    assert response.period_days == 30
    assert "generation_stats" in response.dict()


@pytest.mark.asyncio
async def test_get_recipe_analytics_access_denied(
    current_user, mock_recipe_db_service
):
    """Test analytics access control"""
    current_user.is_developer = False

    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        with pytest.raises(HTTPException) as exc_info:
            await recipe_ai_module.get_recipe_analytics(
                days=30,
                current_user=current_user
            )

    assert exc_info.value.status_code == 403


# ===== TESTS: RECIPE FEEDBACK =====

@pytest.mark.asyncio
async def test_submit_recipe_feedback_success(
    current_user
):
    """Test submitting recipe feedback"""
    feedback_data = {"rating": 5, "comment": "Great recipe!"}

    response = await recipe_ai_module.submit_recipe_feedback(
        feedback_data=feedback_data,
        current_user=current_user
    )

    assert response["status"] == "received"
    assert "feedback_id" in response


# ===== TESTS: TRANSLATION =====

@pytest.mark.asyncio
async def test_translate_recipe_to_spanish_success(
    current_user, mock_recipe_engine, mock_recipe_db_service
):
    """Test translating recipe to Spanish"""
    with patch.object(recipe_ai_module, 'recipe_engine', mock_recipe_engine):
        with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
            response = await recipe_ai_module.translate_recipe_to_spanish(
                recipe_id="recipe-123",
                current_user=current_user
            )

    assert response.id == "recipe-123"
    assert mock_recipe_db_service.create_recipe.called


@pytest.mark.asyncio
async def test_get_supported_languages():
    """Test retrieving supported languages"""
    response = await recipe_ai_module.get_supported_languages()

    assert "en" in response["supported_languages"]
    assert "es" in response["supported_languages"]


# ===== TESTS: GET RECIPE =====

@pytest.mark.asyncio
async def test_get_recipe_success(
    mock_recipe_db_service
):
    """Test retrieving a specific recipe"""
    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        response = await recipe_ai_module.get_recipe(
            recipe_id="recipe-123",
            current_user=None
        )

    assert response.id == "recipe-123"


@pytest.mark.asyncio
async def test_get_nonexistent_recipe(
    mock_recipe_db_service
):
    """Test retrieving non-existent recipe"""
    mock_recipe_db_service.get_recipe = AsyncMock(return_value=None)

    with patch.object(recipe_ai_module, 'recipe_db_service', mock_recipe_db_service):
        with pytest.raises(HTTPException) as exc_info:
            await recipe_ai_module.get_recipe(
                recipe_id="nonexistent",
                current_user=None
            )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_analyze_recipe_nutrition(
    current_user
):
    """Test nutrition analysis endpoint"""
    recipe_data = {"name": "Test Recipe", "ingredients": []}

    response = await recipe_ai_module.analyze_recipe_nutrition(
        recipe_data=recipe_data,
        current_user=current_user
    )

    assert "message" in response
    assert response["recipe_data_received"] is True


# ===== TESTS: SHOPPING OPTIMIZATION =====

@pytest.mark.asyncio
async def test_optimize_shopping_list_success(current_user):
    """Test shopping optimization endpoint"""
    request = ShoppingOptimizationRequest(recipe_ids=["recipe-123"])

    consolidated = [
        {
            "id": "ing-1",
            "shopping_optimization_id": "opt-1",
            "consolidated_ingredient_name": "tomato",
            "source_recipes": [
                {
                    "recipe_id": "recipe-123",
                    "recipe_name": "Pasta",
                    "original_quantity": 2.0,
                    "unit": "pcs",
                }
            ],
            "total_consolidated_quantity": 2.0,
            "final_unit": "pcs",
        }
    ]

    optimization_response = ShoppingOptimizationResponse(
        optimization_id="opt-1",
        optimization_name="Shopping List for 1 Recipe",
        recipe_ids=["recipe-123"],
        consolidated_ingredients=consolidated,
        optimization_metrics={
            "total_original_ingredients": 2,
            "total_consolidated_ingredients": 1,
            "consolidation_opportunities": 1,
            "efficiency_score": 0.8,
            "ingredients_reduced_percent": 50.0,
            "estimated_cost": 10.0,
            "optimization_score": 0.75,
        },
        bulk_suggestions=[],
        shopping_path=[],
        estimated_total_cost=10.0,
        estimated_savings=2.0,
        created_at=datetime.now(),
        expires_at=None,
    )

    mock_service = AsyncMock()
    mock_service.optimize_shopping_list = AsyncMock(return_value=optimization_response)

    with patch.object(recipe_ai_module, "ShoppingOptimizationService", return_value=mock_service):
        response = await recipe_ai_module.optimize_shopping_list(
            request=request,
            current_user=current_user,
        )

    assert response.optimization_id == "opt-1"
    assert response.optimization_name == "Shopping List for 1 Recipe"


@pytest.mark.asyncio
async def test_get_shopping_optimization_success(current_user):
    """Test retrieving shopping optimization"""
    consolidated = [
        {
            "id": "ing-1",
            "shopping_optimization_id": "opt-1",
            "consolidated_ingredient_name": "tomato",
            "source_recipes": [
                {
                    "recipe_id": "recipe-123",
                    "recipe_name": "Pasta",
                    "original_quantity": 2.0,
                    "unit": "pcs",
                }
            ],
            "total_consolidated_quantity": 2.0,
            "final_unit": "pcs",
        }
    ]

    optimization_response = ShoppingOptimizationResponse(
        optimization_id="opt-1",
        optimization_name="Shopping List for 1 Recipe",
        recipe_ids=["recipe-123"],
        consolidated_ingredients=consolidated,
        optimization_metrics={
            "total_original_ingredients": 2,
            "total_consolidated_ingredients": 1,
            "consolidation_opportunities": 1,
            "efficiency_score": 0.8,
            "ingredients_reduced_percent": 50.0,
            "estimated_cost": 10.0,
            "optimization_score": 0.75,
        },
        bulk_suggestions=[],
        shopping_path=[],
        estimated_total_cost=10.0,
        estimated_savings=2.0,
        created_at=datetime.now(),
        expires_at=None,
    )

    mock_service = AsyncMock()
    mock_service.get_shopping_optimization = AsyncMock(return_value=optimization_response)

    with patch.object(recipe_ai_module, "ShoppingOptimizationService", return_value=mock_service):
        response = await recipe_ai_module.get_shopping_optimization(
            optimization_id="opt-1",
            current_user=current_user,
        )

    assert response.optimization_id == "opt-1"
    assert response.recipe_ids == ["recipe-123"]


# ===== TESTS: BATCH TRANSLATION =====

@pytest.mark.asyncio
async def test_batch_translate_recipes_success(
    current_user, mock_recipe_engine, mock_recipe_db_service
):
    """Test batch translation endpoint"""
    request = BatchRecipeTranslationRequest(
        recipe_ids=["recipe-123"],
        target_language="es",
    )

    mock_recipe_db_service.get_recipe = AsyncMock(return_value=_create_test_recipe_response())
    mock_recipe_engine.batch_translate_recipes = AsyncMock(
        return_value={"recipe-123": _create_test_recipe_response("translated-1")}
    )

    with patch.object(recipe_ai_module, "recipe_engine", mock_recipe_engine):
        with patch.object(recipe_ai_module, "recipe_db_service", mock_recipe_db_service):
            response = await recipe_ai_module.batch_translate_recipes_to_spanish(
                request=request,
                current_user=current_user,
            )

    assert response["successful_count"] == 1
    assert response["failed_count"] == 0
    assert "recipe-123" in response["translations"]

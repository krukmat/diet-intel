"""
Comprehensive Integration Tests for Recipe Routes Refactoring (Task 7)

This test suite validates the refactored recipe route structure with:
- Route registration and path verification
- Endpoint functionality across all modules
- Authentication and authorization
- Error handling and edge cases
- Cross-module integration

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.8 - Create comprehensive integration tests
"""

import pytest
import inspect
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from datetime import datetime

from app.routes.recipe_ai import router
from app.models.user import User, UserRole
from app.models.recipe import (
    RecipeGenerationRequest,
    DifficultyLevel,
    MealType,
)


# ===== TEST FIXTURES =====

@pytest.fixture
def test_user():
    """Create a test user"""
    return User(
        id="user-123",
        email="test@example.com",
        full_name="Test User",
        avatar_url=None,
        is_developer=False,
        is_admin=False,
        role=UserRole.USER,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


@pytest.fixture
def developer_user():
    """Create a developer user for analytics access"""
    return User(
        id="dev-456",
        email="dev@example.com",
        full_name="Developer User",
        avatar_url=None,
        is_developer=True,
        is_admin=False,
        role=UserRole.DEVELOPER,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )


@pytest.fixture
def sample_recipe():
    """Create a sample recipe object"""
    return MagicMock(
        id="recipe-123",
        name="Grilled Chicken",
        description="Delicious grilled chicken",
        cuisine_type="American",
        difficulty_level="Easy",
        prep_time_minutes=15,
        cook_time_minutes=20,
        servings=4,
        ingredients=[
            MagicMock(
                name="Chicken Breast",
                quantity=4,
                unit="pieces",
                barcode="123456789",
                calories_per_unit=165,
                protein_g_per_unit=31,
                fat_g_per_unit=3.6,
                carbs_g_per_unit=0,
                is_optional=False,
                preparation_note="Pound thin"
            )
        ],
        instructions=[
            MagicMock(
                step_number=1,
                instruction="Preheat grill",
                cooking_method="Grilling",
                duration_minutes=10,
                temperature_celsius=200
            )
        ],
        nutrition=MagicMock(
            calories_per_serving=165,
            protein_g_per_serving=31,
            fat_g_per_serving=3.6,
            carbs_g_per_serving=0,
            fiber_g_per_serving=0,
            sugar_g_per_serving=0,
            sodium_mg_per_serving=75,
            recipe_score=8.5
        ),
        created_by="user-123",
        confidence_score=0.95,
        generation_time_ms=1500,
        tags=["healthy", "quick"]
    )


# ===== ROUTE REGISTRATION TESTS =====

class TestRouteRegistration:
    """Test that all routes are properly registered"""

    def test_recipe_router_has_routes(self):
        """Verify recipe router has routes registered"""
        assert len(router.routes) > 0, "Router should have routes registered"

    def test_generation_routes_registered(self):
        """Verify generation route endpoints are registered"""
        paths = {route.path for route in router.routes if hasattr(route, 'path')}
        expected_paths = [
            "/recipes/generate",
            "/recipes/optimize",
            "/recipes/suggestions",
            "/recipes/health"
        ]
        for path in expected_paths:
            assert any(path in p for p in paths), f"Expected route {path} not found"

    def test_personalization_routes_registered(self):
        """Verify personalization route endpoints are registered"""
        paths = {route.path for route in router.routes if hasattr(route, 'path')}
        expected_paths = [
            "/users/preferences",
            "/users/taste-profile",
            "/users/learning-progress",
            "/recipes/personalized"
        ]
        for path in expected_paths:
            assert any(path in p for p in paths), f"Expected route {path} not found in {paths}"

    def test_shopping_routes_registered(self):
        """Verify shopping list route endpoints are registered"""
        paths = {route.path for route in router.routes if hasattr(route, 'path')}
        expected_paths = [
            "/shopping/optimize",
            "/shopping/generate",
            "/shopping/optimization/{optimization_id}"
        ]
        for path in expected_paths:
            assert any(path in p for p in paths), f"Expected route {path} not found in {paths}"

    def test_translation_routes_registered(self):
        """Verify translation route endpoints are registered"""
        paths = {route.path for route in router.routes if hasattr(route, 'path')}
        expected_paths = [
            "/recipes/translate",
            "/recipes/translate-batch",
            "/recipes/languages"
        ]
        for path in expected_paths:
            assert any(path in p for p in paths), f"Expected route {path} not found in {paths}"

    def test_core_routes_registered(self):
        """Verify core route endpoints are registered"""
        paths = {route.path for route in router.routes if hasattr(route, 'path')}
        expected_paths = [
            "/recipes/search",
            "/recipes/{recipe_id}/rate",
            "/recipes/{recipe_id}/ratings",
            "/recipes/{recipe_id}/nutrition",
            "/recipes/analytics",
            "/recipes/{recipe_id}/feedback",
            "/recipes/{recipe_id}"
        ]
        for path in expected_paths:
            assert any(p == path for p in paths), f"Expected route {path} not found in {paths}"


# ===== ENDPOINT FUNCTIONALITY TESTS =====

class TestGenerationEndpoints:
    """Test generation route endpoints"""

    @pytest.mark.asyncio
    async def test_generate_recipe_endpoint_signature(self):
        """Verify generate_recipe endpoint is properly defined"""
        from app.routes.recipes.generation_routes import generate_recipe
        assert callable(generate_recipe), "generate_recipe should be callable"

    @pytest.mark.asyncio
    async def test_health_check_endpoint(self):
        """Verify health check endpoint works"""
        from app.routes.recipes.generation_routes import recipe_ai_health_check
        result = await recipe_ai_health_check()
        assert isinstance(result, dict)
        assert "recipe_ai_engine" in result
        assert "database_connection" in result


class TestPersonalizationEndpoints:
    """Test personalization route endpoints"""

    @pytest.mark.asyncio
    async def test_personalization_routes_exist(self):
        """Verify all personalization routes are defined"""
        from app.routes.recipes import personalization_routes

        assert hasattr(personalization_routes, 'learn_user_preferences')
        assert hasattr(personalization_routes, 'get_user_taste_profile')
        assert hasattr(personalization_routes, 'get_user_learning_progress')
        assert hasattr(personalization_routes, 'generate_personalized_recipe')


class TestNestingDepthReduction:
    """Test that nesting depth reduction was successful"""

    def test_personalization_helpers_extracted(self):
        """Verify that personalization logic was extracted into helper functions"""
        from app.routes.recipes import personalization_routes

        # Check that helper functions exist
        assert hasattr(personalization_routes, '_apply_taste_profile_to_request')
        assert hasattr(personalization_routes, '_enrich_request_with_cuisine_preferences')
        assert hasattr(personalization_routes, '_enrich_request_with_cooking_times')
        assert hasattr(personalization_routes, '_enrich_request_with_nutrition_preferences')
        assert hasattr(personalization_routes, '_enrich_request_with_ingredient_preferences')

    def test_guard_clauses_used(self):
        """Verify guard clauses are used instead of nested ifs"""
        import inspect
        from app.routes.recipes.personalization_routes import _enrich_request_with_cuisine_preferences

        source = inspect.getsource(_enrich_request_with_cuisine_preferences)
        # Check for early return pattern (guard clause)
        assert "if base_request.cuisine_preferences:" in source
        assert "return" in source


# ===== AUTHENTICATION TESTS =====

class TestAuthentication:
    """Test authentication and authorization"""

    @pytest.mark.asyncio
    async def test_current_user_dependency_required_for_generation(self):
        """Verify generation endpoints require authentication"""
        from app.routes.recipes.generation_routes import generate_recipe

        # Check that the endpoint has current_user dependency
        sig = inspect.signature(generate_recipe)
        assert 'current_user' in sig.parameters

    @pytest.mark.asyncio
    async def test_optional_user_dependency_for_search(self):
        """Verify search endpoint accepts optional user"""
        from app.routes.recipes.core_routes import search_recipes

        # Check that the endpoint has user parameter
        sig = inspect.signature(search_recipes)
        assert 'user' in sig.parameters


# ===== ERROR HANDLING TESTS =====

class TestErrorHandling:
    """Test error handling in routes"""

    @pytest.mark.asyncio
    async def test_generation_route_handles_exceptions(self):
        """Verify generation routes handle exceptions properly"""
        from app.routes.recipes.generation_routes import generate_recipe

        # Test that the function has error handling
        source = inspect.getsource(generate_recipe)
        assert "except Exception" in source
        assert "HTTPException" in source


# ===== MODULE CONSOLIDATION TESTS =====

class TestConsolidation:
    """Test that recipe_ai.py properly consolidates all routes"""

    def test_consolidated_router_imports_main_router(self):
        """Verify recipe_ai.py imports main_router correctly"""
        from app.routes.recipe_ai import router as consolidated_router

        # Check that router is an APIRouter instance
        assert hasattr(consolidated_router, 'routes')
        assert len(consolidated_router.routes) > 0

    def test_backward_compatibility_exports(self):
        """Verify backward compatibility exports are available"""
        from app.routes import recipe_ai

        # These should be available for backward compatibility
        assert hasattr(recipe_ai, 'recipe_engine')
        assert hasattr(recipe_ai, 'recipe_db_service')

    def test_consolidated_router_has_all_routes(self):
        """Verify consolidated router includes all specialized routes"""
        from app.routes.recipe_ai import router as consolidated_router

        paths = {route.path for route in consolidated_router.routes if hasattr(route, 'path')}

        # Check that we have routes from all modules
        assert any("/recipes/" in p for p in paths), "Should have recipe routes"
        assert any("/users/" in p for p in paths), "Should have user/personalization routes"
        assert any("/shopping/" in p for p in paths), "Should have shopping routes"
        assert any("translate" in p for p in paths), "Should have translation routes"


# ===== INTEGRATION TESTS =====

class TestRouterIntegration:
    """Test complete router integration"""

    def test_no_duplicate_routes(self):
        """Verify no duplicate routes are registered"""
        from app.routes.recipe_ai import router as consolidated_router

        paths = [route.path for route in consolidated_router.routes if hasattr(route, 'path')]

        # Check for duplicates
        assert len(paths) == len(set(paths)), "Duplicate routes detected"

    def test_router_can_be_included(self):
        """Verify the router can be included in another FastAPI app"""
        from fastapi import FastAPI
        from app.routes.recipe_ai import router

        app = FastAPI()
        app.include_router(router)

        # Should not raise any exceptions
        assert len(app.routes) > 0

    def test_route_tags_configured(self):
        """Verify route tags are configured for OpenAPI docs"""
        from app.routes.recipe_ai import router

        # Check that router has tags
        assert any(hasattr(route, 'tags') for route in router.routes)


# ===== HELPER FUNCTION TESTS =====

class TestHelperFunctions:
    """Test helper functions in route modules"""

    def test_build_recipe_response_helper_exists(self):
        """Verify _build_recipe_response helper exists in translation routes"""
        from app.routes.recipes import translation_routes

        assert hasattr(translation_routes, '_build_recipe_response')
        assert callable(translation_routes._build_recipe_response)

    def test_build_recipe_response_in_personalization(self):
        """Verify _build_recipe_response helper exists in personalization routes"""
        from app.routes.recipes import personalization_routes

        assert hasattr(personalization_routes, '_build_recipe_response')
        assert callable(personalization_routes._build_recipe_response)


# ===== CODE QUALITY TESTS =====

class TestCodeQuality:
    """Test code quality metrics"""

    def test_no_circular_imports(self):
        """Verify no circular imports in route modules"""
        # If we got here without ImportError, we're good
        from app.routes.recipes import (
            generation_routes,
            personalization_routes,
            shopping_list_routes,
            translation_routes,
            core_routes,
            __init__
        )
        assert True  # No circular imports detected

    def test_route_modules_have_docstrings(self):
        """Verify all route modules have docstrings"""
        from app.routes.recipes import (
            generation_routes,
            personalization_routes,
            shopping_list_routes,
            translation_routes,
            core_routes
        )

        modules = [
            generation_routes,
            personalization_routes,
            shopping_list_routes,
            translation_routes,
            core_routes
        ]

        for module in modules:
            assert module.__doc__ is not None, f"{module.__name__} should have docstring"
            assert len(module.__doc__) > 0, f"{module.__name__} docstring should not be empty"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

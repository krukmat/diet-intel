"""
Recipe Database Service - Orchestrator Pattern

Facade service that orchestrates specialized recipe services.
Delegates to RecipeQueryService, RecipeRatingService, RecipeSchemaService, and ShoppingTableService.

Task: Phase 2 Tarea 5 - Recipe Database Refactoring
"""

import logging
import os
from typing import Optional, List, Dict, Any

from app.services.database import DatabaseService
from app.services.recipe_ai_engine import GeneratedRecipe
from app.services.recipes import (
    RecipeQueryService,
    RecipeRatingService,
    RecipeSchemaService,
    ShoppingTableService,
)

logger = logging.getLogger(__name__)


class RecipeDatabaseService(DatabaseService):
    """
    Extended database service for Recipe AI Generator functionality.

    Orchestrates specialized recipe services:
    - RecipeQueryService: Recipe CRUD and search operations
    - RecipeRatingService: Ratings, preferences, and learning
    - RecipeSchemaService: Database schema and DDL operations
    - ShoppingTableService: Shopping optimization operations

    Maintains backward compatibility with existing code while delegating
    to specialized services for better separation of concerns and maintainability.

    Task: Phase 2 Tarea 5 - Recipe Database Refactoring
    Commit: 8d6b961 (Services created), this commit (Orchestrator)
    """

    def __init__(self, db_path: str = "dietintel.db", max_connections: int = 10):
        """
        Initialize RecipeDatabaseService with specialized service injection.

        Args:
            db_path: Path to SQLite database file
            max_connections: Max database connections
        """
        super().__init__(db_path, max_connections)
        self._recipe_tables_ready = False

        # Inject specialized services (injectable for testing)
        self.query_service = RecipeQueryService(self)
        self.rating_service = RecipeRatingService(self)
        self.schema_service = RecipeSchemaService(self)
        self.shopping_service = ShoppingTableService(self)

        # Initialize tables
        self.schema_service.init_recipe_tables()
        self.shopping_service.init_shopping_optimization_tables_sync()
        self._recipe_tables_ready = True

    def _ensure_tables_initialized(self):
        """Ensure recipe tables are initialized (deferred initialization)."""
        if getattr(self, "_recipe_tables_ready", False):
            return
        try:
            self.schema_service.init_recipe_tables()
        except Exception as exc:
            logger.debug(f"Deferred recipe table init encountered error: {exc}")
        try:
            self.shopping_service.init_shopping_optimization_tables_sync()
        except Exception as exc:
            logger.debug(f"Deferred shopping optimization init encountered error: {exc}")
        self._recipe_tables_ready = True

    # ===== DELEGATORS TO SCHEMA SERVICE =====

    def init_recipe_tables(self):
        """Initialize recipe-related database tables. Delegates to SchemaService."""
        self.schema_service.init_recipe_tables()

    def init_shopping_optimization_tables_sync(self):
        """Initialize shopping optimization tables (sync). Delegates to ShoppingService."""
        self.shopping_service.init_shopping_optimization_tables_sync()

    async def init_shopping_optimization_tables(self):
        """Initialize shopping optimization tables (async). Delegates to ShoppingService."""
        await self.shopping_service.init_shopping_optimization_tables()

    # ===== DELEGATORS TO QUERY SERVICE =====

    async def create_recipe(self, recipe: GeneratedRecipe, user_id: Optional[str] = None) -> str:
        """Delegate to RecipeQueryService."""
        return await self.query_service.create_recipe(recipe, user_id)

    async def get_recipe(self, recipe_id: str) -> Optional[GeneratedRecipe]:
        """Delegate to RecipeQueryService."""
        return await self.query_service.get_recipe(recipe_id)

    async def search_recipes(
        self,
        user_id: Optional[str] = None,
        cuisine_type: Optional[str] = None,
        difficulty_level: Optional[str] = None,
        max_prep_time: Optional[int] = None,
        tags: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Delegate to RecipeQueryService."""
        return await self.query_service.search_recipes(
            user_id=user_id,
            cuisine_type=cuisine_type,
            difficulty_level=difficulty_level,
            max_prep_time=max_prep_time,
            tags=tags,
            limit=limit
        )

    async def get_recipe_analytics(self, days: int = 30) -> Dict[str, Any]:
        """Delegate to RecipeQueryService."""
        return await self.query_service.get_recipe_analytics(days=days)

    # ===== DELEGATORS TO RATING SERVICE =====

    async def rate_recipe(
        self,
        user_id: str,
        recipe_id: str,
        rating: int,
        review: Optional[str] = None,
        made_modifications: bool = False,
        would_make_again: Optional[bool] = None
    ) -> str:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.rate_recipe(
            user_id=user_id,
            recipe_id=recipe_id,
            rating=rating,
            review=review,
            made_modifications=made_modifications,
            would_make_again=would_make_again
        )

    async def get_recipe_ratings(self, recipe_id: str) -> Dict[str, Any]:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.get_recipe_ratings(recipe_id)

    async def log_recipe_generation_request(
        self,
        user_id: Optional[str],
        session_id: Optional[str],
        cache_key: str,
        request_data: Dict[str, Any],
        generated_recipe_id: Optional[str] = None,
        processing_time_ms: Optional[float] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> str:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.log_recipe_generation_request(
            user_id=user_id,
            session_id=session_id,
            cache_key=cache_key,
            request_data=request_data,
            generated_recipe_id=generated_recipe_id,
            processing_time_ms=processing_time_ms,
            success=success,
            error_message=error_message
        )

    async def get_user_taste_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.get_user_taste_profile(user_id)

    async def create_or_update_user_taste_profile(
        self,
        user_id: str,
        profile_data: Dict[str, Any]
    ) -> bool:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.create_or_update_user_taste_profile(user_id, profile_data)

    async def get_user_ratings_for_learning(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.get_user_ratings_for_learning(user_id, limit=limit)

    async def update_cuisine_preference(
        self,
        user_id: str,
        cuisine_type: str,
        preference_score: float
    ) -> bool:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.update_cuisine_preference(user_id, cuisine_type, preference_score)

    async def update_ingredient_preference(
        self,
        user_id: str,
        ingredient_name: str,
        preference_score: float
    ) -> bool:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.update_ingredient_preference(user_id, ingredient_name, preference_score)

    async def get_user_learning_progress(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Delegate to RecipeRatingService."""
        return await self.rating_service.get_user_learning_progress(user_id)

    # ===== DELEGATORS TO SHOPPING SERVICE =====

    async def create_shopping_optimization(
        self,
        optimization_data: Dict[str, Any],
        user_id: str
    ) -> str:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.create_shopping_optimization(optimization_data, user_id)

    async def get_shopping_optimization(
        self,
        optimization_id: str,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_shopping_optimization(optimization_id, user_id)

    async def get_user_shopping_optimizations(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_user_shopping_optimizations(user_id, status=status, limit=limit)

    async def create_ingredient_consolidation(
        self,
        optimization_id: str,
        consolidation_data: Dict[str, Any]
    ) -> str:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.create_ingredient_consolidation(optimization_id, consolidation_data)

    async def get_ingredient_consolidations(self, optimization_id: str) -> List[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_ingredient_consolidations(optimization_id)

    async def update_shopping_optimization_status(
        self,
        optimization_id: str,
        status: str,
        user_id: Optional[str] = None
    ) -> bool:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.update_shopping_optimization_status(optimization_id, status, user_id)

    async def get_user_shopping_preferences(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_user_shopping_preferences(user_id)

    async def create_or_update_user_shopping_preferences(
        self,
        user_id: str,
        preferences: Dict[str, Any]
    ) -> bool:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.create_or_update_user_shopping_preferences(user_id, preferences)

    # ===== LEGACY STUBS (For backward compatibility) =====

    async def create_shopping_list(self, meal_plan: Dict[str, Any], user_id: str) -> str:
        """Legacy stub - not implemented in refactored services."""
        logger.warning("create_shopping_list is deprecated and not implemented")
        raise NotImplementedError("create_shopping_list has been removed in refactoring")

    async def create_bulk_buying_suggestion(
        self,
        optimization_id: str,
        consolidation_id: str,
        suggestion_data: Dict[str, Any]
    ) -> str:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.create_bulk_buying_suggestion(optimization_id, consolidation_id, suggestion_data)

    async def get_bulk_buying_suggestions(self, optimization_id: str) -> List[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_bulk_buying_suggestions(optimization_id)

    async def create_shopping_path_segment(self, optimization_id: str, segment_data: Dict[str, Any]) -> str:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.create_shopping_path_segment(optimization_id, segment_data)

    async def get_shopping_path_segments(self, optimization_id: str) -> List[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_shopping_path_segments(optimization_id)

    async def get_stores(self, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_stores(location)

    async def get_product_categories(self) -> List[Dict[str, Any]]:
        """Delegate to ShoppingTableService."""
        return await self.shopping_service.get_product_categories()

    # ===== LEGACY SYNC METHODS (For backward compatibility) =====

    async def get_recipe_by_id(self, recipe_id: str) -> Optional[Dict[str, Any]]:
        """Legacy method - use get_recipe() instead. Returns recipe as dict."""
        recipe = await self.get_recipe(recipe_id)
        if recipe is None:
            return None
        return {
            'id': recipe.id,
            'name': recipe.name,
            'description': recipe.description,
            'cuisine_type': recipe.cuisine_type,
            'difficulty_level': recipe.difficulty_level,
            'prep_time_minutes': recipe.prep_time_minutes,
            'cook_time_minutes': recipe.cook_time_minutes,
            'servings': recipe.servings,
            'confidence_score': recipe.confidence_score,
            'created_by': recipe.created_by,
            'tags': recipe.tags,
            'ingredients': [
                {
                    'ingredient': ing.name,
                    'quantity': ing.quantity,
                    'unit': ing.unit,
                    'barcode': ing.barcode,
                    'calories_per_unit': ing.calories_per_unit,
                    'protein_g_per_unit': ing.protein_g_per_unit,
                    'fat_g_per_unit': ing.fat_g_per_unit,
                    'carbs_g_per_unit': ing.carbs_g_per_unit,
                    'is_optional': ing.is_optional,
                    'preparation_note': ing.preparation_note
                }
                for ing in recipe.ingredients
            ] if recipe.ingredients else [],
            'instructions': [
                {
                    'step_number': inst.step_number,
                    'instruction': inst.instruction,
                    'cooking_method': inst.cooking_method,
                    'duration_minutes': inst.duration_minutes,
                    'temperature_celsius': inst.temperature_celsius
                }
                for inst in recipe.instructions
            ] if recipe.instructions else [],
            'nutrition': {
                'calories_per_serving': recipe.nutrition.calories_per_serving,
                'protein_g_per_serving': recipe.nutrition.protein_g_per_serving,
                'fat_g_per_serving': recipe.nutrition.fat_g_per_serving,
                'carbs_g_per_serving': recipe.nutrition.carbs_g_per_serving,
                'fiber_g_per_serving': recipe.nutrition.fiber_g_per_serving,
                'sugar_g_per_serving': recipe.nutrition.sugar_g_per_serving,
                'sodium_mg_per_serving': recipe.nutrition.sodium_mg_per_serving,
                'recipe_score': recipe.nutrition.recipe_score
            } if recipe.nutrition else None
        }

    def _get_recipe_by_id_sync(self, recipe_id: str) -> Optional[Dict[str, Any]]:
        """Legacy sync method - use get_recipe() instead."""
        logger.warning("_get_recipe_by_id_sync is deprecated, use get_recipe() instead")
        raise NotImplementedError("Sync methods are deprecated in refactored service")


# Global recipe database service instance for backward compatibility
_recipe_db_path = os.getenv("DIETINTEL_DB_PATH", "dietintel.db")
recipe_db_service = RecipeDatabaseService(db_path=_recipe_db_path)

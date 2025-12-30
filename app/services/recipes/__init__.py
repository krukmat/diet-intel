"""
Recipe Services Package - Specialized Service Decomposition

Provides specialized services for recipe operations:
- RecipeQueryService: Recipe CRUD and search operations
- RecipeRatingService: Recipe ratings and user preference learning
- RecipeSchemaService: Database schema management
- ShoppingTableService: Shopping optimization operations

Task: Phase 2 Tarea 5 - Recipe Database Refactoring
"""

from .recipe_query_service import RecipeQueryService
from .recipe_rating_service import RecipeRatingService
from .recipe_schema_service import RecipeSchemaService
from .shopping_table_service import ShoppingTableService

__all__ = [
    "RecipeQueryService",
    "RecipeRatingService",
    "RecipeSchemaService",
    "ShoppingTableService",
]

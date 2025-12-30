"""
Recipe AI Routes - Consolidated Router

This module serves as the main entry point for all recipe AI endpoints.
All actual endpoint implementations have been refactored into specialized route modules:

- generation_routes: Recipe generation, optimization, and suggestions
- personalization_routes: User taste learning and personalized recommendations
- shopping_list_routes: Shopping list generation and optimization
- translation_routes: Recipe translation to multiple languages
- core_routes: Core recipe operations (search, ratings, feedback, analytics)

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.7 - Consolidate parent recipe_ai.py

Architecture:
- Original file size: 1275 LOC (monolithic)
- Refactored structure: ~360 LOC per module (specialized)
- This consolidation file: ~30 LOC (router aggregation only)

Reduction: 1275 → 30 LOC in main file + 1800 LOC in 5 specialized modules
Result: Better separation of concerns, easier testing, improved maintainability
"""

from fastapi import APIRouter
import logging

# Import all specialized route modules
from app.routes.recipes import main_router

logger = logging.getLogger(__name__)

# Create the consolidated router that includes all recipe routes
# All 27 endpoints are now distributed across 5 specialized modules
# Note: Routes already have full paths (e.g., /recipes/generate), so no prefix needed
router = APIRouter(tags=["Recipe AI"])
router.include_router(main_router)

# ===== BACKWARD COMPATIBILITY EXPORTS FOR TESTS =====
# These are imported from the actual modules where they're defined.
# Tests can patch these without needing to know the internal module structure.
from app.services.recipe_ai_engine import RecipeAIEngine
from app.services.recipe_database import recipe_db_service
from app.services.taste_learning import taste_learning_service
from app.services.recommendation_engine import recommendation_engine
from app.services.shopping_optimization import ShoppingOptimizationService

# Initialize engines for backward compatibility with existing tests
recipe_engine = RecipeAIEngine()

__all__ = ["router", "recipe_engine", "recipe_db_service"]

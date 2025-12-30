"""
Recipe AI Routes Package

Organized recipe API endpoints split by domain:
- Generation: Recipe creation and optimization
- Personalization: User preferences and personalized recommendations
- Shopping: Shopping list optimization
- Translation: Recipe translation to other languages
- Core: Search, ratings, analytics, and feedback

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
"""

from fastapi import APIRouter

# Import routers from submodules
from app.routes.recipes.generation_routes import router as generation_router
from app.routes.recipes.personalization_routes import router as personalization_router
from app.routes.recipes.shopping_list_routes import router as shopping_router
from app.routes.recipes.translation_routes import router as translation_router
from app.routes.recipes.core_routes import router as core_router
from app.routes.recipes.compatibility_routes import router as compatibility_router


# Main router that includes all submodule routers
main_router = APIRouter(tags=["Recipe AI"])

# Include all routers
main_router.include_router(generation_router)
main_router.include_router(personalization_router)
main_router.include_router(shopping_router)
main_router.include_router(translation_router)
main_router.include_router(core_router)

# Include compatibility aliases for mobile app backward compatibility
# Task: Mobile API Compatibility - Backend Refactoring (2025-12-28)
main_router.include_router(compatibility_router)


__all__ = ["main_router"]

"""
Shopping List Routes

Handles shopping list generation and optimization.
- POST /shopping/optimize - Optimize shopping list from multiple recipes
- GET /shopping/generate - Generate shopping list from recipe IDs
- GET /shopping/optimization/{id} - Get optimization details

Task: Phase 2 Tarea 7 - Recipe AI Routes Refactoring
Subtask: 7.4 - Implement shopping list routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
import logging

from app.models.shopping import (
    ShoppingOptimizationRequest, ShoppingOptimizationResponse
)
from app.services.shopping_optimization import ShoppingOptimizationService
from app.services.recipe_database import recipe_db_service
from app.routes.recipes.dependencies import current_user_dependency
from app.models.user import User


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Shopping"])


@router.post(
    "/shopping/optimize",
    response_model=ShoppingOptimizationResponse,
    summary="Optimize Shopping List",
    description="Generate optimized shopping list from multiple recipes with ingredient consolidation"
)
async def optimize_shopping_list(
    request: ShoppingOptimizationRequest,
    user: User = Depends(current_user_dependency)
):
    """
    Generate optimized shopping list from multiple recipes with ingredient consolidation.

    This endpoint implements multi-recipe ingredient consolidation algorithm that:
    - Combines similar ingredients across recipes
    - Handles complex unit conversions
    - Optimizes quantities for practical shopping
    - Provides cost optimization opportunities
    - Maintains source recipe attribution
    """
    try:
        user_id = user.id
        logger.info(f"Starting shopping optimization for user {user_id} with {len(request.recipe_ids)} recipes")

        # Task 7 related comment: Multi-recipe ingredient consolidation endpoint

        # Initialize shopping optimization service
        shopping_service = ShoppingOptimizationService(recipe_db_service)

        # Generate optimized shopping list
        optimization_result = await shopping_service.optimize_shopping_list(
            recipe_ids=request.recipe_ids,
            user_id=user_id,
            preferred_store_id=request.preferred_store_id,
            optimization_name=request.optimization_name
        )

        logger.info(f"Shopping optimization completed successfully: {optimization_result.optimization_id}")
        return optimization_result

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Invalid request data: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Shopping optimization failed for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate optimized shopping list")


@router.get(
    "/shopping/generate",
    summary="Generate Shopping List",
    description="Generate a shopping list from recipe IDs"
)
async def generate_shopping_list(
    recipe_ids: List[str] = Query(..., description="List of recipe IDs to generate shopping list from"),
    user: User = Depends(current_user_dependency)
):
    """
    Generate a consolidated shopping list from multiple recipes.
    """
    try:
        user_id = user.id
        logger.info(f"Generating shopping list for user {user_id} from {len(recipe_ids)} recipes")

        # Collect ingredients from all recipes
        all_ingredients = {}
        recipe_mappings = {}

        for recipe_id in recipe_ids:
            recipe = await recipe_db_service.get_recipe(recipe_id)
            if not recipe:
                logger.warning(f"Recipe {recipe_id} not found, skipping")
                continue

            recipe_mappings[recipe_id] = recipe.name
            for ingredient in recipe.get('ingredients', []):
                ing_name = ingredient.get('name', '').lower()
                if ing_name not in all_ingredients:
                    all_ingredients[ing_name] = {
                        'name': ingredient.get('name'),
                        'quantity': ingredient.get('quantity', 0),
                        'unit': ingredient.get('unit', ''),
                        'sources': [recipe_id],
                        'calories': ingredient.get('calories_per_unit', 0) * ingredient.get('quantity', 0)
                    }
                else:
                    all_ingredients[ing_name]['quantity'] += ingredient.get('quantity', 0)
                    all_ingredients[ing_name]['sources'].append(recipe_id)
                    all_ingredients[ing_name]['calories'] += ingredient.get('calories_per_unit', 0) * ingredient.get('quantity', 0)

        return {
            "ingredients": list(all_ingredients.values()),
            "recipe_count": len(recipe_mappings),
            "total_ingredients": len(all_ingredients),
            "user_id": user_id,
            "recipe_mappings": recipe_mappings
        }

    except Exception as e:
        logger.error(f"Failed to generate shopping list for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate shopping list")


@router.get(
    "/shopping/optimization/{optimization_id}",
    response_model=ShoppingOptimizationResponse,
    summary="Get Shopping Optimization",
    description="Get details of a previous shopping optimization"
)
async def get_shopping_optimization(
    optimization_id: str,
    user: User = Depends(current_user_dependency)
):
    """
    Retrieve existing shopping optimization by ID.

    Returns the complete shopping optimization including:
    - Consolidated ingredient list
    - Source recipe attribution
    - Optimization metrics
    - Bulk buying suggestions (if available)
    - Shopping path optimization (if available)
    """
    try:
        user_id = user.id
        logger.info(f"Retrieving shopping optimization {optimization_id} for user {user_id}")

        # Task 7 related comment: Retrieve stored shopping optimization

        # Initialize shopping optimization service
        shopping_service = ShoppingOptimizationService(recipe_db_service)

        # Get optimization
        optimization = await shopping_service.get_shopping_optimization(
            optimization_id=optimization_id,
            user_id=user_id
        )

        if not optimization:
            raise HTTPException(status_code=404, detail="Shopping optimization not found")

        logger.info(f"Shopping optimization retrieved successfully: {optimization_id}")
        return optimization

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve shopping optimization {optimization_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve shopping optimization")

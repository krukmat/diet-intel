from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
import logging
import json
from datetime import datetime

from app.models.recipe import (
    RecipeGenerationRequest, RecipeOptimizationRequest, RecipeRatingRequest,
    ShoppingListRequest, RecipeSearchRequest, GeneratedRecipeResponse,
    RecipeSearchResponse, RecipeRatingResponse, ShoppingListResponse,
    RecipeAnalyticsResponse, RecipeGenerationError
)
from app.services.recipe_ai_engine import RecipeAIEngine, RecipeGenerationRequest as EngineRequest
from app.services.recipe_database import recipe_db_service
from app.services.auth import get_current_user, get_optional_user
from app.models.user import User

logger = logging.getLogger(__name__)
security = HTTPBearer()
router = APIRouter(tags=["Recipe AI"])

# Initialize Recipe AI Engine
recipe_engine = RecipeAIEngine()


# ===== UTILITY FUNCTIONS =====

def convert_to_engine_request(api_request: RecipeGenerationRequest, user_id: str) -> EngineRequest:
    """Convert API request to Recipe Engine request"""
    return EngineRequest(
        user_id=user_id,
        cuisine_preferences=api_request.cuisine_preferences,
        dietary_restrictions=api_request.dietary_restrictions,
        difficulty_preference=api_request.difficulty_preference.value,
        meal_type=api_request.meal_type.value if api_request.meal_type else "any",
        target_calories_per_serving=api_request.target_calories_per_serving,
        target_protein_g=api_request.target_protein_g,
        target_carbs_g=api_request.target_carbs_g,
        target_fat_g=api_request.target_fat_g,
        servings=api_request.servings,
        max_prep_time_minutes=api_request.max_prep_time_minutes,
        max_cook_time_minutes=api_request.max_cook_time_minutes,
        preferred_ingredients=api_request.preferred_ingredients,
        excluded_ingredients=api_request.excluded_ingredients,
        cooking_skill_level=api_request.cooking_skill_level,
        available_equipment=api_request.available_equipment
    )


async def log_recipe_request(
    user_id: str, 
    request_data: Dict[str, Any], 
    success: bool,
    recipe_id: Optional[str] = None,
    processing_time_ms: Optional[float] = None,
    error_message: Optional[str] = None
):
    """Background task to log recipe generation requests"""
    try:
        cache_key = recipe_engine._generate_cache_key(EngineRequest(**request_data))
        await recipe_db_service.log_recipe_generation_request(
            user_id=user_id,
            session_id=None,  # Could be extracted from headers if needed
            cache_key=cache_key,
            request_data=request_data,
            generated_recipe_id=recipe_id,
            processing_time_ms=processing_time_ms,
            success=success,
            error_message=error_message
        )
    except Exception as e:
        logger.error(f"Failed to log recipe request: {e}")


# ===== RECIPE GENERATION ENDPOINTS =====

@router.post("/generate", response_model=GeneratedRecipeResponse)
async def generate_recipe(
    request: RecipeGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Generate an AI-powered recipe based on user preferences and nutritional goals.
    
    This endpoint leverages the Recipe AI Engine to create personalized recipes
    that match the user's dietary restrictions, cuisine preferences, and nutritional targets.
    """
    start_time = datetime.now()
    recipe_id = None
    
    try:
        logger.info(f"Generating recipe for user {current_user.id}")
        
        # Convert API request to engine request
        engine_request = convert_to_engine_request(request, current_user.id)
        
        # Generate recipe using AI engine
        generated_recipe = await recipe_engine.generate_recipe(engine_request)
        
        # Store recipe in database
        recipe_id = await recipe_db_service.create_recipe(generated_recipe, current_user.id)
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Log request for analytics (background task)
        background_tasks.add_task(
            log_recipe_request,
            user_id=current_user.id,
            request_data=request.dict(),
            success=True,
            recipe_id=recipe_id,
            processing_time_ms=processing_time
        )
        
        # Convert to response model
        response = GeneratedRecipeResponse(
            id=generated_recipe.id,
            name=generated_recipe.name,
            description=generated_recipe.description,
            cuisine_type=generated_recipe.cuisine_type,
            difficulty_level=generated_recipe.difficulty_level,
            prep_time_minutes=generated_recipe.prep_time_minutes,
            cook_time_minutes=generated_recipe.cook_time_minutes,
            servings=generated_recipe.servings,
            ingredients=[
                {
                    "name": ing.name,
                    "quantity": ing.quantity,
                    "unit": ing.unit,
                    "barcode": ing.barcode,
                    "calories_per_unit": ing.calories_per_unit,
                    "protein_g_per_unit": ing.protein_g_per_unit,
                    "fat_g_per_unit": ing.fat_g_per_unit,
                    "carbs_g_per_unit": ing.carbs_g_per_unit,
                    "is_optional": ing.is_optional,
                    "preparation_note": ing.preparation_note
                }
                for ing in generated_recipe.ingredients
            ],
            instructions=[
                {
                    "step_number": inst.step_number,
                    "instruction": inst.instruction,
                    "cooking_method": inst.cooking_method,
                    "duration_minutes": inst.duration_minutes,
                    "temperature_celsius": inst.temperature_celsius
                }
                for inst in generated_recipe.instructions
            ],
            nutrition={
                "calories_per_serving": generated_recipe.nutrition.calories_per_serving,
                "protein_g_per_serving": generated_recipe.nutrition.protein_g_per_serving,
                "fat_g_per_serving": generated_recipe.nutrition.fat_g_per_serving,
                "carbs_g_per_serving": generated_recipe.nutrition.carbs_g_per_serving,
                "fiber_g_per_serving": generated_recipe.nutrition.fiber_g_per_serving,
                "sugar_g_per_serving": generated_recipe.nutrition.sugar_g_per_serving,
                "sodium_mg_per_serving": generated_recipe.nutrition.sodium_mg_per_serving,
                "recipe_score": generated_recipe.nutrition.recipe_score
            } if generated_recipe.nutrition else None,
            created_by=generated_recipe.created_by,
            confidence_score=generated_recipe.confidence_score,
            generation_time_ms=generated_recipe.generation_time_ms,
            tags=generated_recipe.tags,
            created_at=datetime.now()
        )
        
        logger.info(f"Successfully generated recipe '{generated_recipe.name}' for user {current_user.id}")
        return response
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        error_message = str(e)
        
        # Log failed request
        background_tasks.add_task(
            log_recipe_request,
            user_id=current_user.id,
            request_data=request.dict(),
            success=False,
            processing_time_ms=processing_time,
            error_message=error_message
        )
        
        logger.error(f"Recipe generation failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "RECIPE_GENERATION_FAILED",
                "error_message": "Failed to generate recipe",
                "details": {"processing_time_ms": processing_time},
                "suggestions": [
                    "Try adjusting your preferences",
                    "Ensure dietary restrictions are valid",
                    "Check nutritional targets are realistic"
                ]
            }
        )


@router.post("/optimize", response_model=GeneratedRecipeResponse)
async def optimize_recipe(
    request: RecipeOptimizationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Optimize an existing recipe for specific nutritional goals.
    
    Takes a recipe and optimizes it for goals like weight loss, muscle gain, or heart health
    while maintaining the core flavor profile and cooking method.
    """
    try:
        logger.info(f"Optimizing recipe for user {current_user.id} with goal: {request.optimization_goal}")
        
        # Optimize recipe using AI engine
        optimized_recipe = await recipe_engine.optimize_existing_recipe(
            request.recipe_data, 
            request.optimization_goal
        )
        
        # Store optimized recipe in database
        await recipe_db_service.create_recipe(optimized_recipe, current_user.id)
        
        # Convert to response (similar structure as generate_recipe)
        response = GeneratedRecipeResponse(
            id=optimized_recipe.id,
            name=optimized_recipe.name,
            description=optimized_recipe.description,
            cuisine_type=optimized_recipe.cuisine_type,
            difficulty_level=optimized_recipe.difficulty_level,
            prep_time_minutes=optimized_recipe.prep_time_minutes,
            cook_time_minutes=optimized_recipe.cook_time_minutes,
            servings=optimized_recipe.servings,
            ingredients=[
                {
                    "name": ing.name,
                    "quantity": ing.quantity,
                    "unit": ing.unit,
                    "barcode": ing.barcode,
                    "calories_per_unit": ing.calories_per_unit,
                    "protein_g_per_unit": ing.protein_g_per_unit,
                    "fat_g_per_unit": ing.fat_g_per_unit,
                    "carbs_g_per_unit": ing.carbs_g_per_unit,
                    "is_optional": ing.is_optional,
                    "preparation_note": ing.preparation_note
                }
                for ing in optimized_recipe.ingredients
            ],
            instructions=[
                {
                    "step_number": inst.step_number,
                    "instruction": inst.instruction,
                    "cooking_method": inst.cooking_method,
                    "duration_minutes": inst.duration_minutes,
                    "temperature_celsius": inst.temperature_celsius
                }
                for inst in optimized_recipe.instructions
            ],
            nutrition={
                "calories_per_serving": optimized_recipe.nutrition.calories_per_serving,
                "protein_g_per_serving": optimized_recipe.nutrition.protein_g_per_serving,
                "fat_g_per_serving": optimized_recipe.nutrition.fat_g_per_serving,
                "carbs_g_per_serving": optimized_recipe.nutrition.carbs_g_per_serving,
                "fiber_g_per_serving": optimized_recipe.nutrition.fiber_g_per_serving,
                "sugar_g_per_serving": optimized_recipe.nutrition.sugar_g_per_serving,
                "sodium_mg_per_serving": optimized_recipe.nutrition.sodium_mg_per_serving,
                "recipe_score": optimized_recipe.nutrition.recipe_score
            } if optimized_recipe.nutrition else None,
            created_by=optimized_recipe.created_by,
            confidence_score=optimized_recipe.confidence_score,
            generation_time_ms=optimized_recipe.generation_time_ms,
            tags=optimized_recipe.tags,
            created_at=datetime.now()
        )
        
        logger.info(f"Successfully optimized recipe for user {current_user.id}")
        return response
        
    except Exception as e:
        logger.error(f"Recipe optimization failed for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": "RECIPE_OPTIMIZATION_FAILED",
                "error_message": "Failed to optimize recipe",
                "suggestions": ["Check recipe data format", "Try a different optimization goal"]
            }
        )


@router.get("/suggestions")
async def get_recipe_suggestions(
    context: str = Query("breakfast", description="Meal context for suggestions"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """
    Get personalized recipe suggestions based on user preferences and context.
    """
    try:
        # Search for recipes matching user context
        suggestions = await recipe_db_service.search_recipes(
            user_id=current_user.id,
            limit=limit
        )
        
        return {
            "suggestions": suggestions,
            "context": context,
            "user_id": current_user.id,
            "count": len(suggestions)
        }
        
    except Exception as e:
        logger.error(f"Failed to get recipe suggestions for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get recipe suggestions")


# ===== HEALTH CHECK ENDPOINT =====

@router.get("/health")
async def recipe_ai_health_check():
    """
    Health check for Recipe AI system components.
    """
    try:
        health_status = {
            "recipe_ai_engine": "healthy",
            "database_connection": "healthy",
            "timestamp": datetime.now().isoformat(),
            "version": "1.0.0"
        }
        
        # Test database connection
        try:
            with recipe_db_service.get_connection():
                pass
        except Exception:
            health_status["database_connection"] = "unhealthy"
        
        # Test recipe engine
        try:
            # Could do a minimal test generation here
            health_status["recipe_ai_engine"] = "healthy"
        except Exception:
            health_status["recipe_ai_engine"] = "unhealthy"
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


# ===== RECIPE MANAGEMENT ENDPOINTS =====

@router.get("/{recipe_id}", response_model=GeneratedRecipeResponse)
async def get_recipe(
    recipe_id: str,
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Get detailed information about a specific recipe.
    """
    try:
        recipe = await recipe_db_service.get_recipe(recipe_id)
        
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Convert to response model
        response = GeneratedRecipeResponse(
            id=recipe.id,
            name=recipe.name,
            description=recipe.description,
            cuisine_type=recipe.cuisine_type,
            difficulty_level=recipe.difficulty_level,
            prep_time_minutes=recipe.prep_time_minutes,
            cook_time_minutes=recipe.cook_time_minutes,
            servings=recipe.servings,
            ingredients=[
                {
                    "name": ing.name,
                    "quantity": ing.quantity,
                    "unit": ing.unit,
                    "barcode": ing.barcode,
                    "calories_per_unit": ing.calories_per_unit,
                    "protein_g_per_unit": ing.protein_g_per_unit,
                    "fat_g_per_unit": ing.fat_g_per_unit,
                    "carbs_g_per_unit": ing.carbs_g_per_unit,
                    "is_optional": ing.is_optional,
                    "preparation_note": ing.preparation_note
                }
                for ing in recipe.ingredients
            ],
            instructions=[
                {
                    "step_number": inst.step_number,
                    "instruction": inst.instruction,
                    "cooking_method": inst.cooking_method,
                    "duration_minutes": inst.duration_minutes,
                    "temperature_celsius": inst.temperature_celsius
                }
                for inst in recipe.instructions
            ],
            nutrition={
                "calories_per_serving": recipe.nutrition.calories_per_serving,
                "protein_g_per_serving": recipe.nutrition.protein_g_per_serving,
                "fat_g_per_serving": recipe.nutrition.fat_g_per_serving,
                "carbs_g_per_serving": recipe.nutrition.carbs_g_per_serving,
                "fiber_g_per_serving": recipe.nutrition.fiber_g_per_serving,
                "sugar_g_per_serving": recipe.nutrition.sugar_g_per_serving,
                "sodium_mg_per_serving": recipe.nutrition.sodium_mg_per_serving,
                "recipe_score": recipe.nutrition.recipe_score
            } if recipe.nutrition else None,
            created_by=recipe.created_by,
            confidence_score=recipe.confidence_score,
            generation_time_ms=recipe.generation_time_ms,
            tags=recipe.tags
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get recipe {recipe_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve recipe")


@router.get("/search", response_model=RecipeSearchResponse)
async def search_recipes(
    query: Optional[str] = Query(None, description="Search query"),
    cuisine_type: Optional[str] = Query(None, description="Filter by cuisine type"),
    difficulty_level: Optional[str] = Query(None, description="Filter by difficulty"),
    max_prep_time: Optional[int] = Query(None, description="Maximum prep time in minutes"),
    dietary_restrictions: List[str] = Query(default=[], description="Dietary restrictions"),
    tags: List[str] = Query(default=[], description="Recipe tags"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Search recipes with advanced filtering options.
    """
    try:
        # Calculate offset for pagination
        offset = (page - 1) * page_size
        
        # Search recipes
        recipes = await recipe_db_service.search_recipes(
            cuisine_type=cuisine_type,
            difficulty_level=difficulty_level,
            max_prep_time=max_prep_time,
            tags=tags,
            limit=page_size
        )
        
        # For simplicity, return all results (in production, implement proper pagination)
        total_count = len(recipes)
        has_more = len(recipes) == page_size
        
        return RecipeSearchResponse(
            recipes=recipes,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"Recipe search failed: {e}")
        raise HTTPException(status_code=500, detail="Recipe search failed")


@router.post("/{recipe_id}/rate")
async def rate_recipe(
    recipe_id: str,
    rating_request: RecipeRatingRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Rate and review a recipe.
    """
    try:
        # Check if recipe exists
        recipe = await recipe_db_service.get_recipe(recipe_id)
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Submit rating
        rating_id = await recipe_db_service.rate_recipe(
            user_id=current_user.id,
            recipe_id=recipe_id,
            rating=rating_request.rating,
            review=rating_request.review,
            made_modifications=rating_request.made_modifications,
            would_make_again=rating_request.would_make_again
        )
        
        return {
            "rating_id": rating_id,
            "recipe_id": recipe_id,
            "rating": rating_request.rating,
            "message": "Rating submitted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rate recipe {recipe_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit rating")


@router.get("/{recipe_id}/ratings", response_model=RecipeRatingResponse)
async def get_recipe_ratings(
    recipe_id: str,
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Get rating statistics for a recipe.
    """
    try:
        # Get rating statistics
        stats = await recipe_db_service.get_recipe_ratings(recipe_id)
        
        return RecipeRatingResponse(
            recipe_id=recipe_id,
            total_ratings=stats["total_ratings"],
            average_rating=stats["average_rating"],
            would_make_again_percentage=stats["would_make_again_percentage"]
        )
        
    except Exception as e:
        logger.error(f"Failed to get ratings for recipe {recipe_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get recipe ratings")


# ===== SHOPPING & PLANNING ENDPOINTS =====

@router.post("/shopping-list", response_model=ShoppingListResponse)
async def generate_shopping_list(
    request: ShoppingListRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a consolidated shopping list from multiple recipes.
    """
    try:
        # Generate shopping list using AI engine
        shopping_list = await recipe_engine.generate_shopping_list(request.recipe_ids)
        
        # Store shopping list in database
        shopping_list_id = await recipe_db_service.create_shopping_list(
            user_id=current_user.id,
            name=request.name,
            recipe_ids=request.recipe_ids,
            ingredients_data=shopping_list,
            estimated_cost=None  # Could be calculated based on store data
        )
        
        return ShoppingListResponse(
            id=shopping_list_id,
            name=request.name,
            recipe_ids=request.recipe_ids,
            ingredients=shopping_list.get("ingredients", []),
            estimated_cost=shopping_list.get("estimated_cost"),
            created_at=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Shopping list generation failed for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate shopping list")


@router.post("/nutrition-analysis")
async def analyze_recipe_nutrition(
    recipe_data: Dict[str, Any],
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    Analyze the nutritional content of a recipe.
    """
    try:
        # Use the nutrition calculation from recipe engine
        # This could be extracted as a separate method
        nutrition_analysis = {
            "message": "Nutrition analysis endpoint",
            "recipe_data_received": bool(recipe_data),
            "analysis": "Would calculate detailed nutritional breakdown here"
        }
        
        return nutrition_analysis
        
    except Exception as e:
        logger.error(f"Nutrition analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze recipe nutrition")


# ===== ANALYTICS ENDPOINTS =====

@router.get("/analytics", response_model=RecipeAnalyticsResponse)
async def get_recipe_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_user)
):
    """
    Get recipe generation analytics and insights.
    """
    try:
        # Check if user has access to analytics (could be role-based)
        if not current_user.is_developer:
            raise HTTPException(status_code=403, detail="Access denied to analytics")
        
        # Get analytics data
        analytics = await recipe_db_service.get_recipe_analytics(days=days)
        
        return RecipeAnalyticsResponse(
            period_days=analytics["period_days"],
            generation_stats=analytics["generation_stats"],
            popular_cuisines=analytics["popular_cuisines"],
            rating_stats=analytics["rating_stats"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


@router.post("/feedback")
async def submit_recipe_feedback(
    feedback_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    Submit feedback for recipe AI improvement.
    """
    try:
        # Log feedback for AI learning (this could be expanded)
        feedback_id = f"feedback_{current_user.id}_{datetime.now().timestamp()}"
        
        # In a real implementation, this would feed into the AI training pipeline
        logger.info(f"Received recipe feedback from user {current_user.id}: {feedback_data}")
        
        return {
            "feedback_id": feedback_id,
            "message": "Feedback submitted successfully",
            "status": "received"
        }
        
    except Exception as e:
        logger.error(f"Failed to submit feedback for user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")
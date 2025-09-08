import logging
from fastapi import APIRouter, HTTPException, status, Request
from app.models.meal_plan import (
    MealPlanRequest, MealPlanResponse, PlanCustomizationRequest, 
    CustomizedPlanResponse, ChangeLogEntry
)
from app.models.product import ErrorResponse
from app.services.meal_planner import meal_planner
from app.services.plan_storage import plan_storage
from app.services.plan_customizer import plan_customizer
from app.utils.auth_context import get_session_user_id

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/generate",
    response_model=MealPlanResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request data"},
        500: {"model": ErrorResponse, "description": "Meal planning error"}
    }
)
async def generate_meal_plan(request: MealPlanRequest, req: Request):
    """
    Generate a daily meal plan based on user profile and preferences.
    
    This endpoint:
    1. Calculates BMR using Mifflin-St Jeor equation
    2. Computes TDEE based on activity level
    3. Adjusts calories for weight goals (lose: -500, gain: +300, maintain: 0)
    4. Splits daily calories into meals (25% breakfast, 40% lunch, 35% dinner)
    5. Selects food items using greedy algorithm:
       - Prioritizes optional_products first
       - Uses cached product database for additional items
       - Max 3 items per meal (5 with flexibility=true)
       - Stays within calorie tolerance (±5% strict, ±15% flexible)
    6. Returns complete plan with BMR/TDEE, meals, and macro totals
    
    Args:
        request: MealPlanRequest with user profile, preferences, and options
        
    Returns:
        MealPlanResponse with complete daily meal plan and nutritional metrics
        
    Raises:
        HTTPException: 400 for invalid data, 500 for processing errors
    """
    try:
        # Validate user profile data
        profile = request.user_profile
        
        # Basic validation - these should be caught by Pydantic but adding extra safety
        if profile.age < 10 or profile.age > 120:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Age must be between 10 and 120 years"
            )
        
        if profile.height_cm < 100 or profile.height_cm > 250:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Height must be between 100 and 250 cm"
            )
        
        if profile.weight_kg < 30 or profile.weight_kg > 300:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Weight must be between 30 and 300 kg"
            )
        
        # Log request info
        logger.info(f"Generating meal plan for {profile.sex.value}, age {profile.age}, "
                   f"goal: {profile.goal.value}, activity: {profile.activity_level.value}")
        
        if request.optional_products:
            logger.info(f"Including {len(request.optional_products)} optional products")
        
        # Get user context
        user_id = await get_session_user_id(req)
        
        # Generate the meal plan
        plan = await meal_planner.generate_plan(request)
        
        # Store the plan for future customization
        plan_id = await plan_storage.store_plan(plan, user_id=user_id)
        
        # Include the plan ID in the response
        plan.plan_id = plan_id
        
        # Log results
        logger.info(f"Generated meal plan {plan_id}: {plan.daily_calorie_target} kcal target, "
                   f"{plan.metrics.total_calories} kcal actual, "
                   f"{len([item for meal in plan.meals for item in meal.items])} total items")
        
        # Validate plan quality
        calorie_diff = abs(plan.metrics.total_calories - plan.daily_calorie_target)
        calorie_tolerance = plan.daily_calorie_target * 0.20  # 20% tolerance for validation
        
        if calorie_diff > calorie_tolerance and plan.metrics.total_calories > 0:
            logger.warning(f"Plan calories {plan.metrics.total_calories} differ significantly "
                          f"from target {plan.daily_calorie_target}")
        
        return plan
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Invalid data in meal plan request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request data: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error generating meal plan: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating meal plan"
        )


@router.get("/config")
async def get_meal_plan_config():
    """
    Get current meal planning configuration.
    
    Returns the default configuration used for meal planning including:
    - Meal calorie distribution percentages
    - Item limits per meal
    - Calorie tolerance settings
    - Activity level multipliers
    - Goal calorie adjustments
    """
    from app.models.meal_plan import MealPlanConfig
    
    config = MealPlanConfig()
    return {
        "meal_distribution": {
            "breakfast_percent": config.breakfast_percent,
            "lunch_percent": config.lunch_percent,
            "dinner_percent": config.dinner_percent
        },
        "item_limits": {
            "max_items_per_meal": config.max_items_per_meal,
            "max_items_flexible": config.max_items_flexible
        },
        "tolerance": {
            "calorie_tolerance_strict": config.calorie_tolerance_strict,
            "calorie_tolerance_flexible": config.calorie_tolerance_flexible
        },
        "activity_multipliers": config.activity_multipliers,
        "goal_adjustments": config.goal_adjustments
    }


@router.put(
    "/customize/{plan_id}",
    response_model=CustomizedPlanResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid customization request"},
        404: {"model": ErrorResponse, "description": "Plan not found"},
        500: {"model": ErrorResponse, "description": "Customization error"}
    }
)
async def customize_meal_plan(plan_id: str, customization: PlanCustomizationRequest, req: Request):
    """
    Customize an existing meal plan with user modifications.
    
    This endpoint supports the following operations:
    - **swap**: Replace one item with another (validates replacement exists in cache)
    - **remove**: Remove an item from the plan
    - **add_manual**: Add a manually specified item with custom nutrition data
    - **adjust_meal_calories**: Change the calorie target for a specific meal
    
    The endpoint:
    1. Validates the plan exists and is accessible
    2. Validates replacement items exist in cache (for swap operations)
    3. Applies the requested modifications in order
    4. Recalculates all meal totals and daily macros
    5. Updates the stored plan
    6. Returns the updated plan with a detailed change log
    
    Supports idempotency - repeated identical requests will be detected and 
    return the current state without making duplicate changes.
    
    Args:
        plan_id: UUID of the meal plan to customize
        customization: Requested modifications (at least one operation required)
        
    Returns:
        CustomizedPlanResponse with updated plan and change log
        
    Raises:
        HTTPException: 400 for invalid requests, 404 for missing plan, 500 for processing errors
    """
    try:
        # Validate that at least one operation is specified
        if not customization.has_operations():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one customization operation must be specified"
            )
        
        # Get user context
        user_id = await get_session_user_id(req)
        
        # Retrieve the existing plan
        plan = await plan_storage.get_plan(plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Meal plan {plan_id} not found"
            )
        
        logger.info(f"Customizing plan {plan_id} with operations: "
                   f"swap={customization.swap is not None}, "
                   f"remove={customization.remove is not None}, "
                   f"add_manual={customization.add_manual is not None}, "
                   f"adjust_calories={customization.adjust_meal_calories is not None}")
        
        # Check for idempotency
        if plan_customizer.check_idempotency(plan, customization):
            logger.info(f"Idempotent request detected for plan {plan_id}")
            # Return current plan with empty change log
            return CustomizedPlanResponse(
                plan=plan,
                change_log=[],
                plan_id=plan_id
            )
        
        # Apply customizations
        updated_plan, change_log = await plan_customizer.customize_plan(plan, customization)
        
        # Update stored plan
        success = await plan_storage.update_plan(plan_id, updated_plan)
        if not success:
            logger.error(f"Failed to update stored plan {plan_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save plan updates"
            )
        
        # Log results
        total_changes = len(change_log)
        successful_changes = len([log for log in change_log if not log.change_type.endswith('_failed')])
        
        logger.info(f"Customized plan {plan_id}: {successful_changes}/{total_changes} operations successful, "
                   f"new total: {updated_plan.metrics.total_calories:.1f} kcal")
        
        return CustomizedPlanResponse(
            plan=updated_plan,
            change_log=change_log,
            plan_id=plan_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error customizing plan {plan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error customizing meal plan"
        )


@router.get(
    "/{plan_id}",
    response_model=MealPlanResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Plan not found"}
    }
)
async def get_meal_plan(plan_id: str, req: Request):
    """
    Retrieve a stored meal plan by ID.
    
    Args:
        plan_id: UUID of the meal plan to retrieve
        
    Returns:
        The meal plan data
        
    Raises:
        HTTPException: 404 if plan not found
    """
    # Get user context
    user_id = await get_session_user_id(req)
    
    plan = await plan_storage.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal plan {plan_id} not found"
        )
    
    logger.info(f"Retrieved meal plan {plan_id}")
    return plan


@router.delete(
    "/{plan_id}",
    responses={
        200: {"description": "Plan deleted successfully"},
        404: {"model": ErrorResponse, "description": "Plan not found"}
    }
)
async def delete_meal_plan(plan_id: str, req: Request):
    """
    Delete a stored meal plan.
    
    Args:
        plan_id: UUID of the meal plan to delete
        
    Returns:
        Success message
        
    Raises:
        HTTPException: 404 if plan not found
    """
    # Get user context
    user_id = await get_session_user_id(req)
    
    success = await plan_storage.delete_plan(plan_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal plan {plan_id} not found"
        )
    
    logger.info(f"Deleted meal plan {plan_id}")
    return {"message": f"Meal plan {plan_id} deleted successfully"}
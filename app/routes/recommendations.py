import logging
from fastapi import APIRouter, HTTPException, status, Request
from typing import Optional
from app.models.recommendation import (
    SmartRecommendationRequest, SmartRecommendationResponse, 
    RecommendationFeedback, RecommendationMetrics
)
from app.models.product import ErrorResponse
from app.services.recommendation_engine import recommendation_engine
from app.utils.auth_context import get_session_user_id

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post(
    "/generate",
    response_model=SmartRecommendationResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request data"},
        404: {"model": ErrorResponse, "description": "User or meal plan not found"},
        500: {"model": ErrorResponse, "description": "Recommendation generation error"}
    }
)
async def generate_smart_recommendations(
    request: SmartRecommendationRequest,
    req: Request
):
    """
    Generate smart meal recommendations based on user profile, preferences, and meal history.
    
    This endpoint provides intelligent food recommendations using multiple algorithms:
    
    **Recommendation Types:**
    - **similar_nutrition**: Items with similar nutritional profiles to user preferences
    - **complementary_macros**: Items that complement current meal macro balance
    - **seasonal_trends**: Seasonal and trending food items
    - **user_history**: Personalized based on user's meal history and preferences
    - **popular_combinations**: Foods commonly paired together by other users
    - **dietary_goals**: Items aligned with user's fitness and health goals
    
    **Personalization Factors:**
    - User meal history and preferences
    - Dietary restrictions and allergen avoidance
    - Nutritional goals (protein targets, calorie limits, etc.)
    - Cuisine preferences and cultural dietary patterns
    - Seasonal availability and freshness scores
    - Social trends and popular food combinations
    
    **Recommendation Scoring:**
    Each recommendation includes confidence scores, nutritional quality ratings,
    goal alignment metrics, and detailed reasoning for transparency.
    
    Args:
        request: SmartRecommendationRequest with user context and preferences
        
    Returns:
        SmartRecommendationResponse with personalized meal recommendations
        
    Raises:
        HTTPException: 400 for invalid data, 404 for missing user/plan, 500 for processing errors
    """
    try:
        # Get user context
        user_id = await get_session_user_id(req)
        if not user_id and request.include_history:
            logger.warning("No user session found, generating generic recommendations")
            request.include_history = False
        
        # Update request with authenticated user ID
        if user_id:
            request.user_id = user_id
        
        # Validate request parameters
        if request.max_recommendations < 1 or request.max_recommendations > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_recommendations must be between 1 and 50"
            )
        
        if request.min_confidence < 0.0 or request.min_confidence > 1.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_confidence must be between 0.0 and 1.0"
            )
        
        # Log request details
        context_info = []
        if request.current_meal_plan_id:
            context_info.append(f"meal_plan={request.current_meal_plan_id}")
        if request.meal_context:
            context_info.append(f"meal={request.meal_context}")
        if request.dietary_restrictions:
            context_info.append(f"restrictions={len(request.dietary_restrictions)}")
        if request.calorie_budget:
            context_info.append(f"budget={request.calorie_budget}kcal")
        
        logger.info(f"Generating recommendations for user {user_id or 'anonymous'}: "
                   f"{', '.join(context_info) if context_info else 'no specific context'}")
        
        # Generate recommendations
        recommendations = await recommendation_engine.generate_recommendations(request)
        
        # Log results
        total_recs = recommendations.total_recommendations
        avg_confidence = recommendations.avg_confidence
        meal_count = len(recommendations.meal_recommendations)
        daily_count = len(recommendations.daily_additions)
        snack_count = len(recommendations.snack_recommendations)
        
        logger.info(f"Generated {total_recs} recommendations (avg confidence: {avg_confidence:.2f}): "
                   f"{meal_count} meal-specific, {daily_count} daily additions, {snack_count} snacks")
        
        # Validate recommendation quality
        if total_recs == 0:
            logger.warning(f"No recommendations generated for user {user_id}")
        elif avg_confidence < 0.3:
            logger.warning(f"Low average confidence ({avg_confidence:.2f}) in recommendations")
        
        return recommendations
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Invalid data in recommendation request: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid request data: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating meal recommendations"
        )

@router.post(
    "/feedback",
    responses={
        200: {"description": "Feedback recorded successfully"},
        400: {"model": ErrorResponse, "description": "Invalid feedback data"},
        500: {"model": ErrorResponse, "description": "Feedback recording error"}
    }
)
async def record_recommendation_feedback(
    feedback: RecommendationFeedback,
    req: Request
):
    """
    Record user feedback on meal recommendations for algorithm improvement.
    
    This endpoint collects user feedback to improve recommendation quality:
    - **Acceptance/rejection** data for relevance tuning
    - **Rating scores** for quality assessment
    - **Usage patterns** for personalization enhancement
    - **Rejection reasons** for algorithmic refinement
    
    The feedback is used to:
    1. Improve future recommendations for the specific user
    2. Enhance general recommendation algorithms
    3. Train ML models for better food pairing
    4. Adjust nutritional scoring algorithms
    
    Args:
        feedback: RecommendationFeedback with user rating and usage data
        
    Returns:
        Success confirmation
        
    Raises:
        HTTPException: 400 for invalid data, 500 for processing errors
    """
    try:
        # Get user context and validate
        user_id = await get_session_user_id(req)
        if user_id != feedback.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feedback user_id must match authenticated user"
            )
        
        # Validate feedback data
        if feedback.relevance_rating and (feedback.relevance_rating < 1 or feedback.relevance_rating > 5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="relevance_rating must be between 1 and 5"
            )
        
        if feedback.taste_expectation and (feedback.taste_expectation < 1 or feedback.taste_expectation > 5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="taste_expectation must be between 1 and 5"
            )
        
        # Record the feedback
        success = await recommendation_engine.record_feedback(feedback)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record feedback"
            )
        
        # Log feedback details
        action = "accepted" if feedback.accepted else "rejected"
        rating_info = f", rated {feedback.relevance_rating}/5" if feedback.relevance_rating else ""
        meal_info = f" for {feedback.added_to_meal}" if feedback.added_to_meal else ""
        
        logger.info(f"User {user_id} {action} recommendation {feedback.recommendation_id} "
                   f"(product: {feedback.barcode}){meal_info}{rating_info}")
        
        return {"message": "Feedback recorded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording feedback: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error recording recommendation feedback"
        )

@router.get(
    "/metrics",
    response_model=RecommendationMetrics,
    responses={
        500: {"model": ErrorResponse, "description": "Metrics retrieval error"}
    }
)
async def get_recommendation_metrics(
    days: Optional[int] = 30,
    user_id: Optional[str] = None
):
    """
    Get recommendation performance metrics and analytics.
    
    This endpoint provides insights into recommendation system performance:
    - **Overall acceptance rates** and user engagement
    - **Type-specific performance** (which recommendation types work best)
    - **Quality metrics** like nutritional scores and goal alignment
    - **User behavior patterns** and preference trends
    
    Metrics can be filtered by time period and specific user.
    
    Args:
        days: Number of days to include in metrics (default: 30)
        user_id: Optional user ID for user-specific metrics
        
    Returns:
        RecommendationMetrics with performance analytics
        
    Raises:
        HTTPException: 500 for processing errors
    """
    try:
        # Validate parameters
        if days < 1 or days > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="days must be between 1 and 365"
            )
        
        logger.info(f"Retrieving recommendation metrics for {days} days"
                   f"{f' for user {user_id}' if user_id else ' (all users)'}")
        
        # Get metrics from the recommendation engine
        metrics = await recommendation_engine.get_metrics(days=days, user_id=user_id)
        
        logger.info(f"Retrieved metrics: {metrics.total_recommendations} total recommendations, "
                   f"{metrics.acceptance_rate:.2%} acceptance rate, "
                   f"{metrics.unique_users} unique users")
        
        return metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving recommendation metrics"
        )

@router.get(
    "/user-preferences/{user_id}",
    responses={
        200: {"description": "User preferences retrieved"},
        404: {"model": ErrorResponse, "description": "User not found"},
        500: {"model": ErrorResponse, "description": "Preference retrieval error"}
    }
)
async def get_user_recommendation_preferences(user_id: str, req: Request):
    """
    Get learned user preferences from recommendation interactions.
    
    This endpoint returns insights about user food preferences learned from:
    - Recommendation acceptance/rejection patterns
    - Meal plan customizations and modifications
    - Feedback ratings and comments
    - Seasonal and temporal eating patterns
    
    Args:
        user_id: User identifier
        
    Returns:
        Dictionary of learned preferences and behavior patterns
        
    Raises:
        HTTPException: 404 for missing user, 500 for processing errors
    """
    try:
        # Get authenticated user context
        auth_user_id = await get_session_user_id(req)
        
        # For privacy, users can only access their own preferences
        # (Admin access could be added later with proper authorization)
        if auth_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: can only view your own preferences"
            )
        
        logger.info(f"Retrieving learned preferences for user {user_id}")
        
        # Get preferences from recommendation engine
        preferences = await recommendation_engine.get_user_preferences(user_id)
        
        if not preferences:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No preference data found for user {user_id}"
            )
        
        logger.info(f"Retrieved preferences for user {user_id}: "
                   f"{len(preferences.get('favorite_foods', []))} favorite foods, "
                   f"{len(preferences.get('avoided_foods', []))} avoided foods")
        
        return preferences
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving user preferences"
        )
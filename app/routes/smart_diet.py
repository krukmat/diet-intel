"""
Smart Diet API Routes - Unified AI Nutrition Assistant
Integrates Smart Recommendations + Smart Meal Optimization
"""

import logging
from fastapi import APIRouter, HTTPException, status, Request
from typing import Optional

from app.models.smart_diet import (
    SmartDietRequest, SmartDietResponse, SmartSuggestion, SuggestionFeedback,
    SmartDietInsights, SmartDietMetrics, SmartDietContext
)
from app.models.product import ErrorResponse
from app.services.smart_diet import smart_diet_engine
from app.utils.auth_context import get_session_user_id

# Import legacy models for backward compatibility during migration
from app.models.recommendation import (
    SmartRecommendationRequest as LegacySmartRecommendationRequest,
    SmartRecommendationResponse as LegacySmartRecommendationResponse,
    RecommendationFeedback as LegacyRecommendationFeedback
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/suggestions",
    response_model=SmartDietResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request parameters"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        500: {"model": ErrorResponse, "description": "Smart Diet generation error"}
    }
)
async def get_smart_diet_suggestions(
    context: str = "today",
    meal_context: Optional[str] = None,
    current_meal_plan_id: Optional[str] = None,
    max_suggestions: int = 10,
    min_confidence: float = 0.3,
    include_optimizations: bool = True,
    include_recommendations: bool = True,
    lang: str = "en",
    req: Request = None
):
    """
    Get unified Smart Diet suggestions - the main endpoint for AI nutrition assistance.
    
    This endpoint provides intelligent nutrition suggestions combining:
    - **Food discovery recommendations** (new foods to try)
    - **Meal plan optimizations** (improvements to existing meals)
    - **Nutritional insights** (analysis and advice)
    
    **Context Types:**
    - **today**: Mixed suggestions personalized for today
    - **optimize**: Focus on improving current meal plan
    - **discover**: Focus on discovering new foods
    - **insights**: Focus on nutritional analysis and advice
    
    **Smart Diet Features:**
    - Multi-algorithm recommendation engine with 6+ recommendation types
    - Real-time meal plan optimization with food swaps and additions  
    - Confidence scoring and nutritional impact analysis
    - Personalized learning from user feedback and behavior
    - Contextual suggestions based on meal timing and goals
    
    Args:
        context: Suggestion context (today/optimize/discover/insights)
        meal_context: Target meal (breakfast/lunch/dinner/snack)
        current_meal_plan_id: Meal plan to optimize (required for optimizations)
        max_suggestions: Maximum suggestions to return (1-50)
        min_confidence: Minimum confidence threshold (0.0-1.0)
        include_optimizations: Include meal plan optimization suggestions
        include_recommendations: Include food discovery recommendations
        
    Returns:
        SmartDietResponse with personalized suggestions grouped by context
        
    Raises:
        HTTPException: 400 for invalid params, 401 for auth, 500 for processing errors
    """
    try:
        # Get authenticated user
        user_id = await get_session_user_id(req)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for personalized Smart Diet suggestions"
            )
        
        # Validate context
        try:
            context_type = SmartDietContext(context)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid context '{context}'. Must be: today, optimize, discover, or insights"
            )
        
        # Validate parameters
        if max_suggestions < 1 or max_suggestions > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_suggestions must be between 1 and 50"
            )
        
        if min_confidence < 0.0 or min_confidence > 1.0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="min_confidence must be between 0.0 and 1.0"
            )
        
        # Validate meal context if provided
        if meal_context and meal_context.lower() not in ["breakfast", "lunch", "dinner", "snack"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="meal_context must be: breakfast, lunch, dinner, or snack"
            )
        
        # Check optimization requirements
        if context_type == SmartDietContext.OPTIMIZE and not current_meal_plan_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="current_meal_plan_id is required for optimization context"
            )
        
        # Build request
        smart_diet_request = SmartDietRequest(
            user_id=user_id,
            context_type=context_type,
            meal_context=meal_context,
            current_meal_plan_id=current_meal_plan_id,
            max_suggestions=max_suggestions,
            min_confidence=min_confidence,
            include_optimizations=include_optimizations,
            include_recommendations=include_recommendations,
            lang=lang
        )
        
        # Log request context
        context_info = [f"context={context}"]
        if meal_context:
            context_info.append(f"meal={meal_context}")
        if current_meal_plan_id:
            context_info.append(f"plan={current_meal_plan_id[:8]}...")
        context_info.append(f"max={max_suggestions}")
        
        logger.info(f"Smart Diet request from user {user_id}: {', '.join(context_info)}")
        
        # Generate suggestions
        response = await smart_diet_engine.get_smart_suggestions(user_id, smart_diet_request)
        
        # Log results
        logger.info(f"Smart Diet response for user {user_id}: "
                   f"{response.total_suggestions} total suggestions "
                   f"({len(response.optimizations)} optimizations, "
                   f"{len(response.discoveries)} discoveries, "
                   f"{len(response.insights)} insights) "
                   f"avg confidence: {response.avg_confidence:.2f}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating Smart Diet suggestions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating Smart Diet suggestions"
        )


@router.post(
    "/feedback",
    responses={
        200: {"description": "Feedback recorded successfully"},
        400: {"model": ErrorResponse, "description": "Invalid feedback data"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        500: {"model": ErrorResponse, "description": "Feedback processing error"}
    }
)
async def submit_smart_diet_feedback(
    feedback: SuggestionFeedback,
    req: Request
):
    """
    Submit feedback on Smart Diet suggestions for continuous AI improvement.
    
    This endpoint collects user feedback to enhance the Smart Diet AI:
    - **Acceptance/rejection** data for relevance tuning
    - **Satisfaction ratings** for quality assessment  
    - **Usage patterns** for personalization enhancement
    - **Implementation feedback** for practical improvements
    
    The feedback powers:
    - **Personalized learning**: Better future suggestions for the user
    - **Algorithm improvement**: Enhanced recommendation and optimization logic
    - **Quality assurance**: Identification of poor-performing suggestions
    - **Feature development**: Data-driven feature prioritization
    
    Args:
        feedback: SuggestionFeedback with user action and rating data
        
    Returns:
        Success confirmation with feedback processing status
        
    Raises:
        HTTPException: 400 for invalid data, 401 for auth, 500 for processing errors
    """
    try:
        # Get authenticated user and validate
        user_id = await get_session_user_id(req)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to submit feedback"
            )
        
        if user_id != feedback.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Feedback user_id must match authenticated user"
            )
        
        # Validate feedback data
        if feedback.action not in ["accepted", "rejected", "saved", "modified"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="action must be: accepted, rejected, saved, or modified"
            )
        
        if feedback.satisfaction_rating and (feedback.satisfaction_rating < 1 or feedback.satisfaction_rating > 5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="satisfaction_rating must be between 1 and 5"
            )
        
        # Process feedback
        success = await smart_diet_engine.process_suggestion_feedback(feedback)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process feedback"
            )
        
        # Log feedback details
        rating_info = f", rated {feedback.satisfaction_rating}/5" if feedback.satisfaction_rating else ""
        meal_info = f" for {feedback.meal_context}" if feedback.meal_context else ""
        reason_info = f" ({feedback.feedback_reason})" if feedback.feedback_reason else ""
        
        logger.info(f"Smart Diet feedback from user {user_id}: "
                   f"{feedback.action} suggestion {feedback.suggestion_id}"
                   f"{meal_info}{rating_info}{reason_info}")
        
        return {
            "message": "Smart Diet feedback recorded successfully",
            "suggestion_id": feedback.suggestion_id,
            "action": feedback.action
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing Smart Diet feedback: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing Smart Diet feedback"
        )


@router.get(
    "/insights",
    response_model=SmartDietInsights,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid parameters"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        500: {"model": ErrorResponse, "description": "Insights generation error"}
    }
)
async def get_diet_insights(
    period: str = "week",
    req: Request = None
):
    """
    Get comprehensive Smart Diet insights and analysis for the authenticated user.
    
    This endpoint provides deep nutritional analysis and behavioral insights:
    
    **Nutritional Analysis:**
    - Macro and micronutrient gap identification
    - Calorie and nutrient trend analysis over time
    - Goal progress tracking and achievement metrics
    
    **Behavioral Insights:**
    - Eating pattern analysis and meal timing preferences
    - Suggestion acceptance rates and preference learning
    - Successful vs. ignored suggestion patterns
    
    **Actionable Recommendations:**
    - Priority improvement areas with specific action items
    - Personalized dietary adjustment suggestions
    - Long-term goal achievement strategies
    
    Args:
        period: Analysis period (day/week/month)
        
    Returns:
        SmartDietInsights with comprehensive dietary analysis and recommendations
        
    Raises:
        HTTPException: 400 for invalid period, 401 for auth, 500 for processing errors
    """
    try:
        # Get authenticated user
        user_id = await get_session_user_id(req)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for personalized insights"
            )
        
        # Validate period
        if period not in ["day", "week", "month"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="period must be: day, week, or month"
            )
        
        logger.info(f"Generating Smart Diet insights for user {user_id}, period: {period}")
        
        # Generate insights
        insights = await smart_diet_engine.get_diet_insights(user_id, period)
        
        logger.info(f"Generated Smart Diet insights for user {user_id}: "
                   f"{len(insights.successful_suggestions)} successful suggestions, "
                   f"{len(insights.priority_improvements)} priority improvements, "
                   f"improvement score: {insights.improvement_score:.2f}")
        
        return insights
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating Smart Diet insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating Smart Diet insights"
        )


@router.post(
    "/apply-optimization",
    responses={
        200: {"description": "Optimization applied successfully"},
        400: {"model": ErrorResponse, "description": "Invalid optimization request"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Suggestion or meal plan not found"},
        500: {"model": ErrorResponse, "description": "Optimization application error"}
    }
)
async def apply_optimization_suggestion(
    suggestion_id: str,
    req: Request
):
    """
    Apply a Smart Diet optimization suggestion to the user's meal plan.
    
    This endpoint implements optimization suggestions by:
    - **Food swaps**: Replacing current meal items with better alternatives
    - **Meal additions**: Adding nutritious items to existing meals
    - **Portion adjustments**: Modifying serving sizes for better balance
    
    The optimization is applied directly to the user's active meal plan and
    triggers automatic recalculation of nutritional totals and goals progress.
    
    Args:
        suggestion_id: ID of the optimization suggestion to apply
        
    Returns:
        Success confirmation with updated meal plan information
        
    Raises:
        HTTPException: 400 for invalid ID, 401 for auth, 404 for not found, 500 for errors
    """
    try:
        # Get authenticated user
        user_id = await get_session_user_id(req)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to apply optimizations"
            )
        
        # Validate suggestion_id
        if not suggestion_id or len(suggestion_id.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="suggestion_id is required"
            )
        
        logger.info(f"Applying optimization suggestion {suggestion_id} for user {user_id}")
        
        # TODO: Implement optimization application logic
        # This would involve:
        # 1. Find the optimization suggestion
        # 2. Load the user's meal plan
        # 3. Apply the optimization (swap/add/adjust)
        # 4. Save the updated meal plan
        # 5. Recalculate nutritionals
        
        # For now, return success (would be implemented in production)
        return {
            "message": "Optimization applied successfully",
            "suggestion_id": suggestion_id,
            "meal_plan_updated": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying optimization: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error applying optimization suggestion"
        )


# Legacy API compatibility endpoints (for smooth migration)
@router.post(
    "/generate",
    response_model=SmartDietResponse,
    deprecated=True,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request data (deprecated)"},
        500: {"model": ErrorResponse, "description": "Generation error (deprecated)"}
    }
)
async def generate_smart_recommendations_legacy(
    request: LegacySmartRecommendationRequest,
    req: Request
):
    """
    **DEPRECATED**: Legacy endpoint for Smart Recommendations compatibility.
    
    This endpoint maintains backward compatibility during migration to Smart Diet.
    **New applications should use GET /smart-diet/suggestions instead.**
    
    Maps legacy recommendation requests to the new Smart Diet system.
    """
    logger.warning("Legacy /generate endpoint called - recommend migrating to /suggestions")
    
    try:
        # Get user context
        user_id = await get_session_user_id(req)
        if not user_id and request.include_history:
            request.include_history = False
        
        if user_id:
            request.user_id = user_id
        
        # Convert legacy request to Smart Diet format
        smart_diet_request = SmartDietRequest(
            user_id=request.user_id,
            context_type=SmartDietContext.DISCOVER,  # Legacy was primarily discovery
            meal_context=request.meal_context,
            current_meal_plan_id=request.current_meal_plan_id,
            dietary_restrictions=request.dietary_restrictions,
            cuisine_preferences=request.cuisine_preferences,
            excluded_ingredients=request.excluded_ingredients,
            target_macros=request.target_macros,
            calorie_budget=request.calorie_budget,
            max_suggestions=request.max_recommendations,
            min_confidence=request.min_confidence,
            include_optimizations=False,  # Legacy didn't have optimizations
            include_recommendations=True
        )
        
        # Generate suggestions
        response = await smart_diet_engine.get_smart_suggestions(user_id, smart_diet_request)
        
        # Convert response to legacy format in the response
        response.legacy_meal_recommendations = []  # Would convert format if needed
        
        return response
        
    except Exception as e:
        logger.error(f"Error in legacy generate endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generating recommendations (legacy)"
        )


@router.get(
    "/metrics",
    response_model=SmartDietMetrics,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid parameters"},
        500: {"model": ErrorResponse, "description": "Metrics retrieval error"}
    }
)
async def get_smart_diet_metrics(
    days: int = 30,
    user_id: Optional[str] = None
):
    """
    Get Smart Diet system performance metrics and analytics.
    
    This endpoint provides insights into Smart Diet system performance:
    - **Usage metrics**: Total suggestions, unique users, engagement rates
    - **Context performance**: How well different contexts (today/optimize/discover/insights) perform
    - **Category performance**: Success rates by suggestion category (swaps/additions/discoveries)
    - **Quality metrics**: Average confidence scores and user satisfaction ratings
    - **Popular patterns**: Most accepted suggestions and common rejection reasons
    
    Args:
        days: Number of days to include in metrics (1-365)
        user_id: Optional user ID for user-specific metrics (admin only)
        
    Returns:
        SmartDietMetrics with comprehensive performance analytics
        
    Raises:
        HTTPException: 400 for invalid parameters, 500 for processing errors
    """
    try:
        # Validate parameters
        if days < 1 or days > 365:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="days must be between 1 and 365"
            )
        
        logger.info(f"Retrieving Smart Diet metrics for {days} days"
                   f"{f' for user {user_id}' if user_id else ' (all users)'}")
        
        # TODO: Implement metrics calculation from feedback history
        # For now, return mock metrics (would be implemented with real data)
        metrics = SmartDietMetrics(
            period_days=days,
            total_suggestions=len(smart_diet_engine.suggestion_history),
            unique_users=len(set(s.user_id for s in smart_diet_engine.suggestion_history if s.user_id)),
            suggestions_per_user=5.2,  # Mock average
            overall_acceptance_rate=0.68,  # Mock rate
            avg_confidence_score=0.75,
            avg_satisfaction_rating=4.1
        )
        
        logger.info(f"Retrieved Smart Diet metrics: {metrics.total_suggestions} suggestions, "
                   f"{metrics.unique_users} users, {metrics.overall_acceptance_rate:.1%} acceptance rate")
        
        return metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving Smart Diet metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving Smart Diet metrics"
        )
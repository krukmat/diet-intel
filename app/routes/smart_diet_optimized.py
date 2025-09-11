"""
Smart Diet API Routes - Performance Optimized Version
Phase 9.3.1: Performance Optimization with monitoring and caching
"""

import logging
from fastapi import APIRouter, HTTPException, status, Request
from typing import Optional

from app.models.smart_diet import (
    SmartDietRequest, SmartDietResponse, SuggestionFeedback,
    SmartDietInsights, SmartDietMetrics, SmartDietContext
)
from app.models.product import ErrorResponse
from app.services.smart_diet_optimized import smart_diet_engine_optimized
from app.services.performance_monitor import performance_monitor
from app.services.redis_cache import redis_cache_service
from app.utils.auth_context import get_session_user_id

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
async def get_smart_diet_suggestions_optimized(
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
    Get optimized Smart Diet suggestions with performance monitoring
    
    Performance targets:
    - Response time: <500ms (95th percentile)
    - Cache hit rate: >85%
    - Success rate: >99%
    """
    
    # Performance monitoring context
    async with performance_monitor.measure_api_call(
        'smart_diet_suggestions',
        {
            'context': context,
            'max_suggestions': max_suggestions,
            'include_optimizations': include_optimizations,
            'include_recommendations': include_recommendations
        }
    ):
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
            
            # Build optimized request
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
            
            # Log optimized request
            logger.info(f"Optimized Smart Diet request from user {user_id}: "
                       f"context={context}, max={max_suggestions}")
            
            # Generate suggestions using optimized engine
            response = await smart_diet_engine_optimized.get_smart_suggestions_optimized(
                user_id, smart_diet_request
            )
            
            # Log optimized results
            logger.info(f"Optimized Smart Diet response for user {user_id}: "
                       f"{response.total_suggestions} suggestions in {response.generation_time_ms:.0f}ms "
                       f"(avg confidence: {response.avg_confidence:.2f})")
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in optimized Smart Diet suggestions: {e}")
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
async def submit_smart_diet_feedback_optimized(
    feedback: SuggestionFeedback,
    req: Request
):
    """Submit optimized Smart Diet feedback with performance tracking"""
    
    async with performance_monitor.measure_api_call(
        'smart_diet_feedback',
        {'action': feedback.action, 'has_rating': feedback.satisfaction_rating is not None}
    ):
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
            
            # Process feedback through optimized engine
            success = await smart_diet_engine_optimized.process_suggestion_feedback(feedback)
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to process feedback"
                )
            
            # Invalidate related cache entries
            cache_pattern = f"smart_diet:{user_id}:*"
            await redis_cache_service.invalidate_pattern(cache_pattern)
            
            logger.info(f"Optimized Smart Diet feedback processed: "
                       f"user {user_id}, suggestion {feedback.suggestion_id}, action {feedback.action}")
            
            return {
                "message": "Smart Diet feedback recorded successfully",
                "suggestion_id": feedback.suggestion_id,
                "action": feedback.action
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing optimized Smart Diet feedback: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error processing Smart Diet feedback"
            )


@router.get(
    "/performance-metrics",
    responses={
        200: {"description": "Performance metrics retrieved successfully"},
        500: {"model": ErrorResponse, "description": "Metrics retrieval error"}
    }
)
async def get_performance_metrics(
    hours: int = 1,
    metric_type: Optional[str] = None
):
    """Get Smart Diet performance metrics and health statistics"""
    
    try:
        # Get comprehensive performance data
        performance_summary = performance_monitor.get_performance_summary(hours, metric_type)
        cache_hit_rates = performance_monitor.get_cache_hit_rate(hours)
        recent_alerts = performance_monitor.get_recent_alerts(hours)
        health_score = performance_monitor.get_performance_health_score()
        
        # Get engine-specific metrics
        engine_metrics = smart_diet_engine_optimized.get_performance_metrics()
        
        # Get Redis cache stats
        redis_stats = redis_cache_service.get_cache_stats()
        
        return {
            "period_hours": hours,
            "health_score": health_score,
            "performance_summary": [
                {
                    "metric_type": s.metric_type,
                    "operation": s.operation,
                    "total_calls": s.total_calls,
                    "avg_duration_ms": round(s.avg_duration_ms, 2),
                    "p95_duration_ms": round(s.p95_duration_ms, 2),
                    "success_rate": round(s.success_rate * 100, 2),
                    "error_count": s.error_count
                }
                for s in performance_summary
            ],
            "cache_performance": {
                "hit_rates": cache_hit_rates,
                "redis_stats": redis_stats
            },
            "engine_metrics": engine_metrics,
            "recent_alerts": recent_alerts,
            "targets": {
                "api_response_time_ms": 500,
                "mobile_load_time_ms": 2000,
                "cache_hit_rate_percent": 85,
                "success_rate_percent": 99
            }
        }
        
    except Exception as e:
        logger.error(f"Error retrieving performance metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving performance metrics"
        )


@router.get(
    "/cache-health",
    responses={
        200: {"description": "Cache health check completed"},
        500: {"model": ErrorResponse, "description": "Cache health check error"}
    }
)
async def check_cache_health():
    """Perform comprehensive cache health check"""
    
    try:
        # Redis health check
        redis_health = await redis_cache_service.health_check()
        
        # Memory cache statistics (from optimized engine)
        memory_cache_stats = {
            "size": len(smart_diet_engine_optimized.optimized_cache.memory_cache),
            "max_size": smart_diet_engine_optimized.optimized_cache.max_memory_cache_size,
            "utilization_percent": round(
                len(smart_diet_engine_optimized.optimized_cache.memory_cache) / 
                smart_diet_engine_optimized.optimized_cache.max_memory_cache_size * 100, 2
            )
        }
        
        # Overall cache health
        overall_healthy = redis_health['healthy']
        
        return {
            "overall_healthy": overall_healthy,
            "redis_cache": redis_health,
            "memory_cache": memory_cache_stats,
            "recommendations": [
                "Redis connection is healthy" if redis_health['healthy'] else "Redis connection needs attention",
                f"Memory cache utilization: {memory_cache_stats['utilization_percent']}%"
            ]
        }
        
    except Exception as e:
        logger.error(f"Error checking cache health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error checking cache health"
        )


@router.post(
    "/warmup-cache",
    responses={
        200: {"description": "Cache warmup completed"},
        500: {"model": ErrorResponse, "description": "Cache warmup error"}
    }
)
async def warmup_cache(
    user_ids: Optional[list] = None,
    contexts: Optional[list] = None
):
    """Warmup cache for improved performance"""
    
    try:
        if not user_ids:
            user_ids = ['sample_user_1', 'sample_user_2']  # Default sample users
        
        if not contexts:
            contexts = ['today', 'optimize', 'discover', 'insights']
        
        warmup_results = []
        
        for user_id in user_ids:
            for context in contexts:
                try:
                    # Create sample request
                    request = SmartDietRequest(
                        user_id=user_id,
                        context_type=SmartDietContext(context),
                        max_suggestions=5,
                        min_confidence=0.3,
                        include_optimizations=True,
                        include_recommendations=True
                    )
                    
                    # Generate and cache suggestions
                    response = await smart_diet_engine_optimized.get_smart_suggestions_optimized(
                        user_id, request
                    )
                    
                    warmup_results.append({
                        "user_id": user_id,
                        "context": context,
                        "cached_suggestions": response.total_suggestions,
                        "status": "success"
                    })
                    
                except Exception as e:
                    warmup_results.append({
                        "user_id": user_id,
                        "context": context,
                        "status": "error",
                        "error": str(e)
                    })
        
        successful_warmups = sum(1 for r in warmup_results if r['status'] == 'success')
        
        logger.info(f"Cache warmup completed: {successful_warmups}/{len(warmup_results)} successful")
        
        return {
            "message": f"Cache warmup completed: {successful_warmups}/{len(warmup_results)} successful",
            "results": warmup_results
        }
        
    except Exception as e:
        logger.error(f"Error during cache warmup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error during cache warmup"
        )
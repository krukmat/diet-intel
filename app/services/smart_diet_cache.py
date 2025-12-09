"""
Smart Diet Caching Service
Context-aware caching with optimized TTL strategies for AI performance
"""

import json
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from app.services.cache import get_cache_service
from app.models.smart_diet import SmartDietContext, SmartDietResponse, SmartDietInsights

logger = logging.getLogger(__name__)


class SmartDietCacheManager:
    """Specialized caching for Smart Diet AI operations with context-aware TTL"""
    
    def __init__(self):
        self.cache_service = get_cache_service()
        
        # Context-specific cache TTL strategy (in seconds)
        self.CACHE_TTL_STRATEGY = {
            SmartDietContext.TODAY: 30 * 60,        # 30 minutes - fresh daily suggestions
            SmartDietContext.OPTIMIZE: 15 * 60,     # 15 minutes - recent optimization data
            SmartDietContext.DISCOVER: 2 * 60 * 60, # 2 hours - food discovery stable
            SmartDietContext.INSIGHTS: 24 * 60 * 60 # 24 hours - insights calculated daily
        }
        
        # Cache key patterns
        self.KEY_PATTERNS = {
            'suggestions': 'smart_diet:suggestions:{user_id}:{context}:{hash}',
            'insights': 'smart_diet:insights:{user_id}:{period}',
            'user_preferences': 'smart_diet:prefs:{user_id}',
            'feedback_analytics': 'smart_diet:feedback:{user_id}',
            'optimization_data': 'smart_diet:optimize:{plan_id}'
        }
    
    def _generate_cache_key(self, pattern: str, **kwargs) -> str:
        """Generate cache key from pattern and parameters"""
        return self.KEY_PATTERNS[pattern].format(**kwargs)
    
    def _get_ttl_for_context(self, context: SmartDietContext) -> int:
        """Get TTL based on Smart Diet context"""
        return self.CACHE_TTL_STRATEGY.get(context, 30 * 60)  # Default 30 minutes
    
    async def get_suggestions_cache(
        self, 
        user_id: str, 
        context: SmartDietContext, 
        request_hash: str
    ) -> Optional[SmartDietResponse]:
        """Get cached suggestions for specific user and context"""
        try:
            cache_key = self._generate_cache_key(
                'suggestions',
                user_id=user_id,
                context=context.value,
                hash=request_hash
            )
            
            cached_data = await self.cache_service.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for Smart Diet suggestions: {user_id}, {context}")
                # Convert back to SmartDietResponse
                return SmartDietResponse(**cached_data)
            
            logger.debug(f"Cache miss for Smart Diet suggestions: {user_id}, {context}")
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving suggestions cache: {e}")
            return None
    
    async def set_suggestions_cache(
        self, 
        user_id: str, 
        context: SmartDietContext, 
        request_hash: str, 
        response: SmartDietResponse
    ) -> bool:
        """Cache suggestions response with context-aware TTL"""
        try:
            cache_key = self._generate_cache_key(
                'suggestions',
                user_id=user_id,
                context=context.value,
                hash=request_hash
            )
            
            ttl = self._get_ttl_for_context(context)
            
            # Convert to dict for caching
            cache_data = response.model_dump()
            
            success = await self.cache_service.set(cache_key, cache_data, ttl)
            
            if success:
                logger.info(f"Cached Smart Diet suggestions for {user_id}, {context} with TTL {ttl}s")
            
            return success
            
        except Exception as e:
            logger.error(f"Error caching suggestions: {e}")
            return False
    
    async def get_insights_cache(self, user_id: str, period: str) -> Optional[SmartDietInsights]:
        """Get cached diet insights"""
        try:
            cache_key = self._generate_cache_key('insights', user_id=user_id, period=period)
            
            cached_data = await self.cache_service.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for Smart Diet insights: {user_id}, {period}")
                return SmartDietInsights(**cached_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving insights cache: {e}")
            return None
    
    async def set_insights_cache(self, user_id: str, period: str, insights: SmartDietInsights) -> bool:
        """Cache diet insights with 24-hour TTL"""
        try:
            cache_key = self._generate_cache_key('insights', user_id=user_id, period=period)
            ttl = self.CACHE_TTL_STRATEGY[SmartDietContext.INSIGHTS]  # 24 hours
            
            cache_data = insights.model_dump()
            success = await self.cache_service.set(cache_key, cache_data, ttl)
            
            if success:
                logger.info(f"Cached Smart Diet insights for {user_id}, {period}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error caching insights: {e}")
            return False
    
    async def get_user_preferences_cache(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached user dietary preferences and restrictions"""
        try:
            cache_key = self._generate_cache_key('user_preferences', user_id=user_id)
            
            cached_data = await self.cache_service.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for user preferences: {user_id}")
                return cached_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving user preferences cache: {e}")
            return None
    
    async def set_user_preferences_cache(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """Cache user preferences with 4-hour TTL"""
        try:
            cache_key = self._generate_cache_key('user_preferences', user_id=user_id)
            ttl = 4 * 60 * 60  # 4 hours - preferences don't change often
            
            success = await self.cache_service.set(cache_key, preferences, ttl)
            
            if success:
                logger.debug(f"Cached user preferences for {user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error caching user preferences: {e}")
            return False
    
    async def invalidate_user_cache(self, user_id: str) -> bool:
        """Invalidate all cache entries for a user (useful when preferences change)"""
        try:
            # Pattern-based cache invalidation would require Redis SCAN
            # For now, we'll invalidate specific known patterns
            keys_to_delete = [
                self._generate_cache_key('user_preferences', user_id=user_id),
                self._generate_cache_key('feedback_analytics', user_id=user_id),
            ]
            
            # Also invalidate insights for common periods
            for period in ['day', 'week', 'month']:
                keys_to_delete.append(
                    self._generate_cache_key('insights', user_id=user_id, period=period)
                )
            
            success_count = 0
            for key in keys_to_delete:
                if await self.cache_service.delete(key):
                    success_count += 1
            
            logger.info(f"Invalidated {success_count} cache entries for user {user_id}")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"Error invalidating user cache: {e}")
            return False
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics (if Redis supports it)"""
        try:
            # This would require Redis INFO command access
            # For now, return basic stats structure
            return {
                "cache_strategy": self.CACHE_TTL_STRATEGY,
                "key_patterns": list(self.KEY_PATTERNS.keys()),
                "status": "active"
            }
        except Exception as e:
            logger.error(f"Error retrieving cache stats: {e}")
            return {"status": "error", "message": str(e)}


# Singleton instance
_smart_diet_cache: Optional[SmartDietCacheManager] = None


def get_smart_diet_cache() -> SmartDietCacheManager:
    """Get or create Smart Diet cache manager instance"""
    global _smart_diet_cache
    if _smart_diet_cache is None:
        _smart_diet_cache = SmartDietCacheManager()
    return _smart_diet_cache
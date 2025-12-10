import json
import logging
import asyncio
from typing import Optional, Union
import redis.asyncio as redis
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self._redis: Optional[redis.Redis] = None
        self._last_error: Optional[Exception] = None
    
    async def get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
        else:
            # Check if the existing connection is still valid for this event loop
            try:
                # Test if connection is still valid
                await asyncio.wait_for(self._redis.ping(), timeout=0.1)
            except (Exception, asyncio.TimeoutError):
                # Connection is invalid, create a new one
                logger.debug("Redis connection invalid, creating new one")
                self._redis = redis.from_url(self.redis_url, decode_responses=True)
        return self._redis
    
    async def ping(self) -> bool:
        """Check if Redis is available."""
        try:
            redis_client = await self.get_redis()
            await redis_client.ping()
            return True
        except Exception as e:
            logger.warning(f"Redis ping failed: {e}")
            return False
    
    async def get(self, key: str) -> Optional[Union[str, dict]]:
        try:
            self._last_error = None
            redis_client = await self.get_redis()
            cached_data = await redis_client.get(key)
            if cached_data:
                logger.debug(f"Cache hit for key: {key}")
                # Try to parse as JSON, if it fails return as string
                try:
                    return json.loads(cached_data)
                except json.JSONDecodeError:
                    return cached_data
            logger.debug(f"Cache miss for key: {key}")
            return None
        except Exception as e:
            logger.error(f"Error getting from cache: {e}")
            self._last_error = e
            return None
    
    async def set(
        self,
        key: str,
        value: Union[str, dict],
        ttl: int = 86400,
        ttl_hours: Optional[int] = None
    ) -> bool:
        """
        Set cache value with TTL in seconds.
        
        Args:
            key: Cache key
            value: Value to cache (string or dict)
            ttl: Time to live in seconds (default 24 hours)
            ttl_hours: Optional TTL in hours (used by tests and convenience helpers)
        """
        try:
            if ttl_hours is not None:
                ttl = int(ttl_hours) * 3600
            self._last_error = None

            redis_client = await self.get_redis()
            
            # Convert value to string if it's a dict
            if isinstance(value, dict):
                cache_value = json.dumps(value, default=str)
            else:
                cache_value = str(value)
            
            await redis_client.setex(key, ttl, cache_value)
            logger.debug(f"Cached data for key: {key} with TTL: {ttl}s")
            return True
        except Exception as e:
            logger.error(f"Error setting cache: {e}")
            self._last_error = e
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete a cache key."""
        try:
            redis_client = await self.get_redis()
            result = await redis_client.delete(key)
            return result > 0
        except Exception as e:
            logger.error(f"Error deleting from cache: {e}")
            return False
    
    async def close(self):
        if self._redis:
            await self._redis.close()

    def consume_last_error(self) -> Optional[Exception]:
        error = self._last_error
        self._last_error = None
        return error


# Singleton instance
_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get or create cache service instance."""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service


# Legacy export for backward compatibility
cache_service = get_cache_service()

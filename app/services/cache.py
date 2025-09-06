import json
import logging
from typing import Optional, Union
import redis.asyncio as redis
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self._redis: Optional[redis.Redis] = None
    
    async def get_redis(self) -> redis.Redis:
        if self._redis is None:
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
            return None
    
    async def set(self, key: str, value: Union[str, dict], ttl: int = 86400) -> bool:
        """
        Set cache value with TTL in seconds.
        
        Args:
            key: Cache key
            value: Value to cache (string or dict)
            ttl: Time to live in seconds (default 24 hours)
        """
        try:
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
import json
import logging
from typing import Optional
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
    
    async def get(self, key: str) -> Optional[dict]:
        try:
            redis_client = await self.get_redis()
            cached_data = await redis_client.get(key)
            if cached_data:
                logger.info(f"Cache hit for key: {key}")
                return json.loads(cached_data)
            logger.info(f"Cache miss for key: {key}")
            return None
        except Exception as e:
            logger.error(f"Error getting from cache: {e}")
            return None
    
    async def set(self, key: str, value: dict, ttl_hours: int = 24) -> bool:
        try:
            redis_client = await self.get_redis()
            ttl_seconds = ttl_hours * 3600
            await redis_client.setex(key, ttl_seconds, json.dumps(value, default=str))
            logger.info(f"Cached data for key: {key} with TTL: {ttl_hours}h")
            return True
        except Exception as e:
            logger.error(f"Error setting cache: {e}")
            return False
    
    async def close(self):
        if self._redis:
            await self._redis.close()


cache_service = CacheService()
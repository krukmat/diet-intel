"""
Redis Cache Service - High Performance Caching
Phase 9.3.1: Performance Optimization
"""

import redis
import json
import logging
import asyncio
from typing import Optional, Any, Dict, List
from datetime import timedelta
import os

logger = logging.getLogger(__name__)


class RedisCacheService:
    """High-performance Redis caching service for Smart Diet"""
    
    def __init__(self):
        self.redis_client = None
        self.connection_pool = None
        self.is_connected = False
        
        # Cache configuration
        self.default_ttl = 1800  # 30 minutes
        self.max_key_length = 250
        self.compression_threshold = 1024  # Compress data > 1KB
        
        # Performance metrics
        self.metrics = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'errors': 0,
            'total_requests': 0
        }
    
    async def initialize(self):
        """Initialize Redis connection with connection pooling"""
        try:
            # Redis connection configuration
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            
            # Create connection pool for better performance
            self.connection_pool = redis.ConnectionPool.from_url(
                redis_url,
                max_connections=20,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                health_check_interval=30
            )
            
            # Create Redis client
            self.redis_client = redis.Redis(
                connection_pool=self.connection_pool,
                decode_responses=True
            )
            
            # Test connection
            await self._test_connection()
            self.is_connected = True
            
            logger.info("Redis cache service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {e}")
            self.is_connected = False
    
    async def _test_connection(self):
        """Test Redis connection"""
        try:
            # Use asyncio to run blocking Redis operation
            await asyncio.get_event_loop().run_in_executor(
                None, self.redis_client.ping
            )
        except Exception as e:
            raise Exception(f"Redis connection test failed: {e}")
    
    async def get(self, key: str) -> Optional[str]:
        """Get value from Redis cache with metrics"""
        if not self.is_connected:
            return None
        
        try:
            self.metrics['total_requests'] += 1
            
            # Ensure key length is within limits
            cache_key = self._normalize_key(key)
            
            # Get value asynchronously
            value = await asyncio.get_event_loop().run_in_executor(
                None, self.redis_client.get, cache_key
            )
            
            if value:
                self.metrics['hits'] += 1
                logger.debug(f"Cache hit: {cache_key}")
                
                # Decompress if needed
                if value.startswith('COMPRESSED:'):
                    value = self._decompress_value(value[11:])
                
                return value
            else:
                self.metrics['misses'] += 1
                logger.debug(f"Cache miss: {cache_key}")
                return None
                
        except Exception as e:
            self.metrics['errors'] += 1
            logger.error(f"Redis get error for key {key}: {e}")
            return None
    
    async def set(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        """Set value in Redis cache with compression and TTL"""
        if not self.is_connected:
            return False
        
        try:
            cache_key = self._normalize_key(key)
            cache_ttl = ttl or self.default_ttl
            
            # Compress large values for better performance
            cache_value = value
            if len(value) > self.compression_threshold:
                cache_value = f"COMPRESSED:{self._compress_value(value)}"
            
            # Set value with TTL asynchronously
            success = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: self.redis_client.setex(cache_key, cache_ttl, cache_value)
            )
            
            if success:
                self.metrics['sets'] += 1
                logger.debug(f"Cache set: {cache_key} (TTL: {cache_ttl}s)")
                return True
            else:
                self.metrics['errors'] += 1
                return False
                
        except Exception as e:
            self.metrics['errors'] += 1
            logger.error(f"Redis set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from Redis cache"""
        if not self.is_connected:
            return False
        
        try:
            cache_key = self._normalize_key(key)
            
            result = await asyncio.get_event_loop().run_in_executor(
                None, self.redis_client.delete, cache_key
            )
            
            logger.debug(f"Cache delete: {cache_key}")
            return result > 0
            
        except Exception as e:
            self.metrics['errors'] += 1
            logger.error(f"Redis delete error for key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis cache"""
        if not self.is_connected:
            return False
        
        try:
            cache_key = self._normalize_key(key)
            
            result = await asyncio.get_event_loop().run_in_executor(
                None, self.redis_client.exists, cache_key
            )
            
            return result > 0
            
        except Exception as e:
            logger.error(f"Redis exists error for key {key}: {e}")
            return False
    
    async def get_multiple(self, keys: List[str]) -> Dict[str, Optional[str]]:
        """Get multiple values from Redis in a single operation"""
        if not self.is_connected or not keys:
            return {}
        
        try:
            # Normalize all keys
            cache_keys = [self._normalize_key(key) for key in keys]
            
            # Use pipeline for batch operation
            pipe = self.redis_client.pipeline()
            for cache_key in cache_keys:
                pipe.get(cache_key)
            
            # Execute pipeline asynchronously
            values = await asyncio.get_event_loop().run_in_executor(
                None, pipe.execute
            )
            
            # Build result dictionary
            result = {}
            for i, (original_key, value) in enumerate(zip(keys, values)):
                if value:
                    self.metrics['hits'] += 1
                    # Decompress if needed
                    if value.startswith('COMPRESSED:'):
                        value = self._decompress_value(value[11:])
                    result[original_key] = value
                else:
                    self.metrics['misses'] += 1
                    result[original_key] = None
            
            self.metrics['total_requests'] += len(keys)
            return result
            
        except Exception as e:
            self.metrics['errors'] += 1
            logger.error(f"Redis get_multiple error: {e}")
            return {}
    
    async def set_multiple(self, key_value_pairs: Dict[str, str], ttl: Optional[int] = None) -> bool:
        """Set multiple key-value pairs in Redis"""
        if not self.is_connected or not key_value_pairs:
            return False
        
        try:
            cache_ttl = ttl or self.default_ttl
            
            # Use pipeline for batch operation
            pipe = self.redis_client.pipeline()
            
            for key, value in key_value_pairs.items():
                cache_key = self._normalize_key(key)
                
                # Compress large values
                cache_value = value
                if len(value) > self.compression_threshold:
                    cache_value = f"COMPRESSED:{self._compress_value(value)}"
                
                pipe.setex(cache_key, cache_ttl, cache_value)
            
            # Execute pipeline asynchronously
            results = await asyncio.get_event_loop().run_in_executor(
                None, pipe.execute
            )
            
            success_count = sum(1 for result in results if result)
            self.metrics['sets'] += success_count
            
            logger.debug(f"Cache set_multiple: {success_count}/{len(key_value_pairs)} successful")
            
            return success_count == len(key_value_pairs)
            
        except Exception as e:
            self.metrics['errors'] += 1
            logger.error(f"Redis set_multiple error: {e}")
            return False
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a pattern"""
        if not self.is_connected:
            return 0
        
        try:
            # Find keys matching pattern
            keys = await asyncio.get_event_loop().run_in_executor(
                None, self.redis_client.keys, self._normalize_key(pattern)
            )
            
            if not keys:
                return 0
            
            # Delete all matching keys
            deleted = await asyncio.get_event_loop().run_in_executor(
                None, self.redis_client.delete, *keys
            )
            
            logger.info(f"Invalidated {deleted} cache keys matching pattern: {pattern}")
            return deleted
            
        except Exception as e:
            logger.error(f"Redis invalidate_pattern error: {e}")
            return 0
    
    def _normalize_key(self, key: str) -> str:
        """Normalize cache key to ensure compatibility"""
        # Remove invalid characters and limit length
        normalized = key.replace(' ', '_').replace('\n', '_')
        
        if len(normalized) > self.max_key_length:
            # Use hash for very long keys
            import hashlib
            key_hash = hashlib.md5(normalized.encode()).hexdigest()
            normalized = f"{normalized[:200]}_{key_hash}"
        
        return f"smart_diet:{normalized}"
    
    def _compress_value(self, value: str) -> str:
        """Compress value for storage efficiency"""
        try:
            import gzip
            import base64
            
            compressed = gzip.compress(value.encode('utf-8'))
            return base64.b64encode(compressed).decode('ascii')
            
        except Exception as e:
            logger.warning(f"Compression failed: {e}")
            return value
    
    def _decompress_value(self, compressed_value: str) -> str:
        """Decompress stored value"""
        try:
            import gzip
            import base64
            
            compressed_data = base64.b64decode(compressed_value.encode('ascii'))
            return gzip.decompress(compressed_data).decode('utf-8')
            
        except Exception as e:
            logger.warning(f"Decompression failed: {e}")
            return compressed_value
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        total_requests = self.metrics['total_requests']
        hit_rate = (self.metrics['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'connected': self.is_connected,
            'hit_rate_percent': round(hit_rate, 2),
            'total_requests': total_requests,
            'hits': self.metrics['hits'],
            'misses': self.metrics['misses'],
            'sets': self.metrics['sets'],
            'errors': self.metrics['errors']
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on Redis connection"""
        try:
            start_time = asyncio.get_event_loop().time()
            
            # Test basic operations
            test_key = "health_check_test"
            test_value = "test_value"
            
            # Test set
            await self.set(test_key, test_value, 60)
            
            # Test get
            retrieved = await self.get(test_key)
            
            # Test delete
            await self.delete(test_key)
            
            end_time = asyncio.get_event_loop().time()
            response_time = (end_time - start_time) * 1000
            
            success = retrieved == test_value
            
            return {
                'healthy': success,
                'response_time_ms': round(response_time, 2),
                'connected': self.is_connected,
                'error': None if success else "Health check operations failed"
            }
            
        except Exception as e:
            return {
                'healthy': False,
                'response_time_ms': 0,
                'connected': False,
                'error': str(e)
            }


# Singleton instance
redis_cache_service = RedisCacheService()
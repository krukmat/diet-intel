import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, Union
import httpx
import redis.asyncio as redis
from app.config import config
from app.models.product import ProductResponse, Nutriments

logger = logging.getLogger(__name__)


class BarcodeNotFoundError(Exception):
    """Raised when a barcode is not found in Open Food Facts"""
    pass


class OpenFoodFactsAPIError(Exception):
    """Raised when there's an API error from Open Food Facts"""
    pass


class BarcodeFieldMapper:
    """
    Handles mapping of Open Food Facts API fields to canonical product schema.
    Includes fallback heuristics and data validation.
    """
    
    @staticmethod
    def extract_name(product_data: Dict[str, Any]) -> Optional[str]:
        """
        Extract product name with fallbacks.
        Priority: product_name > product_name_en > generic_name > abbreviated_product_name
        """
        name_fields = [
            'product_name',
            'product_name_en', 
            'generic_name',
            'abbreviated_product_name'
        ]
        
        for field in name_fields:
            name = product_data.get(field, '').strip()
            if name:
                return name
        
        logger.warning("No product name found in OFF data")
        return None
    
    @staticmethod
    def extract_brands(product_data: Dict[str, Any]) -> Optional[str]:
        """
        Extract and process brand information.
        Handles comma-separated brands and cleans up formatting.
        """
        brands = product_data.get('brands', '').strip()
        if not brands:
            return None
        
        # Split by comma and take the first brand (most relevant)
        brand_list = [b.strip() for b in brands.split(',') if b.strip()]
        if brand_list:
            return brand_list[0]
        
        return None
    
    @staticmethod
    def extract_image_url(product_data: Dict[str, Any]) -> Optional[str]:
        """
        Extract image URL with fallbacks.
        Priority: image_front_url > image_url > selected_images.front.display
        """
        # Try direct image URLs first
        for field in ['image_front_url', 'image_url']:
            url = product_data.get(field)
            if url and isinstance(url, str) and url.startswith('http'):
                return url
        
        # Try selected images structure
        selected_images = product_data.get('selected_images', {})
        if isinstance(selected_images, dict):
            front = selected_images.get('front', {})
            if isinstance(front, dict):
                display_url = front.get('display')
                if display_url and isinstance(display_url, str) and display_url.startswith('http'):
                    return display_url
        
        return None
    
    @staticmethod
    def extract_serving_size(product_data: Dict[str, Any]) -> Optional[str]:
        """
        Extract serving size information.
        Priority: serving_size > serving_quantity + serving_quantity_unit
        """
        # Direct serving size field
        serving_size = product_data.get('serving_size', '').strip()
        if serving_size:
            return serving_size
        
        # Construct from quantity and unit
        quantity = product_data.get('serving_quantity')
        unit = product_data.get('serving_quantity_unit', '').strip()
        
        if quantity and unit:
            try:
                # Handle both string and numeric quantities
                if isinstance(quantity, str):
                    quantity = float(quantity)
                return f"{quantity:.0f}{unit}"
            except (ValueError, TypeError):
                pass
        
        return None
    
    @staticmethod
    def extract_energy_kcal(nutriments: Dict[str, Any]) -> Optional[float]:
        """
        Extract energy in kcal with multiple fallback strategies.
        
        Priority:
        1. energy-kcal_100g
        2. energy_kcal_100g  
        3. energy-kcal_value
        4. Convert from energy_100g (kJ) if available
        5. Convert from energy-kj_100g
        """
        # Direct kcal fields (per 100g)
        for field in ['energy-kcal_100g', 'energy_kcal_100g', 'energy-kcal_value']:
            value = nutriments.get(field)
            if value is not None:
                try:
                    return float(value)
                except (ValueError, TypeError):
                    continue
        
        # Convert from kJ to kcal (1 kcal = 4.184 kJ)
        for kj_field in ['energy_100g', 'energy-kj_100g']:
            kj_value = nutriments.get(kj_field)
            if kj_value is not None:
                try:
                    kj = float(kj_value)
                    kcal = kj / 4.184
                    logger.debug(f"Converted {kj} kJ to {kcal:.1f} kcal")
                    return round(kcal, 1)
                except (ValueError, TypeError):
                    continue
        
        return None
    
    @staticmethod
    def extract_nutrient(nutriments: Dict[str, Any], base_name: str) -> Optional[float]:
        """
        Extract nutrient value with common field variations.
        Tries multiple field naming patterns for the given base_name.
        """
        # Common field patterns for nutrients
        field_patterns = [
            f"{base_name}_100g",
            f"{base_name}-{base_name}_100g",  # e.g., proteins-proteins_100g
            f"{base_name}_value",
            f"{base_name}",
        ]
        
        for field in field_patterns:
            value = nutriments.get(field)
            if value is not None:
                try:
                    return float(value)
                except (ValueError, TypeError):
                    continue
        
        return None
    
    @classmethod
    def map_nutriments(cls, product_data: Dict[str, Any]) -> Nutriments:
        """
        Map Open Food Facts nutriment data to canonical Nutriments schema.
        """
        nutriments = product_data.get('nutriments', {})
        if not isinstance(nutriments, dict):
            logger.warning("Invalid nutriments data structure")
            nutriments = {}
        
        return Nutriments(
            energy_kcal_per_100g=cls.extract_energy_kcal(nutriments),
            protein_g_per_100g=cls.extract_nutrient(nutriments, 'proteins'),
            fat_g_per_100g=cls.extract_nutrient(nutriments, 'fat'),
            carbs_g_per_100g=cls.extract_nutrient(nutriments, 'carbohydrates'),
            sugars_g_per_100g=cls.extract_nutrient(nutriments, 'sugars'),
            salt_g_per_100g=cls.extract_nutrient(nutriments, 'salt')
        )


class BarcodeRedisCache:
    """
    Redis cache implementation for barcode lookup results.
    Handles connection management and error recovery.
    """
    
    def __init__(self):
        self._redis_pool: Optional[redis.ConnectionPool] = None
        self._redis_client: Optional[redis.Redis] = None
    
    async def _get_redis_client(self) -> redis.Redis:
        """Get Redis client with connection pool management."""
        if self._redis_client is None:
            if self._redis_pool is None:
                self._redis_pool = redis.ConnectionPool.from_url(
                    config.redis_url,
                    max_connections=config.redis_max_connections,
                    decode_responses=True
                )
            
            self._redis_client = redis.Redis(connection_pool=self._redis_pool)
        
        return self._redis_client
    
    def _get_cache_key(self, barcode: str) -> str:
        """Generate cache key for barcode."""
        return f"barcode:product:{barcode}"
    
    async def get(self, barcode: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached product data for barcode.
        Returns None if not cached or on Redis errors.
        """
        try:
            client = await self._get_redis_client()
            cache_key = self._get_cache_key(barcode)
            
            cached_data = await client.get(cache_key)
            if cached_data:
                logger.debug(f"Cache hit for barcode: {barcode}")
                return json.loads(cached_data)
            
            logger.debug(f"Cache miss for barcode: {barcode}")
            return None
            
        except (redis.RedisError, json.JSONDecodeError) as e:
            logger.error(f"Redis get error for barcode {barcode}: {e}")
            return None
    
    async def set(self, barcode: str, product_data: Dict[str, Any]) -> bool:
        """
        Cache product data for barcode with TTL.
        Returns True if successful, False on errors.
        """
        try:
            client = await self._get_redis_client()
            cache_key = self._get_cache_key(barcode)
            ttl_seconds = config.redis_cache_ttl_hours * 3600
            
            # Add cache metadata
            cache_data = {
                **product_data,
                '_cache_metadata': {
                    'cached_at': datetime.now().isoformat(),
                    'ttl_hours': config.redis_cache_ttl_hours
                }
            }
            
            await client.setex(
                cache_key,
                ttl_seconds,
                json.dumps(cache_data, default=str)
            )
            
            logger.debug(f"Cached product for barcode {barcode} with TTL {config.redis_cache_ttl_hours}h")
            return True
            
        except (redis.RedisError, TypeError) as e:
            logger.error(f"Redis set error for barcode {barcode}: {e}")
            return False
    
    async def delete(self, barcode: str) -> bool:
        """Delete cached data for barcode."""
        try:
            client = await self._get_redis_client()
            cache_key = self._get_cache_key(barcode)
            
            result = await client.delete(cache_key)
            logger.debug(f"Deleted cache for barcode {barcode}: {result > 0}")
            return result > 0
            
        except redis.RedisError as e:
            logger.error(f"Redis delete error for barcode {barcode}: {e}")
            return False
    
    async def close(self):
        """Close Redis connections."""
        if self._redis_client:
            await self._redis_client.close()
        if self._redis_pool:
            await self._redis_pool.disconnect()


class BarcodeAPIClient:
    """
    HTTP client for Open Food Facts API with rate limiting and retry logic.
    """
    
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._last_request_time = 0.0
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get HTTP client with proper configuration."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=config.off_timeout,
                headers={
                    'User-Agent': 'DietIntel/1.0 (https://github.com/krukmat/diet-intel)'
                }
            )
        return self._client
    
    async def _respect_rate_limit(self):
        """Implement rate limiting between requests."""
        if config.off_rate_limit_delay <= 0:
            return
        
        current_time = asyncio.get_event_loop().time()
        time_since_last = current_time - self._last_request_time
        
        if time_since_last < config.off_rate_limit_delay:
            sleep_time = config.off_rate_limit_delay - time_since_last
            logger.debug(f"Rate limiting: sleeping {sleep_time:.2f}s")
            await asyncio.sleep(sleep_time)
        
        self._last_request_time = asyncio.get_event_loop().time()
    
    async def fetch_product(self, barcode: str) -> Dict[str, Any]:
        """
        Fetch product data from Open Food Facts API with retries.
        
        Args:
            barcode: Product barcode to lookup
            
        Returns:
            Product data dictionary
            
        Raises:
            BarcodeNotFoundError: If product not found (404 or status=0)
            OpenFoodFactsAPIError: If API error occurs
        """
        url = f"{config.off_base_url}/api/v0/product/{barcode}.json"
        
        for attempt in range(config.off_max_retries):
            try:
                await self._respect_rate_limit()
                
                client = await self._get_client()
                logger.debug(f"Fetching product from OFF API: {url} (attempt {attempt + 1})")
                
                response = await client.get(url)
                
                # Handle HTTP errors
                if response.status_code == 404:
                    raise BarcodeNotFoundError(f"Product {barcode} not found")
                
                if response.status_code == 429:
                    # Rate limited - wait longer before retry
                    wait_time = config.off_retry_delay * (2 ** attempt)
                    logger.warning(f"Rate limited by OFF API, waiting {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                
                if response.status_code >= 500:
                    # Server error - retry
                    if attempt < config.off_max_retries - 1:
                        wait_time = config.off_retry_delay * (2 ** attempt)
                        logger.warning(f"OFF API server error {response.status_code}, retrying in {wait_time}s")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise OpenFoodFactsAPIError(f"OFF API server error: {response.status_code}")
                
                response.raise_for_status()
                
                # Parse JSON response
                try:
                    parsed = response.json()
                    data = await parsed if asyncio.iscoroutine(parsed) else parsed
                except json.JSONDecodeError as e:
                    raise OpenFoodFactsAPIError(f"Invalid JSON response from OFF API: {e}")
                
                # Check OFF API status
                if data.get('status') != 1:
                    raise BarcodeNotFoundError(f"Product {barcode} not found (status={data.get('status')})")
                
                if 'product' not in data:
                    raise BarcodeNotFoundError(f"No product data for barcode {barcode}")
                
                logger.info(f"Successfully fetched product {barcode} from OFF API")
                return data['product']
                
            except (BarcodeNotFoundError, OpenFoodFactsAPIError):
                # Don't retry these
                raise
                
            except (httpx.RequestError, httpx.TimeoutException) as e:
                if attempt < config.off_max_retries - 1:
                    wait_time = config.off_retry_delay * (2 ** attempt)
                    logger.warning(f"Request error ({e}), retrying in {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise OpenFoodFactsAPIError(f"Failed to fetch product after {config.off_max_retries} attempts: {e}")
        
        raise OpenFoodFactsAPIError(f"Failed to fetch product {barcode} after all retry attempts")
    
    async def close(self):
        """Close HTTP client."""
        if self._client:
            await self._client.aclose()


class BarcodeService:
    """
    Main service for barcode lookup combining API calls and caching.
    """
    
    def __init__(self):
        self.cache = BarcodeRedisCache()
        self.api_client = BarcodeAPIClient()
        self.field_mapper = BarcodeFieldMapper()
    
    async def lookup_by_barcode(self, barcode: str) -> Optional[ProductResponse]:
        """
        Look up product by barcode with caching.
        
        This is the main entry point that:
        1. Validates barcode format
        2. Checks Redis cache first
        3. Falls back to Open Food Facts API if not cached
        4. Maps raw API data to canonical schema
        5. Caches successful results
        6. Handles all errors gracefully
        
        Args:
            barcode: Product barcode string
            
        Returns:
            ProductResponse object if found, None if not found or on errors
        """
        # Validate barcode
        if not barcode or not isinstance(barcode, str):
            logger.warning(f"Invalid barcode format: {barcode}")
            return None
        
        barcode = barcode.strip()
        if not barcode or not barcode.isdigit():
            logger.warning(f"Invalid barcode format: {barcode}")
            return None
        
        start_time = datetime.now()
        
        try:
            # Try cache first
            cached_data = await self.cache.get(barcode)
            if cached_data:
                # Remove cache metadata before creating response
                if '_cache_metadata' in cached_data:
                    del cached_data['_cache_metadata']
                
                try:
                    product = ProductResponse(**cached_data)
                    cache_latency = (datetime.now() - start_time).total_seconds()
                    logger.info(f"Cache hit for barcode {barcode} ({cache_latency:.3f}s)")
                    return product
                except Exception as e:
                    logger.error(f"Error deserializing cached data for {barcode}: {e}")
                    # Continue to API fallback
            
            # Fetch from API
            try:
                raw_product_data = await self.api_client.fetch_product(barcode)
                
                # Map to canonical schema
                product = self._map_to_product_response(raw_product_data, barcode)
                
                # Cache the successful result
                product_dict = product.model_dump()
                cache_success = await self.cache.set(barcode, product_dict)
                
                api_latency = (datetime.now() - start_time).total_seconds()
                logger.info(f"API fetch for barcode {barcode} ({api_latency:.3f}s, cached: {cache_success})")
                
                return product
                
            except BarcodeNotFoundError:
                logger.info(f"Barcode {barcode} not found in Open Food Facts")
                return None
                
            except OpenFoodFactsAPIError as e:
                logger.error(f"Open Food Facts API error for barcode {barcode}: {e}")
                return None
        
        except Exception as e:
            logger.error(f"Unexpected error looking up barcode {barcode}: {e}")
            return None
    
    def _map_to_product_response(self, raw_data: Dict[str, Any], barcode: str) -> ProductResponse:
        """
        Map raw Open Food Facts data to canonical ProductResponse schema.
        """
        nutriments = self.field_mapper.map_nutriments(raw_data)
        
        return ProductResponse(
            source="OpenFoodFacts",
            barcode=barcode,
            name=self.field_mapper.extract_name(raw_data),
            brand=self.field_mapper.extract_brands(raw_data),
            image_url=self.field_mapper.extract_image_url(raw_data),
            serving_size=self.field_mapper.extract_serving_size(raw_data),
            nutriments=nutriments,
            fetched_at=datetime.now()
        )
    
    async def close(self):
        """Close all connections."""
        await self.cache.close()
        await self.api_client.close()


# Global service instance
barcode_service = BarcodeService()


# Convenience function for direct usage
async def lookup_by_barcode(barcode: str) -> Optional[ProductResponse]:
    """
    Convenience function for barcode lookup.
    
    Args:
        barcode: Product barcode string
        
    Returns:
        ProductResponse if found, None if not found or on errors
    """
    return await barcode_service.lookup_by_barcode(barcode)

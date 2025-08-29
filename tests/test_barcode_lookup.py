import pytest
import json
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any

import httpx
import redis.asyncio as redis

from app.services.barcode_lookup import (
    BarcodeService,
    BarcodeFieldMapper,
    BarcodeRedisCache,
    BarcodeAPIClient,
    BarcodeNotFoundError,
    OpenFoodFactsAPIError,
    lookup_by_barcode
)
from app.models.product import ProductResponse, Nutriments


@pytest.fixture
def sample_off_response():
    """Sample Open Food Facts API response"""
    return {
        "status": 1,
        "product": {
            "product_name": "Test Cereal",
            "product_name_en": "Test Cereal English",
            "brands": "Brand A, Brand B, Brand C",
            "image_front_url": "https://example.com/image.jpg",
            "serving_size": "30g",
            "serving_quantity": "30",
            "serving_quantity_unit": "g",
            "nutriments": {
                "energy-kcal_100g": 380.0,
                "proteins_100g": 8.5,
                "fat_100g": 2.1,
                "carbohydrates_100g": 78.0,
                "sugars_100g": 15.0,
                "salt_100g": 0.75
            }
        }
    }


@pytest.fixture
def sample_product_response():
    """Expected ProductResponse from sample OFF data"""
    return ProductResponse(
        source="OpenFoodFacts",
        barcode="1234567890123",
        name="Test Cereal",
        brand="Brand A",
        image_url="https://example.com/image.jpg",
        serving_size="30g",
        nutriments=Nutriments(
            energy_kcal_per_100g=380.0,
            protein_g_per_100g=8.5,
            fat_g_per_100g=2.1,
            carbs_g_per_100g=78.0,
            sugars_g_per_100g=15.0,
            salt_g_per_100g=0.75
        ),
        fetched_at=datetime.now()
    )


class TestBarcodeFieldMapper:
    """Test field mapping logic with various edge cases"""
    
    def test_extract_name_primary_field(self):
        """Test name extraction from primary field"""
        data = {"product_name": "Test Product"}
        name = BarcodeFieldMapper.extract_name(data)
        assert name == "Test Product"
    
    def test_extract_name_fallback_fields(self):
        """Test name extraction with fallback fields"""
        # Test fallback to product_name_en
        data = {"product_name": "", "product_name_en": "English Name"}
        name = BarcodeFieldMapper.extract_name(data)
        assert name == "English Name"
        
        # Test fallback to generic_name
        data = {"product_name": "", "generic_name": "Generic Name"}
        name = BarcodeFieldMapper.extract_name(data)
        assert name == "Generic Name"
    
    def test_extract_name_no_valid_name(self):
        """Test name extraction when no valid name found"""
        data = {"product_name": "", "other_field": "value"}
        name = BarcodeFieldMapper.extract_name(data)
        assert name is None
    
    def test_extract_brands_single(self):
        """Test brand extraction from single brand"""
        data = {"brands": "Single Brand"}
        brand = BarcodeFieldMapper.extract_brands(data)
        assert brand == "Single Brand"
    
    def test_extract_brands_comma_separated(self):
        """Test brand extraction from comma-separated list"""
        data = {"brands": "Brand A, Brand B, Brand C"}
        brand = BarcodeFieldMapper.extract_brands(data)
        assert brand == "Brand A"  # Should return first brand
    
    def test_extract_brands_empty(self):
        """Test brand extraction when empty"""
        data = {"brands": ""}
        brand = BarcodeFieldMapper.extract_brands(data)
        assert brand is None
    
    def test_extract_image_url_primary(self):
        """Test image URL extraction from primary field"""
        data = {"image_front_url": "https://example.com/front.jpg"}
        url = BarcodeFieldMapper.extract_image_url(data)
        assert url == "https://example.com/front.jpg"
    
    def test_extract_image_url_fallback(self):
        """Test image URL extraction with fallback"""
        data = {
            "image_front_url": "",
            "selected_images": {
                "front": {
                    "display": "https://example.com/display.jpg"
                }
            }
        }
        url = BarcodeFieldMapper.extract_image_url(data)
        assert url == "https://example.com/display.jpg"
    
    def test_extract_serving_size_direct(self):
        """Test serving size extraction from direct field"""
        data = {"serving_size": "50g"}
        serving = BarcodeFieldMapper.extract_serving_size(data)
        assert serving == "50g"
    
    def test_extract_serving_size_constructed(self):
        """Test serving size construction from quantity and unit"""
        data = {
            "serving_size": "",
            "serving_quantity": 30.0,
            "serving_quantity_unit": "g"
        }
        serving = BarcodeFieldMapper.extract_serving_size(data)
        assert serving == "30g"
    
    def test_extract_energy_kcal_direct(self):
        """Test energy extraction from direct kcal field"""
        nutriments = {"energy-kcal_100g": 250.5}
        energy = BarcodeFieldMapper.extract_energy_kcal(nutriments)
        assert energy == 250.5
    
    def test_extract_energy_kcal_from_kj(self):
        """Test energy extraction with kJ to kcal conversion"""
        nutriments = {"energy_100g": 1046.0}  # ~250 kcal
        energy = BarcodeFieldMapper.extract_energy_kcal(nutriments)
        expected = round(1046.0 / 4.184, 1)
        assert abs(energy - expected) < 0.1
    
    def test_extract_nutrient_standard_field(self):
        """Test nutrient extraction from standard field"""
        nutriments = {"proteins_100g": 12.5}
        protein = BarcodeFieldMapper.extract_nutrient(nutriments, "proteins")
        assert protein == 12.5
    
    def test_extract_nutrient_fallback_fields(self):
        """Test nutrient extraction with fallback fields"""
        nutriments = {"fat_value": 8.2}
        fat = BarcodeFieldMapper.extract_nutrient(nutriments, "fat")
        assert fat == 8.2
    
    def test_map_nutriments_complete(self):
        """Test complete nutriment mapping"""
        product_data = {
            "nutriments": {
                "energy-kcal_100g": 300.0,
                "proteins_100g": 10.0,
                "fat_100g": 5.0,
                "carbohydrates_100g": 50.0,
                "sugars_100g": 8.0,
                "salt_100g": 1.0
            }
        }
        
        nutriments = BarcodeFieldMapper.map_nutriments(product_data)
        
        assert nutriments.energy_kcal_per_100g == 300.0
        assert nutriments.protein_g_per_100g == 10.0
        assert nutriments.fat_g_per_100g == 5.0
        assert nutriments.carbs_g_per_100g == 50.0
        assert nutriments.sugars_g_per_100g == 8.0
        assert nutriments.salt_g_per_100g == 1.0
    
    def test_map_nutriments_missing_fields(self):
        """Test nutriment mapping with missing fields"""
        product_data = {
            "nutriments": {
                "energy-kcal_100g": 200.0,
                "proteins_100g": 15.0
                # Missing other nutrients
            }
        }
        
        nutriments = BarcodeFieldMapper.map_nutriments(product_data)
        
        assert nutriments.energy_kcal_per_100g == 200.0
        assert nutriments.protein_g_per_100g == 15.0
        assert nutriments.fat_g_per_100g is None
        assert nutriments.carbs_g_per_100g is None
    
    def test_map_nutriments_invalid_structure(self):
        """Test nutriment mapping with invalid data structure"""
        product_data = {"nutriments": "invalid"}
        
        nutriments = BarcodeFieldMapper.map_nutriments(product_data)
        
        # Should handle gracefully with all None values
        assert nutriments.energy_kcal_per_100g is None
        assert nutriments.protein_g_per_100g is None


class TestBarcodeRedisCache:
    """Test Redis caching functionality"""
    
    @pytest.fixture
    def cache(self):
        return BarcodeRedisCache()
    
    @pytest.mark.asyncio
    async def test_cache_get_hit(self, cache):
        """Test cache hit scenario"""
        barcode = "1234567890123"
        cached_data = {"name": "Test Product", "brand": "Test Brand"}
        
        with patch.object(cache, '_get_redis_client') as mock_redis:
            mock_client = AsyncMock()
            mock_client.get.return_value = json.dumps(cached_data)
            mock_redis.return_value = mock_client
            
            result = await cache.get(barcode)
            
            assert result == cached_data
            mock_client.get.assert_called_once_with("barcode:product:1234567890123")
    
    @pytest.mark.asyncio
    async def test_cache_get_miss(self, cache):
        """Test cache miss scenario"""
        barcode = "1234567890123"
        
        with patch.object(cache, '_get_redis_client') as mock_redis:
            mock_client = AsyncMock()
            mock_client.get.return_value = None
            mock_redis.return_value = mock_client
            
            result = await cache.get(barcode)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_cache_get_redis_error(self, cache):
        """Test cache get with Redis error"""
        barcode = "1234567890123"
        
        with patch.object(cache, '_get_redis_client') as mock_redis:
            mock_client = AsyncMock()
            mock_client.get.side_effect = redis.RedisError("Connection failed")
            mock_redis.return_value = mock_client
            
            result = await cache.get(barcode)
            
            assert result is None  # Should handle error gracefully
    
    @pytest.mark.asyncio
    async def test_cache_set_success(self, cache):
        """Test successful cache set"""
        barcode = "1234567890123"
        product_data = {"name": "Test Product"}
        
        with patch.object(cache, '_get_redis_client') as mock_redis, \
             patch('app.config.config.redis_cache_ttl_hours', 24):
            
            mock_client = AsyncMock()
            mock_redis.return_value = mock_client
            
            result = await cache.set(barcode, product_data)
            
            assert result is True
            mock_client.setex.assert_called_once()
            # Verify TTL is set correctly
            call_args = mock_client.setex.call_args
            assert call_args[0][1] == 24 * 3600  # TTL in seconds
    
    @pytest.mark.asyncio
    async def test_cache_set_redis_error(self, cache):
        """Test cache set with Redis error"""
        barcode = "1234567890123"
        product_data = {"name": "Test Product"}
        
        with patch.object(cache, '_get_redis_client') as mock_redis:
            mock_client = AsyncMock()
            mock_client.setex.side_effect = redis.RedisError("Write failed")
            mock_redis.return_value = mock_client
            
            result = await cache.set(barcode, product_data)
            
            assert result is False
    
    def test_get_cache_key(self):
        """Test cache key generation"""
        cache = BarcodeRedisCache()
        key = cache._get_cache_key("1234567890123")
        assert key == "barcode:product:1234567890123"


class TestBarcodeAPIClient:
    """Test Open Food Facts API client"""
    
    @pytest.fixture
    def api_client(self):
        return BarcodeAPIClient()
    
    @pytest.mark.asyncio
    async def test_fetch_product_success(self, api_client, sample_off_response):
        """Test successful product fetch"""
        barcode = "1234567890123"
        
        with patch.object(api_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.json.return_value = sample_off_response
            mock_response.raise_for_status = MagicMock()
            mock_client.get.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            result = await api_client.fetch_product(barcode)
            
            assert result == sample_off_response["product"]
            mock_client.get.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_fetch_product_not_found_404(self, api_client):
        """Test product not found (404 status)"""
        barcode = "0000000000000"
        
        with patch.object(api_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status_code = 404
            mock_client.get.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            with pytest.raises(BarcodeNotFoundError):
                await api_client.fetch_product(barcode)
    
    @pytest.mark.asyncio
    async def test_fetch_product_not_found_status_0(self, api_client):
        """Test product not found (status=0 in response)"""
        barcode = "0000000000000"
        
        with patch.object(api_client, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"status": 0}
            mock_response.raise_for_status = MagicMock()
            mock_client.get.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            with pytest.raises(BarcodeNotFoundError):
                await api_client.fetch_product(barcode)
    
    @pytest.mark.asyncio
    async def test_fetch_product_rate_limit_retry(self, api_client, sample_off_response):
        """Test rate limit handling with retry"""
        barcode = "1234567890123"
        
        with patch.object(api_client, '_get_client') as mock_get_client, \
             patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
            
            mock_client = AsyncMock()
            
            # First call returns 429, second call succeeds
            rate_limit_response = AsyncMock()
            rate_limit_response.status_code = 429
            
            success_response = AsyncMock()
            success_response.status_code = 200
            success_response.json.return_value = sample_off_response
            success_response.raise_for_status = MagicMock()
            
            mock_client.get.side_effect = [rate_limit_response, success_response]
            mock_get_client.return_value = mock_client
            
            result = await api_client.fetch_product(barcode)
            
            assert result == sample_off_response["product"]
            assert mock_client.get.call_count == 2
            mock_sleep.assert_called_once()  # Should have slept due to rate limit
    
    @pytest.mark.asyncio
    async def test_fetch_product_server_error_retry(self, api_client, sample_off_response):
        """Test server error handling with retry"""
        barcode = "1234567890123"
        
        with patch.object(api_client, '_get_client') as mock_get_client, \
             patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
            
            mock_client = AsyncMock()
            
            # First call returns 500, second call succeeds
            error_response = AsyncMock()
            error_response.status_code = 500
            error_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                "Server Error", request=MagicMock(), response=error_response
            )
            
            success_response = AsyncMock()
            success_response.status_code = 200
            success_response.json.return_value = sample_off_response
            success_response.raise_for_status = MagicMock()
            
            mock_client.get.side_effect = [error_response, success_response]
            mock_get_client.return_value = mock_client
            
            result = await api_client.fetch_product(barcode)
            
            assert result == sample_off_response["product"]
            assert mock_client.get.call_count == 2
            mock_sleep.assert_called_once()  # Should have slept due to retry
    
    @pytest.mark.asyncio
    async def test_fetch_product_max_retries_exceeded(self, api_client):
        """Test max retries exceeded"""
        barcode = "1234567890123"
        
        with patch.object(api_client, '_get_client') as mock_get_client, \
             patch('asyncio.sleep', new_callable=AsyncMock), \
             patch('app.config.config.off_max_retries', 2):
            
            mock_client = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status_code = 500
            mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                "Server Error", request=MagicMock(), response=mock_response
            )
            mock_client.get.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            with pytest.raises(OpenFoodFactsAPIError, match="server error"):
                await api_client.fetch_product(barcode)
    
    @pytest.mark.asyncio
    async def test_fetch_product_network_error(self, api_client):
        """Test network error handling"""
        barcode = "1234567890123"
        
        with patch.object(api_client, '_get_client') as mock_get_client, \
             patch('app.config.config.off_max_retries', 1):
            
            mock_client = AsyncMock()
            mock_client.get.side_effect = httpx.RequestError("Network error")
            mock_get_client.return_value = mock_client
            
            with pytest.raises(OpenFoodFactsAPIError, match="Failed to fetch product"):
                await api_client.fetch_product(barcode)
    
    @pytest.mark.asyncio
    async def test_respect_rate_limit(self, api_client):
        """Test rate limiting implementation"""
        with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep, \
             patch('app.config.config.off_rate_limit_delay', 0.5):
            
            # Simulate consecutive calls
            await api_client._respect_rate_limit()
            await api_client._respect_rate_limit()
            
            # Second call should trigger sleep
            mock_sleep.assert_called_once()


class TestBarcodeService:
    """Test the main barcode service"""
    
    @pytest.fixture
    def service(self):
        return BarcodeService()
    
    @pytest.mark.asyncio
    async def test_lookup_by_barcode_cache_hit(self, service, sample_product_response):
        """Test lookup with cache hit"""
        barcode = "1234567890123"
        cached_data = sample_product_response.model_dump()
        
        with patch.object(service.cache, 'get', return_value=cached_data):
            result = await service.lookup_by_barcode(barcode)
            
            assert result is not None
            assert result.barcode == barcode
            assert result.name == "Test Cereal"
            assert result.source == "OpenFoodFacts"
    
    @pytest.mark.asyncio
    async def test_lookup_by_barcode_cache_miss_api_success(self, service, sample_off_response):
        """Test lookup with cache miss but API success"""
        barcode = "1234567890123"
        
        with patch.object(service.cache, 'get', return_value=None), \
             patch.object(service.cache, 'set', return_value=True), \
             patch.object(service.api_client, 'fetch_product', return_value=sample_off_response["product"]):
            
            result = await service.lookup_by_barcode(barcode)
            
            assert result is not None
            assert result.barcode == barcode
            assert result.name == "Test Cereal"
            assert result.brand == "Brand A"  # Should take first brand
    
    @pytest.mark.asyncio
    async def test_lookup_by_barcode_not_found(self, service):
        """Test lookup when barcode not found"""
        barcode = "0000000000000"
        
        with patch.object(service.cache, 'get', return_value=None), \
             patch.object(service.api_client, 'fetch_product', side_effect=BarcodeNotFoundError("Not found")):
            
            result = await service.lookup_by_barcode(barcode)
            
            assert result is None
    
    @pytest.mark.asyncio
    async def test_lookup_by_barcode_api_error(self, service):
        """Test lookup when API error occurs"""
        barcode = "1234567890123"
        
        with patch.object(service.cache, 'get', return_value=None), \
             patch.object(service.api_client, 'fetch_product', side_effect=OpenFoodFactsAPIError("API Error")):
            
            result = await service.lookup_by_barcode(barcode)
            
            assert result is None  # Should handle error gracefully
    
    @pytest.mark.asyncio
    async def test_lookup_by_barcode_invalid_input(self, service):
        """Test lookup with invalid barcode input"""
        invalid_barcodes = ["", None, "abc123", "  ", 12345]
        
        for invalid_barcode in invalid_barcodes:
            result = await service.lookup_by_barcode(invalid_barcode)
            assert result is None
    
    @pytest.mark.asyncio
    async def test_lookup_by_barcode_corrupted_cache(self, service, sample_off_response):
        """Test lookup with corrupted cache data (should fallback to API)"""
        barcode = "1234567890123"
        
        # Cached data that will cause deserialization error
        corrupted_cache = {"invalid": "structure"}
        
        with patch.object(service.cache, 'get', return_value=corrupted_cache), \
             patch.object(service.cache, 'set', return_value=True), \
             patch.object(service.api_client, 'fetch_product', return_value=sample_off_response["product"]):
            
            result = await service.lookup_by_barcode(barcode)
            
            assert result is not None
            assert result.barcode == barcode  # Should have fallen back to API
    
    def test_map_to_product_response(self, service, sample_off_response):
        """Test mapping from OFF data to ProductResponse"""
        barcode = "1234567890123"
        raw_data = sample_off_response["product"]
        
        result = service._map_to_product_response(raw_data, barcode)
        
        assert isinstance(result, ProductResponse)
        assert result.barcode == barcode
        assert result.name == "Test Cereal"
        assert result.brand == "Brand A"  # First brand from comma-separated list
        assert result.nutriments.energy_kcal_per_100g == 380.0
        assert result.source == "OpenFoodFacts"


class TestConvenienceFunction:
    """Test the standalone convenience function"""
    
    @pytest.mark.asyncio
    async def test_lookup_by_barcode_function(self, sample_product_response):
        """Test the standalone lookup_by_barcode function"""
        barcode = "1234567890123"
        cached_data = sample_product_response.model_dump()
        
        with patch('app.services.barcode_lookup.barcode_service') as mock_service:
            mock_service.lookup_by_barcode.return_value = sample_product_response
            
            result = await lookup_by_barcode(barcode)
            
            assert result == sample_product_response
            mock_service.lookup_by_barcode.assert_called_once_with(barcode)


class TestEdgeCasesAndErrorHandling:
    """Test various edge cases and error conditions"""
    
    @pytest.mark.asyncio
    async def test_concurrent_requests_same_barcode(self):
        """Test handling of concurrent requests for the same barcode"""
        barcode = "1234567890123"
        
        async def mock_fetch_with_delay():
            await asyncio.sleep(0.1)  # Simulate API latency
            return {"product_name": "Concurrent Test"}
        
        service = BarcodeService()
        
        with patch.object(service.cache, 'get', return_value=None), \
             patch.object(service.cache, 'set', return_value=True), \
             patch.object(service.api_client, 'fetch_product', side_effect=mock_fetch_with_delay):
            
            # Start multiple concurrent requests
            tasks = [service.lookup_by_barcode(barcode) for _ in range(3)]
            results = await asyncio.gather(*tasks)
            
            # All should succeed (though may hit API multiple times)
            assert all(result is not None for result in results)
    
    def test_field_mapper_with_mixed_data_types(self):
        """Test field mapper handling mixed/invalid data types"""
        # Test with numeric values as strings
        product_data = {
            "nutriments": {
                "energy-kcal_100g": "350.5",  # String instead of float
                "proteins_100g": 12,          # Int instead of float
                "fat_100g": None,            # None value
                "invalid_field": "not_a_number"
            }
        }
        
        nutriments = BarcodeFieldMapper.map_nutriments(product_data)
        
        assert nutriments.energy_kcal_per_100g == 350.5  # Should parse string
        assert nutriments.protein_g_per_100g == 12.0     # Should handle int
        assert nutriments.fat_g_per_100g is None         # Should handle None
    
    def test_cache_key_generation_special_characters(self):
        """Test cache key generation with various barcode formats"""
        cache = BarcodeRedisCache()
        
        # Standard barcode
        key1 = cache._get_cache_key("1234567890123")
        assert key1 == "barcode:product:1234567890123"
        
        # Barcode with leading zeros
        key2 = cache._get_cache_key("0001234567890")
        assert key2 == "barcode:product:0001234567890"
        
        # Long barcode (EAN-128)
        key3 = cache._get_cache_key("12345678901234567890")
        assert key3 == "barcode:product:12345678901234567890"


# Integration test combining multiple components
@pytest.mark.asyncio
async def test_full_integration_mock_dependencies():
    """Integration test with all dependencies mocked"""
    barcode = "1234567890123"
    
    # Mock Redis cache miss then set
    mock_redis_client = AsyncMock()
    mock_redis_client.get.return_value = None  # Cache miss
    
    # Mock HTTP client success
    mock_http_response = AsyncMock()
    mock_http_response.status_code = 200
    mock_http_response.json.return_value = {
        "status": 1,
        "product": {
            "product_name": "Integration Test Product",
            "brands": "Test Brand",
            "nutriments": {
                "energy-kcal_100g": 400.0,
                "proteins_100g": 20.0
            }
        }
    }
    mock_http_response.raise_for_status = MagicMock()
    
    mock_http_client = AsyncMock()
    mock_http_client.get.return_value = mock_http_response
    
    # Patch all external dependencies
    with patch('redis.asyncio.Redis') as mock_redis, \
         patch('httpx.AsyncClient') as mock_http, \
         patch('app.config.config.off_rate_limit_delay', 0):  # No rate limiting in tests
        
        mock_redis.return_value = mock_redis_client
        mock_http.return_value = mock_http_client
        
        # Test the full flow
        result = await lookup_by_barcode(barcode)
        
        assert result is not None
        assert result.name == "Integration Test Product"
        assert result.brand == "Test Brand"
        assert result.nutriments.energy_kcal_per_100g == 400.0
        assert result.source == "OpenFoodFacts"
        
        # Verify interactions
        mock_redis_client.get.assert_called_once()  # Cache check
        mock_http_client.get.assert_called_once()   # API call
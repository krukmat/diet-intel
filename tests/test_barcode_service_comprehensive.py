import pytest
import json
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from typing import Dict, Any, Optional

import httpx
import redis.asyncio as redis

# Mock the config to avoid dependency issues
@pytest.fixture(autouse=True)
def mock_config():
    with patch('app.services.barcode_lookup.config') as mock_config:
        mock_config.redis_url = "redis://localhost:6379"
        mock_config.redis_max_connections = 10
        mock_config.redis_cache_ttl_hours = 24
        mock_config.off_timeout = 10.0
        mock_config.off_base_url = "https://world.openfoodfacts.org"
        mock_config.off_rate_limit_delay = 0.1
        mock_config.off_max_retries = 3
        mock_config.off_retry_delay = 1.0
        yield mock_config

pytestmark = pytest.mark.asyncio

# Import after mocking config
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


class TestBarcodeFieldMapper:
    """Test the field mapping logic for Open Food Facts data"""
    
    def setup_method(self):
        self.mapper = BarcodeFieldMapper()
    
    def test_extract_name_priority_order(self):
        """Test product name extraction with priority fallbacks"""
        # Test priority: product_name > product_name_en > generic_name > abbreviated_product_name
        product_data = {
            'product_name': 'Primary Name',
            'product_name_en': 'English Name',
            'generic_name': 'Generic Name',
            'abbreviated_product_name': 'Abbrev Name'
        }
        assert self.mapper.extract_name(product_data) == 'Primary Name'
        
        # Remove primary, should get English name
        del product_data['product_name']
        assert self.mapper.extract_name(product_data) == 'English Name'
        
        # Remove English, should get generic
        del product_data['product_name_en']
        assert self.mapper.extract_name(product_data) == 'Generic Name'
        
        # Remove generic, should get abbreviated
        del product_data['generic_name']
        assert self.mapper.extract_name(product_data) == 'Abbrev Name'
    
    def test_extract_name_empty_values(self):
        """Test handling of empty name values"""
        # Empty strings should be skipped
        product_data = {
            'product_name': '',
            'product_name_en': '   ',  # Whitespace only
            'generic_name': 'Valid Name'
        }
        assert self.mapper.extract_name(product_data) == 'Valid Name'
        
        # No valid names
        product_data = {
            'product_name': '',
            'product_name_en': '',
            'generic_name': '',
            'abbreviated_product_name': ''
        }
        assert self.mapper.extract_name(product_data) is None
    
    def test_extract_brands_single_brand(self):
        """Test brand extraction for single brand"""
        product_data = {'brands': 'Coca-Cola'}
        assert self.mapper.extract_brands(product_data) == 'Coca-Cola'
    
    def test_extract_brands_multiple_brands(self):
        """Test brand extraction takes first of multiple brands"""
        product_data = {'brands': 'Coca-Cola, PepsiCo, Dr Pepper'}
        assert self.mapper.extract_brands(product_data) == 'Coca-Cola'
    
    def test_extract_brands_empty_values(self):
        """Test brand extraction with empty/missing values"""
        assert self.mapper.extract_brands({}) is None
        assert self.mapper.extract_brands({'brands': ''}) is None
        assert self.mapper.extract_brands({'brands': '   '}) is None
    
    def test_extract_image_url_priority(self):
        """Test image URL extraction with priority fallbacks"""
        product_data = {
            'image_front_url': 'https://front.jpg',
            'image_url': 'https://image.jpg',
            'selected_images': {
                'front': {
                    'display': 'https://display.jpg'
                }
            }
        }
        # Should prefer image_front_url
        assert self.mapper.extract_image_url(product_data) == 'https://front.jpg'
        
        # Remove front URL, should get image_url
        del product_data['image_front_url']
        assert self.mapper.extract_image_url(product_data) == 'https://image.jpg'
        
        # Remove image_url, should get selected_images display
        del product_data['image_url']
        assert self.mapper.extract_image_url(product_data) == 'https://display.jpg'
    
    def test_extract_image_url_invalid_values(self):
        """Test image URL extraction with invalid values"""
        # Non-HTTP URLs should be rejected
        product_data = {'image_front_url': 'ftp://invalid.jpg'}
        assert self.mapper.extract_image_url(product_data) is None
        
        # Non-string values
        product_data = {'image_front_url': 123}
        assert self.mapper.extract_image_url(product_data) is None
        
        # Malformed selected_images structure
        product_data = {
            'selected_images': {
                'front': 'not_a_dict'
            }
        }
        assert self.mapper.extract_image_url(product_data) is None
    
    def test_extract_serving_size_direct(self):
        """Test direct serving size extraction"""
        product_data = {'serving_size': '150g'}
        assert self.mapper.extract_serving_size(product_data) == '150g'
    
    def test_extract_serving_size_constructed(self):
        """Test serving size construction from quantity and unit"""
        product_data = {
            'serving_quantity': '30',
            'serving_quantity_unit': 'g'
        }
        assert self.mapper.extract_serving_size(product_data) == '30g'
        
        # Numeric quantity
        product_data = {
            'serving_quantity': 30.5,
            'serving_quantity_unit': 'ml'
        }
        assert self.mapper.extract_serving_size(product_data) == '30ml'
    
    def test_extract_serving_size_invalid(self):
        """Test serving size extraction with invalid values"""
        # Missing unit
        product_data = {'serving_quantity': '30'}
        assert self.mapper.extract_serving_size(product_data) is None
        
        # Invalid quantity
        product_data = {
            'serving_quantity': 'invalid',
            'serving_quantity_unit': 'g'
        }
        assert self.mapper.extract_serving_size(product_data) is None
    
    def test_extract_energy_kcal_direct(self):
        """Test direct energy kcal extraction"""
        nutriments = {'energy-kcal_100g': 350.0}
        assert self.mapper.extract_energy_kcal(nutriments) == 350.0
        
        # Alternative field names
        nutriments = {'energy_kcal_100g': 250.0}
        assert self.mapper.extract_energy_kcal(nutriments) == 250.0
    
    def test_extract_energy_kcal_from_kj_conversion(self):
        """Test energy conversion from kJ to kcal"""
        # 1 kcal = 4.184 kJ, so 418.4 kJ = 100 kcal
        nutriments = {'energy_100g': 418.4}
        result = self.mapper.extract_energy_kcal(nutriments)
        assert abs(result - 100.0) < 0.1  # Allow for rounding
        
        # Alternative kJ field
        nutriments = {'energy-kj_100g': 836.8}  # 200 kcal
        result = self.mapper.extract_energy_kcal(nutriments)
        assert abs(result - 200.0) < 0.1
    
    def test_extract_energy_kcal_invalid(self):
        """Test energy extraction with invalid values"""
        # Non-numeric values
        nutriments = {'energy-kcal_100g': 'invalid'}
        assert self.mapper.extract_energy_kcal(nutriments) is None
        
        # No energy data
        nutriments = {}
        assert self.mapper.extract_energy_kcal(nutriments) is None
    
    def test_extract_nutrient_basic(self):
        """Test basic nutrient extraction"""
        nutriments = {'proteins_100g': 15.0}
        assert self.mapper.extract_nutrient(nutriments, 'proteins') == 15.0
        
        # Alternative patterns
        nutriments = {'fat_value': 8.5}
        assert self.mapper.extract_nutrient(nutriments, 'fat') == 8.5
    
    def test_extract_nutrient_invalid(self):
        """Test nutrient extraction with invalid values"""
        nutriments = {'proteins_100g': 'invalid'}
        assert self.mapper.extract_nutrient(nutriments, 'proteins') is None
        
        # Missing field
        nutriments = {}
        assert self.mapper.extract_nutrient(nutriments, 'proteins') is None
    
    def test_map_nutriments_complete(self):
        """Test complete nutriment mapping"""
        product_data = {
            'nutriments': {
                'energy-kcal_100g': 350.0,
                'proteins_100g': 12.0,
                'fat_100g': 8.0,
                'carbohydrates_100g': 60.0,
                'sugars_100g': 15.0,
                'salt_100g': 1.2
            }
        }
        
        nutriments = self.mapper.map_nutriments(product_data)
        
        assert nutriments.energy_kcal_per_100g == 350.0
        assert nutriments.protein_g_per_100g == 12.0
        assert nutriments.fat_g_per_100g == 8.0
        assert nutriments.carbs_g_per_100g == 60.0
        assert nutriments.sugars_g_per_100g == 15.0
        assert nutriments.salt_g_per_100g == 1.2
    
    def test_map_nutriments_partial(self):
        """Test nutriment mapping with missing fields"""
        product_data = {
            'nutriments': {
                'energy-kcal_100g': 200.0,
                'proteins_100g': 10.0
                # Missing fat, carbs, sugars, salt
            }
        }
        
        nutriments = self.mapper.map_nutriments(product_data)
        
        assert nutriments.energy_kcal_per_100g == 200.0
        assert nutriments.protein_g_per_100g == 10.0
        assert nutriments.fat_g_per_100g is None
        assert nutriments.carbs_g_per_100g is None
        assert nutriments.sugars_g_per_100g is None
        assert nutriments.salt_g_per_100g is None
    
    def test_map_nutriments_invalid_structure(self):
        """Test nutriment mapping with invalid structure"""
        # Missing nutriments section
        product_data = {}
        nutriments = self.mapper.map_nutriments(product_data)
        assert all(getattr(nutriments, field) is None for field in 
                  ['energy_kcal_per_100g', 'protein_g_per_100g', 'fat_g_per_100g', 
                   'carbs_g_per_100g', 'sugars_g_per_100g', 'salt_g_per_100g'])
        
        # Non-dict nutriments
        product_data = {'nutriments': 'invalid'}
        nutriments = self.mapper.map_nutriments(product_data)
        assert all(getattr(nutriments, field) is None for field in 
                  ['energy_kcal_per_100g', 'protein_g_per_100g', 'fat_g_per_100g', 
                   'carbs_g_per_100g', 'sugars_g_per_100g', 'salt_g_per_100g'])


class TestBarcodeRedisCache:
    """Test Redis cache functionality"""
    
    def setup_method(self):
        self.cache = BarcodeRedisCache()
    
    @patch('redis.asyncio.ConnectionPool.from_url')
    @patch('redis.asyncio.Redis')
    async def test_get_redis_client_initialization(self, mock_redis, mock_pool):
        """Test Redis client initialization"""
        mock_client = AsyncMock()
        mock_redis.return_value = mock_client
        mock_pool_instance = Mock()
        mock_pool.return_value = mock_pool_instance
        
        client = await self.cache._get_redis_client()
        
        assert client == mock_client
        mock_pool.assert_called_once()
        mock_redis.assert_called_once_with(connection_pool=mock_pool_instance)
    
    def test_get_cache_key(self):
        """Test cache key generation"""
        key = self.cache._get_cache_key("1234567890123")
        assert key == "barcode:product:1234567890123"
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_get_hit(self, mock_get_client):
        """Test successful cache retrieval"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        cached_data = {"name": "Test Product", "barcode": "1234567890123"}
        mock_client.get.return_value = json.dumps(cached_data)
        
        result = await self.cache.get("1234567890123")
        
        assert result == cached_data
        mock_client.get.assert_called_once_with("barcode:product:1234567890123")
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_get_miss(self, mock_get_client):
        """Test cache miss"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        mock_client.get.return_value = None
        
        result = await self.cache.get("1234567890123")
        
        assert result is None
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_get_redis_error(self, mock_get_client):
        """Test cache get with Redis error"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        mock_client.get.side_effect = redis.RedisError("Connection failed")
        
        result = await self.cache.get("1234567890123")
        
        assert result is None  # Should handle error gracefully
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_get_json_decode_error(self, mock_get_client):
        """Test cache get with JSON decode error"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        mock_client.get.return_value = "invalid json"
        
        result = await self.cache.get("1234567890123")
        
        assert result is None  # Should handle error gracefully
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_set_success(self, mock_get_client):
        """Test successful cache storage"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        product_data = {"name": "Test Product", "barcode": "1234567890123"}
        
        result = await self.cache.set("1234567890123", product_data)
        
        assert result is True
        mock_client.setex.assert_called_once()
        
        # Check the arguments to setex
        call_args = mock_client.setex.call_args
        assert call_args[0][0] == "barcode:product:1234567890123"  # key
        assert call_args[0][1] == 24 * 3600  # TTL in seconds (24 hours)
        
        # Check JSON data contains original data plus metadata
        stored_data = json.loads(call_args[0][2])
        assert stored_data['name'] == "Test Product"
        assert stored_data['barcode'] == "1234567890123"
        assert '_cache_metadata' in stored_data
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_set_redis_error(self, mock_get_client):
        """Test cache set with Redis error"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        mock_client.setex.side_effect = redis.RedisError("Connection failed")
        
        result = await self.cache.set("1234567890123", {"name": "Test"})
        
        assert result is False
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_delete_success(self, mock_get_client):
        """Test successful cache deletion"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        mock_client.delete.return_value = 1  # 1 key deleted
        
        result = await self.cache.delete("1234567890123")
        
        assert result is True
        mock_client.delete.assert_called_once_with("barcode:product:1234567890123")
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache._get_redis_client')
    async def test_cache_delete_not_found(self, mock_get_client):
        """Test cache deletion when key doesn't exist"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        mock_client.delete.return_value = 0  # 0 keys deleted
        
        result = await self.cache.delete("1234567890123")
        
        assert result is False


class TestBarcodeAPIClient:
    """Test Open Food Facts API client"""
    
    def setup_method(self):
        self.api_client = BarcodeAPIClient()
    
    @patch('httpx.AsyncClient')
    async def test_get_client_initialization(self, mock_client_class):
        """Test HTTP client initialization"""
        mock_client = AsyncMock()
        mock_client_class.return_value = mock_client
        
        client = await self.api_client._get_client()
        
        assert client == mock_client
        # Check client was created with correct configuration
        mock_client_class.assert_called_once()
        call_kwargs = mock_client_class.call_args[1]
        assert call_kwargs['timeout'] == 10.0
        assert 'DietIntel' in call_kwargs['headers']['User-Agent']
    
    async def test_rate_limit_no_delay(self):
        """Test rate limiting with no delay configured"""
        # Should return immediately when rate limit delay is 0
        with patch('app.services.barcode_lookup.config.off_rate_limit_delay', 0):
            await self.api_client._respect_rate_limit()
            # Test passes if no exception and completes quickly
    
    @patch('asyncio.sleep')
    async def test_rate_limit_with_delay(self, mock_sleep):
        """Test rate limiting with configured delay"""
        with patch('app.services.barcode_lookup.config.off_rate_limit_delay', 1.0):
            # Simulate rapid successive calls
            await self.api_client._respect_rate_limit()
            await self.api_client._respect_rate_limit()
            
            # Second call should trigger sleep
            mock_sleep.assert_called()
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    async def test_fetch_product_success(self, mock_get_client):
        """Test successful product fetch"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {"product_name": "Test Product"}
        }
        mock_client.get.return_value = mock_response
        
        result = await self.api_client.fetch_product("1234567890123")
        
        assert result == {"product_name": "Test Product"}
        mock_client.get.assert_called_once()
        assert "1234567890123.json" in mock_client.get.call_args[0][0]
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    async def test_fetch_product_not_found_404(self, mock_get_client):
        """Test product not found (404 status)"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        mock_response = Mock()
        mock_response.status_code = 404
        mock_client.get.return_value = mock_response
        
        with pytest.raises(BarcodeNotFoundError):
            await self.api_client.fetch_product("0000000000000")
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    async def test_fetch_product_not_found_status_0(self, mock_get_client):
        """Test product not found (status=0 in response)"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": 0}
        mock_client.get.return_value = mock_response
        
        with pytest.raises(BarcodeNotFoundError):
            await self.api_client.fetch_product("0000000000000")
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    @patch('asyncio.sleep')
    async def test_fetch_product_rate_limited_retry(self, mock_sleep, mock_get_client):
        """Test handling of rate limiting with retry"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        # First call returns 429 (rate limited), second succeeds
        rate_limited_response = Mock()
        rate_limited_response.status_code = 429
        
        success_response = Mock()
        success_response.status_code = 200
        success_response.json.return_value = {
            "status": 1,
            "product": {"product_name": "Test Product"}
        }
        
        mock_client.get.side_effect = [rate_limited_response, success_response]
        
        result = await self.api_client.fetch_product("1234567890123")
        
        assert result == {"product_name": "Test Product"}
        assert mock_client.get.call_count == 2
        mock_sleep.assert_called()  # Should sleep before retry
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    @patch('asyncio.sleep')
    async def test_fetch_product_server_error_retry(self, mock_sleep, mock_get_client):
        """Test handling of server errors with retry"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        # First call returns 500, second succeeds
        server_error_response = Mock()
        server_error_response.status_code = 500
        
        success_response = Mock()
        success_response.status_code = 200
        success_response.json.return_value = {
            "status": 1,
            "product": {"product_name": "Test Product"}
        }
        
        mock_client.get.side_effect = [server_error_response, success_response]
        
        result = await self.api_client.fetch_product("1234567890123")
        
        assert result == {"product_name": "Test Product"}
        assert mock_client.get.call_count == 2
        mock_sleep.assert_called()
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    @patch('asyncio.sleep')
    async def test_fetch_product_max_retries_exceeded(self, mock_sleep, mock_get_client):
        """Test behavior when max retries exceeded"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        # Always return server error
        server_error_response = Mock()
        server_error_response.status_code = 500
        mock_client.get.return_value = server_error_response
        
        with pytest.raises(OpenFoodFactsAPIError):
            await self.api_client.fetch_product("1234567890123")
        
        # Should attempt max_retries times (3 by default)
        assert mock_client.get.call_count == 3
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    async def test_fetch_product_invalid_json(self, mock_get_client):
        """Test handling of invalid JSON response"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        mock_client.get.return_value = mock_response
        
        with pytest.raises(OpenFoodFactsAPIError):
            await self.api_client.fetch_product("1234567890123")
    
    @patch('app.services.barcode_lookup.BarcodeAPIClient._get_client')
    async def test_fetch_product_missing_product_data(self, mock_get_client):
        """Test handling of response without product data"""
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1
            # Missing 'product' key
        }
        mock_client.get.return_value = mock_response
        
        with pytest.raises(BarcodeNotFoundError):
            await self.api_client.fetch_product("1234567890123")


class TestBarcodeService:
    """Test the main BarcodeService integration"""
    
    def setup_method(self):
        self.service = BarcodeService()
    
    def test_service_initialization(self):
        """Test service components are properly initialized"""
        assert isinstance(self.service.cache, BarcodeRedisCache)
        assert isinstance(self.service.api_client, BarcodeAPIClient)
        assert isinstance(self.service.field_mapper, BarcodeFieldMapper)
    
    async def test_lookup_invalid_barcode_none(self):
        """Test lookup with None barcode"""
        result = await self.service.lookup_by_barcode(None)
        assert result is None
    
    async def test_lookup_invalid_barcode_empty(self):
        """Test lookup with empty barcode"""
        result = await self.service.lookup_by_barcode("")
        assert result is None
    
    async def test_lookup_invalid_barcode_non_numeric(self):
        """Test lookup with non-numeric barcode"""
        result = await self.service.lookup_by_barcode("abc123")
        assert result is None
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache.get')
    async def test_lookup_cache_hit(self, mock_cache_get):
        """Test successful lookup from cache"""
        cached_product = {
            "source": "OpenFoodFacts",
            "barcode": "1234567890123",
            "name": "Cached Product",
            "brand": None,
            "image_url": None,
            "serving_size": None,
            "nutriments": {
                "energy_kcal_per_100g": 200.0,
                "protein_g_per_100g": 10.0,
                "fat_g_per_100g": 5.0,
                "carbs_g_per_100g": 30.0,
                "sugars_g_per_100g": 15.0,
                "salt_g_per_100g": 0.5
            },
            "fetched_at": "2024-01-01T00:00:00",
            "_cache_metadata": {"cached_at": "2024-01-01T00:00:00"}
        }
        mock_cache_get.return_value = cached_product
        
        result = await self.service.lookup_by_barcode("1234567890123")
        
        assert isinstance(result, ProductResponse)
        assert result.name == "Cached Product"
        assert result.source == "OpenFoodFacts"
        mock_cache_get.assert_called_once_with("1234567890123")
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache.get')
    async def test_lookup_cache_invalid_data(self, mock_cache_get):
        """Test handling of invalid cached data"""
        # Return invalid cached data (missing required fields)
        mock_cache_get.return_value = {"invalid": "data"}
        
        # Should fall back to API
        with patch.object(self.service.api_client, 'fetch_product') as mock_api_fetch:
            mock_api_fetch.side_effect = BarcodeNotFoundError("Not found")
            
            result = await self.service.lookup_by_barcode("1234567890123")
            
            assert result is None
            mock_api_fetch.assert_called_once()
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache.get')
    @patch('app.services.barcode_lookup.BarcodeAPIClient.fetch_product')
    @patch('app.services.barcode_lookup.BarcodeRedisCache.set')
    async def test_lookup_api_success_with_caching(self, mock_cache_set, mock_api_fetch, mock_cache_get):
        """Test successful API lookup with caching"""
        # Cache miss
        mock_cache_get.return_value = None
        
        # API success
        api_product_data = {
            "product_name": "API Product",
            "brands": "Test Brand",
            "nutriments": {
                "energy-kcal_100g": 300.0,
                "proteins_100g": 15.0,
                "fat_100g": 10.0,
                "carbohydrates_100g": 40.0,
                "sugars_100g": 20.0,
                "salt_100g": 1.0
            }
        }
        mock_api_fetch.return_value = api_product_data
        mock_cache_set.return_value = True
        
        result = await self.service.lookup_by_barcode("1234567890123")
        
        assert isinstance(result, ProductResponse)
        assert result.name == "API Product"
        assert result.brand == "Test Brand"
        assert result.source == "OpenFoodFacts"
        assert result.barcode == "1234567890123"
        
        # Verify caching was attempted
        mock_cache_set.assert_called_once()
        cached_data = mock_cache_set.call_args[0][1]  # Second argument to set()
        assert cached_data['name'] == "API Product"
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache.get')
    @patch('app.services.barcode_lookup.BarcodeAPIClient.fetch_product')
    async def test_lookup_product_not_found(self, mock_api_fetch, mock_cache_get):
        """Test handling of product not found"""
        mock_cache_get.return_value = None
        mock_api_fetch.side_effect = BarcodeNotFoundError("Not found")
        
        result = await self.service.lookup_by_barcode("0000000000000")
        
        assert result is None
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache.get')
    @patch('app.services.barcode_lookup.BarcodeAPIClient.fetch_product')
    async def test_lookup_api_error(self, mock_api_fetch, mock_cache_get):
        """Test handling of API errors"""
        mock_cache_get.return_value = None
        mock_api_fetch.side_effect = OpenFoodFactsAPIError("API Error")
        
        result = await self.service.lookup_by_barcode("1234567890123")
        
        assert result is None
    
    @patch('app.services.barcode_lookup.BarcodeRedisCache.get')
    @patch('app.services.barcode_lookup.BarcodeAPIClient.fetch_product')
    async def test_lookup_unexpected_error(self, mock_api_fetch, mock_cache_get):
        """Test handling of unexpected errors"""
        mock_cache_get.return_value = None
        mock_api_fetch.side_effect = ValueError("Unexpected error")
        
        result = await self.service.lookup_by_barcode("1234567890123")
        
        assert result is None
    
    def test_map_to_product_response(self):
        """Test mapping raw API data to ProductResponse"""
        raw_data = {
            "product_name": "Test Product",
            "brands": "Test Brand",
            "serving_size": "100g",
            "nutriments": {
                "energy-kcal_100g": 250.0,
                "proteins_100g": 12.0,
                "fat_100g": 8.0,
                "carbohydrates_100g": 35.0,
                "sugars_100g": 18.0,
                "salt_100g": 0.8
            }
        }
        
        result = self.service._map_to_product_response(raw_data, "1234567890123")
        
        assert isinstance(result, ProductResponse)
        assert result.name == "Test Product"
        assert result.brand == "Test Brand"
        assert result.barcode == "1234567890123"
        assert result.source == "OpenFoodFacts"
        assert result.serving_size == "100g"
        
        # Check nutriments
        assert result.nutriments.energy_kcal_per_100g == 250.0
        assert result.nutriments.protein_g_per_100g == 12.0
        assert result.nutriments.fat_g_per_100g == 8.0
        assert result.nutriments.carbs_g_per_100g == 35.0
        assert result.nutriments.sugars_g_per_100g == 18.0
        assert result.nutriments.salt_g_per_100g == 0.8
        
        assert isinstance(result.fetched_at, datetime)


class TestConvenienceFunction:
    """Test the module-level convenience function"""
    
    @patch('app.services.barcode_lookup.barcode_service.lookup_by_barcode')
    async def test_lookup_by_barcode_function(self, mock_service_lookup):
        """Test the convenience lookup function"""
        mock_product = ProductResponse(
            source="OpenFoodFacts",
            barcode="1234567890123",
            name="Test Product",
            brand=None,
            image_url=None,
            serving_size=None,
            nutriments=Nutriments(
                energy_kcal_per_100g=200.0,
                protein_g_per_100g=10.0,
                fat_g_per_100g=5.0,
                carbs_g_per_100g=30.0,
                sugars_g_per_100g=15.0,
                salt_g_per_100g=0.5
            ),
            fetched_at=datetime.now()
        )
        mock_service_lookup.return_value = mock_product
        
        result = await lookup_by_barcode("1234567890123")
        
        assert result == mock_product
        mock_service_lookup.assert_called_once_with("1234567890123")


@pytest.fixture
async def barcode_service_fixture():
    """Fixture providing barcode service instance"""
    service = BarcodeService()
    yield service
    await service.close()
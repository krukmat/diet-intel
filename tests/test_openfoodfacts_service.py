import pytest
import httpx
from datetime import datetime
from unittest.mock import AsyncMock, patch, Mock
from app.services.openfoodfacts import OpenFoodFactsService, openfoodfacts_service
from app.models.product import ProductResponse, Nutriments

pytestmark = pytest.mark.asyncio


class TestOpenFoodFactsService:
    """Test suite for OpenFoodFactsService"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.service = OpenFoodFactsService()
    
    async def test_service_initialization(self):
        """Test service initialization"""
        assert self.service.BASE_URL == "https://world.openfoodfacts.org/api/v0/product"
        assert self.service.TIMEOUT == 10.0
        assert isinstance(self.service.client, httpx.AsyncClient)
    
    async def test_singleton_instance(self):
        """Test global service instance"""
        assert isinstance(openfoodfacts_service, OpenFoodFactsService)


class TestProductLookup:
    """Test product lookup functionality"""
    
    def setup_method(self):
        self.service = OpenFoodFactsService()
    
    @patch('httpx.AsyncClient.get')
    async def test_successful_product_lookup(self, mock_get):
        """Test successful product lookup with complete data"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Organic Greek Yogurt",
                "brands": "Chobani",
                "image_url": "https://example.com/yogurt.jpg",
                "serving_size": "150g",
                "nutriments": {
                    "energy-kcal_100g": 100.0,
                    "proteins_100g": 10.0,
                    "fat_100g": 4.0,
                    "carbohydrates_100g": 6.0,
                    "sugars_100g": 4.0,
                    "salt_100g": 0.1
                }
            }
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("1234567890123")
        
        # Verify API call
        mock_get.assert_called_once_with("https://world.openfoodfacts.org/api/v0/product/1234567890123.json")
        
        # Verify response structure
        assert isinstance(result, ProductResponse)
        assert result.source == "OpenFoodFacts"
        assert result.barcode == "1234567890123"
        assert result.name == "Organic Greek Yogurt"
        assert result.brand == "Chobani"
        assert result.image_url == "https://example.com/yogurt.jpg"
        assert result.serving_size == "150g"
        
        # Verify nutriments
        assert result.nutriments.energy_kcal_per_100g == 100.0
        assert result.nutriments.protein_g_per_100g == 10.0
        assert result.nutriments.fat_g_per_100g == 4.0
        assert result.nutriments.carbs_g_per_100g == 6.0
        assert result.nutriments.sugars_g_per_100g == 4.0
        assert result.nutriments.salt_g_per_100g == 0.1
        
        # Verify timestamp
        assert isinstance(result.fetched_at, datetime)
    
    @patch('httpx.AsyncClient.get')
    async def test_product_lookup_minimal_data(self, mock_get):
        """Test product lookup with minimal data"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Simple Product",
                "nutriments": {
                    "energy-kcal_100g": 200.0
                }
            }
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("9876543210987")
        
        assert isinstance(result, ProductResponse)
        assert result.name == "Simple Product"
        assert result.brand is None
        assert result.image_url is None
        assert result.serving_size is None
        
        # Only energy should be set
        assert result.nutriments.energy_kcal_per_100g == 200.0
        assert result.nutriments.protein_g_per_100g is None
        assert result.nutriments.fat_g_per_100g is None
    
    @patch('httpx.AsyncClient.get')
    async def test_product_not_found(self, mock_get):
        """Test handling of product not found"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 0,
            "status_verbose": "product not found"
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("0000000000000")
        
        assert result is None
    
    @patch('httpx.AsyncClient.get')
    async def test_api_http_error_status(self, mock_get):
        """Test handling of HTTP error status codes"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("invalid")
        
        assert result is None
    
    @patch('httpx.AsyncClient.get')
    async def test_api_server_error(self, mock_get):
        """Test handling of server errors"""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("1234567890123")
        
        assert result is None


class TestNetworkErrorHandling:
    """Test network error handling scenarios"""
    
    def setup_method(self):
        self.service = OpenFoodFactsService()
    
    @patch('httpx.AsyncClient.get')
    async def test_timeout_exception(self, mock_get):
        """Test handling of timeout exceptions"""
        mock_get.side_effect = httpx.TimeoutException("Request timeout")
        
        with pytest.raises(httpx.TimeoutException):
            await self.service.get_product("1234567890123")
    
    @patch('httpx.AsyncClient.get')
    async def test_request_exception(self, mock_get):
        """Test handling of general request exceptions"""
        mock_get.side_effect = httpx.RequestError("Network error")
        
        with pytest.raises(httpx.RequestError):
            await self.service.get_product("1234567890123")
    
    @patch('httpx.AsyncClient.get')
    async def test_connection_error(self, mock_get):
        """Test handling of connection errors"""
        mock_get.side_effect = httpx.ConnectError("Connection failed")
        
        with pytest.raises(httpx.RequestError):
            await self.service.get_product("1234567890123")


class TestDataProcessing:
    """Test data processing and mapping functionality"""
    
    def setup_method(self):
        self.service = OpenFoodFactsService()
    
    def test_safe_float_conversion(self):
        """Test safe float conversion utility"""
        # Valid conversions
        assert self.service._safe_float("10.5") == 10.5
        assert self.service._safe_float(20) == 20.0
        assert self.service._safe_float(30.7) == 30.7
        
        # Invalid conversions should return None
        assert self.service._safe_float(None) is None
        assert self.service._safe_float("") is None
        assert self.service._safe_float("invalid") is None
        assert self.service._safe_float([1, 2, 3]) is None
    
    @patch('httpx.AsyncClient.get')
    async def test_nutriments_with_invalid_values(self, mock_get):
        """Test handling of invalid nutriment values"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Test Product",
                "nutriments": {
                    "energy-kcal_100g": "invalid",
                    "proteins_100g": None,
                    "fat_100g": "",
                    "carbohydrates_100g": 25.0,
                    "sugars_100g": "12.5",
                    "salt_100g": []
                }
            }
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("1234567890123")
        
        assert result.nutriments.energy_kcal_per_100g is None
        assert result.nutriments.protein_g_per_100g is None
        assert result.nutriments.fat_g_per_100g is None
        assert result.nutriments.carbs_g_per_100g == 25.0
        assert result.nutriments.sugars_g_per_100g == 12.5
        assert result.nutriments.salt_g_per_100g is None
    
    @patch('httpx.AsyncClient.get')
    async def test_empty_nutriments_section(self, mock_get):
        """Test handling of empty nutriments section"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Empty Nutrients",
                "nutriments": {}
            }
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("1234567890123")
        
        # All nutriment values should be None
        assert result.nutriments.energy_kcal_per_100g is None
        assert result.nutriments.protein_g_per_100g is None
        assert result.nutriments.fat_g_per_100g is None
        assert result.nutriments.carbs_g_per_100g is None
        assert result.nutriments.sugars_g_per_100g is None
        assert result.nutriments.salt_g_per_100g is None
    
    @patch('httpx.AsyncClient.get')
    async def test_missing_nutriments_section(self, mock_get):
        """Test handling of completely missing nutriments section"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "No Nutrients"
            }
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("1234567890123")
        
        # All nutriment values should be None
        assert result.nutriments.energy_kcal_per_100g is None
        assert result.nutriments.protein_g_per_100g is None


class TestServiceLifecycle:
    """Test service lifecycle management"""
    
    def setup_method(self):
        self.service = OpenFoodFactsService()
    
    @patch('httpx.AsyncClient.aclose')
    async def test_service_cleanup(self, mock_aclose):
        """Test proper service cleanup"""
        await self.service.close()
        mock_aclose.assert_called_once()


class TestRealWorldScenarios:
    """Test scenarios based on real OpenFoodFacts responses"""
    
    def setup_method(self):
        self.service = OpenFoodFactsService()
    
    @patch('httpx.AsyncClient.get')
    async def test_coca_cola_response_structure(self, mock_get):
        """Test handling of typical Coca Cola product response"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Coca-Cola",
                "brands": "Coca-Cola",
                "image_url": "https://static.openfoodfacts.org/images/products/541/250/000/0000/front_en.4.400.jpg",
                "serving_size": "330 ml",
                "nutriments": {
                    "energy-kcal_100g": 42.0,
                    "proteins_100g": 0.0,
                    "fat_100g": 0.0,
                    "carbohydrates_100g": 10.6,
                    "sugars_100g": 10.6,
                    "salt_100g": 0.0
                }
            }
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("5412500000000")
        
        assert result.name == "Coca-Cola"
        assert result.brand == "Coca-Cola"
        assert result.serving_size == "330 ml"
        assert result.nutriments.energy_kcal_per_100g == 42.0
        assert result.nutriments.sugars_g_per_100g == 10.6
        assert result.nutriments.salt_g_per_100g == 0.0
    
    @patch('httpx.AsyncClient.get')
    async def test_complex_product_with_missing_fields(self, mock_get):
        """Test handling of complex product with some missing fields"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Artisan Bread",
                "brands": "",  # Empty string
                "serving_size": "1 slice (30g)",
                "nutriments": {
                    "energy-kcal_100g": 265.0,
                    "proteins_100g": 9.0,
                    "fat_100g": 1.2,
                    "carbohydrates_100g": 49.0
                    # Missing sugars and salt
                }
            }
        }
        mock_get.return_value = mock_response
        
        result = await self.service.get_product("1234567890123")
        
        assert result.name == "Artisan Bread"
        assert result.brand == ""  # Empty string preserved
        assert result.serving_size == "1 slice (30g)"
        assert result.nutriments.energy_kcal_per_100g == 265.0
        assert result.nutriments.sugars_g_per_100g is None
        assert result.nutriments.salt_g_per_100g is None


class TestPerformanceAndLogging:
    """Test performance monitoring and logging"""
    
    def setup_method(self):
        self.service = OpenFoodFactsService()
    
    @patch('httpx.AsyncClient.get')
    @patch('app.services.openfoodfacts.logger.info')
    async def test_latency_logging(self, mock_logger, mock_get):
        """Test that API latency is properly logged"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": 1,
            "product": {
                "product_name": "Test Product",
                "nutriments": {"energy-kcal_100g": 100.0}
            }
        }
        mock_get.return_value = mock_response
        
        await self.service.get_product("1234567890123")
        
        # Verify latency logging occurred
        mock_logger.assert_called()
        log_call_args = mock_logger.call_args[0][0]
        assert "OpenFoodFacts API call latency" in log_call_args
        assert "1234567890123" in log_call_args
    
    @patch('httpx.AsyncClient.get')
    @patch('app.services.openfoodfacts.logger.info')
    async def test_product_not_found_logging(self, mock_logger, mock_get):
        """Test logging when product is not found"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": 0}
        mock_get.return_value = mock_response
        
        await self.service.get_product("0000000000000")
        
        # Should log product not found
        mock_logger.assert_any_call("Product not found in OpenFoodFacts: 0000000000000")
    
    @patch('httpx.AsyncClient.get')
    @patch('app.services.openfoodfacts.logger.warning')
    async def test_http_error_logging(self, mock_logger, mock_get):
        """Test logging of HTTP errors"""
        mock_response = Mock()
        mock_response.status_code = 429  # Rate limited
        mock_get.return_value = mock_response
        
        await self.service.get_product("1234567890123")
        
        # Should log HTTP error
        mock_logger.assert_called_once()
        log_call_args = mock_logger.call_args[0][0]
        assert "OpenFoodFacts API returned status 429" in log_call_args


@pytest.fixture
async def openfoodfacts_service_fixture():
    """Fixture providing OpenFoodFacts service instance"""
    service = OpenFoodFactsService()
    yield service
    await service.close()
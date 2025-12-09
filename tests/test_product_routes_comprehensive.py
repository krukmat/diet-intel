import pytest
import tempfile
import os
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from typing import Dict, Any, Optional

# Mock FastAPI dependencies to avoid import issues
class MockHTTPException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"{status_code}: {detail}")

class MockUploadFile:
    def __init__(self, filename: str = "test.jpg", content_type: str = "image/jpeg", 
                 size: Optional[int] = None, content: bytes = b"fake image data"):
        self.filename = filename
        self.content_type = content_type
        self.size = size
        self._content = content
    
    async def read(self) -> bytes:
        return self._content

# Mock the FastAPI components
@pytest.fixture(autouse=True)
def mock_fastapi():
    with patch.dict('sys.modules', {
        'fastapi': Mock(),
        'fastapi.status': Mock(),
        'aiofiles': Mock(),
        'httpx': Mock(),
    }):
        # Mock status codes
        import sys
        status_mock = Mock()
        status_mock.HTTP_400_BAD_REQUEST = 400
        status_mock.HTTP_404_NOT_FOUND = 404
        status_mock.HTTP_408_REQUEST_TIMEOUT = 408
        status_mock.HTTP_413_REQUEST_ENTITY_TOO_LARGE = 413
        status_mock.HTTP_500_INTERNAL_SERVER_ERROR = 500
        status_mock.HTTP_503_SERVICE_UNAVAILABLE = 503
        sys.modules['fastapi'].status = status_mock
        
        # Mock HTTPException
        sys.modules['fastapi'].HTTPException = MockHTTPException
        
        yield

pytestmark = pytest.mark.asyncio

# Import after mocking
with patch.dict('sys.modules', {
    'fastapi': Mock(),
    'fastapi.status': Mock(), 
    'aiofiles': Mock(),
    'httpx': Mock(),
}):
    from app.models.product import (
        BarcodeRequest, ProductResponse, ErrorResponse,
        ScanResponse, LowConfidenceScanResponse, Nutriments
    )


class TestBarcodeRouteLogic:
    """Test the barcode lookup route logic"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.sample_product_response = ProductResponse(
            source="OpenFoodFacts",
            barcode="1234567890123",
            name="Test Product",
            brand="Test Brand",
            image_url="https://example.com/image.jpg",
            serving_size="100g",
            nutriments=Nutriments(
                energy_kcal_per_100g=250.0,
                protein_g_per_100g=10.0,
                fat_g_per_100g=5.0,
                carbs_g_per_100g=40.0,
                sugars_g_per_100g=15.0,
                salt_g_per_100g=1.2
            ),
            fetched_at=datetime.now()
        )
    
    @patch('app.services.openfoodfacts.openfoodfacts_service.get_product')
    @patch('app.services.cache.cache_service.get')
    @patch('app.services.cache.cache_service.set')
    async def test_barcode_route_cache_hit(self, mock_cache_set, mock_cache_get, mock_openfoodfacts):
        """Test barcode route with cache hit"""
        # Mock cache hit
        mock_cache_get.return_value = self.sample_product_response.model_dump()
        
        # Import and test the route logic
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="1234567890123")
        result = await get_product_by_barcode(request)
        
        assert isinstance(result, ProductResponse)
        assert result.barcode == "1234567890123"
        assert result.name == "Test Product"
        
        # Verify cache was checked but OpenFoodFacts was not called
        mock_cache_get.assert_called_once_with("product:1234567890123")
        mock_openfoodfacts.assert_not_called()
        mock_cache_set.assert_not_called()
    
    @patch('app.services.openfoodfacts.openfoodfacts_service.get_product')
    @patch('app.services.cache.cache_service.get')
    @patch('app.services.cache.cache_service.set')
    async def test_barcode_route_cache_miss_api_success(self, mock_cache_set, mock_cache_get, mock_openfoodfacts):
        """Test barcode route with cache miss and successful API fetch"""
        # Mock cache miss
        mock_cache_get.return_value = None
        
        # Mock successful API response
        mock_openfoodfacts.return_value = self.sample_product_response
        
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="1234567890123")
        result = await get_product_by_barcode(request)
        
        assert isinstance(result, ProductResponse)
        assert result.barcode == "1234567890123"
        assert result.name == "Test Product"
        
        # Verify cache miss, API call, and caching
        mock_cache_get.assert_called_once_with("product:1234567890123")
        mock_openfoodfacts.assert_called_once_with("1234567890123")
        mock_cache_set.assert_called_once()
    
    @patch('app.services.openfoodfacts.openfoodfacts_service.get_product')
    @patch('app.services.cache.cache_service.get')
    async def test_barcode_route_product_not_found(self, mock_cache_get, mock_openfoodfacts):
        """Test barcode route when product is not found"""
        # Mock cache miss
        mock_cache_get.return_value = None
        
        # Mock API returns None (product not found)
        mock_openfoodfacts.return_value = None
        
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="0000000000000")
        
        with pytest.raises(MockHTTPException) as exc_info:
            await get_product_by_barcode(request)
        
        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail
    
    @patch('app.services.openfoodfacts.openfoodfacts_service.get_product')
    @patch('app.services.cache.cache_service.get')
    async def test_barcode_route_timeout_error(self, mock_cache_get, mock_openfoodfacts):
        """Test barcode route with timeout error"""
        mock_cache_get.return_value = None
        
        # Mock timeout exception
        import sys
        httpx_mock = Mock()
        httpx_mock.TimeoutException = Exception  # Simple exception for testing
        sys.modules['httpx'] = httpx_mock
        
        mock_openfoodfacts.side_effect = httpx_mock.TimeoutException("Timeout")
        
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="1234567890123")
        
        with pytest.raises(MockHTTPException) as exc_info:
            await get_product_by_barcode(request)
        
        assert exc_info.value.status_code == 408
        assert "timeout" in exc_info.value.detail.lower()
    
    @patch('app.services.openfoodfacts.openfoodfacts_service.get_product')
    @patch('app.services.cache.cache_service.get')
    async def test_barcode_route_network_error(self, mock_cache_get, mock_openfoodfacts):
        """Test barcode route with network error"""
        mock_cache_get.return_value = None
        
        # Mock network error
        import sys
        httpx_mock = Mock()
        httpx_mock.RequestError = Exception
        sys.modules['httpx'] = httpx_mock
        
        mock_openfoodfacts.side_effect = httpx_mock.RequestError("Network error")
        
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="1234567890123")
        
        with pytest.raises(MockHTTPException) as exc_info:
            await get_product_by_barcode(request)
        
        assert exc_info.value.status_code == 503
        assert "connect" in exc_info.value.detail.lower()
    
    async def test_barcode_route_empty_barcode(self):
        """Test barcode route with empty barcode"""
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="")
        
        with pytest.raises(MockHTTPException) as exc_info:
            await get_product_by_barcode(request)
        
        assert exc_info.value.status_code == 400
        assert "empty" in exc_info.value.detail.lower()
    
    async def test_barcode_route_whitespace_barcode(self):
        """Test barcode route with whitespace-only barcode"""
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="   ")
        
        with pytest.raises(MockHTTPException) as exc_info:
            await get_product_by_barcode(request)
        
        assert exc_info.value.status_code == 400
        assert "empty" in exc_info.value.detail.lower()


class TestScanLabelRouteLogic:
    """Test the nutrition label scanning route logic"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.valid_image = MockUploadFile(
            filename="nutrition_label.jpg",
            content_type="image/jpeg",
            size=1024 * 1024,  # 1MB
            content=b"fake image data"
        )
        
        self.high_confidence_nutrition = {
            'nutrition_data': {
                'energy_kcal': 300.0,
                'protein_g': 15.0,
                'fat_g': 8.0,
                'carbs_g': 45.0,
                'sugars_g': 20.0,
                'salt_g': 1.5
            },
            'serving_size': '100g',
            'confidence': 0.85
        }
        
        self.low_confidence_nutrition = {
            'nutrition_data': {
                'energy_kcal': 250.0,
                'protein_g': None,  # Missing data
                'fat_g': 6.0,
                'carbs_g': None,
                'sugars_g': 12.0,
                'salt_g': 0.8
            },
            'serving_size': '100g',
            'confidence': 0.45
        }
    
    async def test_scan_label_invalid_content_type(self):
        """Test scan label with invalid content type"""
        invalid_image = MockUploadFile(
            filename="document.pdf",
            content_type="application/pdf"
        )
        
        from app.routes.product import scan_nutrition_label
        
        with pytest.raises(MockHTTPException) as exc_info:
            await scan_nutrition_label(invalid_image)
        
        assert exc_info.value.status_code == 400
        assert "image" in exc_info.value.detail.lower()
    
    async def test_scan_label_file_too_large(self):
        """Test scan label with file too large"""
        large_image = MockUploadFile(
            filename="large_image.jpg",
            content_type="image/jpeg",
            size=15 * 1024 * 1024  # 15MB (over 10MB limit)
        )
        
        from app.routes.product import scan_nutrition_label
        
        with pytest.raises(MockHTTPException) as exc_info:
            await scan_nutrition_label(large_image)
        
        assert exc_info.value.status_code == 413
        assert "large" in exc_info.value.detail.lower()
    
    @patch('app.services.ocr.ocr_service.extract_text')
    @patch('app.services.ocr.nutrition_parser.parse_nutrition_text')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    async def test_scan_label_high_confidence_success(self, mock_unlink, mock_tempfile, 
                                                     mock_parse, mock_extract):
        """Test scan label with high confidence OCR result"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock OCR results
        mock_extract.return_value = "Nutrition Facts: Energy 300kcal, Protein 15g..."
        mock_parse.return_value = self.high_confidence_nutrition
        
        # Mock aiofiles
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_nutrition_label
            
            result = await scan_nutrition_label(self.valid_image)
        
        # Verify high confidence response
        assert isinstance(result, ScanResponse)
        assert result.source == "Local OCR"
        assert result.confidence == 0.85
        assert result.serving_size == "100g"
        assert result.nutriments.energy_kcal_per_100g == 300.0
        assert result.nutriments.protein_g_per_100g == 15.0
        
        # Verify cleanup
        mock_unlink.assert_called_once_with("/tmp/test_image.jpg")
    
    @patch('app.services.ocr.ocr_service.extract_text')
    @patch('app.services.ocr.nutrition_parser.parse_nutrition_text')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    async def test_scan_label_low_confidence_response(self, mock_unlink, mock_tempfile,
                                                     mock_parse, mock_extract):
        """Test scan label with low confidence OCR result"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock OCR results
        mock_extract.return_value = "Partial nutrition text..."
        mock_parse.return_value = self.low_confidence_nutrition
        
        # Mock aiofiles
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_nutrition_label
            
            result = await scan_nutrition_label(self.valid_image)
        
        # Verify low confidence response
        assert isinstance(result, LowConfidenceScanResponse)
        assert result.low_confidence is True
        assert result.confidence == 0.45
        assert result.suggest_external_ocr is True
        assert result.partial_parsed['energy_kcal'] == 250.0
        assert result.partial_parsed['protein_g'] is None
    
    @patch('app.services.ocr.ocr_service.extract_text')
    @patch('tempfile.NamedTemporaryFile')
    async def test_scan_label_no_text_extracted(self, mock_tempfile, mock_extract):
        """Test scan label when no text can be extracted"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock OCR returns empty text
        mock_extract.return_value = ""
        
        # Mock aiofiles
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_nutrition_label
            
            with pytest.raises(MockHTTPException) as exc_info:
                await scan_nutrition_label(self.valid_image)
        
        assert exc_info.value.status_code == 400
        assert "no text" in exc_info.value.detail.lower()
    
    @patch('app.services.ocr.ocr_service.extract_text')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    async def test_scan_label_processing_error(self, mock_unlink, mock_tempfile, mock_extract):
        """Test scan label with processing error"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock OCR raises exception
        mock_extract.side_effect = Exception("OCR processing failed")
        
        # Mock aiofiles
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_nutrition_label
            
            with pytest.raises(MockHTTPException) as exc_info:
                await scan_nutrition_label(self.valid_image)
        
        assert exc_info.value.status_code == 500
        assert "processing" in exc_info.value.detail.lower()
        
        # Verify cleanup still occurs
        mock_unlink.assert_called_once_with("/tmp/test_image.jpg")
    
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    @patch('os.path.exists')
    async def test_scan_label_cleanup_failure(self, mock_exists, mock_unlink, mock_tempfile):
        """Test scan label handles cleanup failure gracefully"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock file exists but unlink fails
        mock_exists.return_value = True
        mock_unlink.side_effect = OSError("Permission denied")
        
        # Force an exception to trigger cleanup
        mock_aiofiles = AsyncMock()
        mock_aiofiles.side_effect = Exception("Forced error for cleanup test")
        
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_nutrition_label
            
            with pytest.raises(MockHTTPException):
                await scan_nutrition_label(self.valid_image)
        
        # Verify cleanup was attempted despite failure
        mock_unlink.assert_called_once_with("/tmp/test_image.jpg")


class TestExternalScanLabelRouteLogic:
    """Test the external OCR scanning route logic"""
    
    def setup_method(self):
        self.valid_image = MockUploadFile(
            filename="nutrition_label.jpg",
            content_type="image/jpeg",
            content=b"fake image data"
        )
        
        self.nutrition_data = {
            'nutrition_data': {
                'energy_kcal': 280.0,
                'protein_g': 12.0,
                'fat_g': 7.0,
                'carbs_g': 42.0,
                'sugars_g': 18.0,
                'salt_g': 1.2
            },
            'serving_size': '100g',
            'confidence': 0.9
        }
    
    @patch('app.services.ocr.call_external_ocr')
    @patch('app.services.ocr.nutrition_parser.parse_nutrition_text')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    async def test_external_scan_success(self, mock_unlink, mock_tempfile, mock_parse, mock_external):
        """Test external scan with successful external OCR"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock external OCR success
        mock_external.return_value = "Nutrition Facts from external OCR..."
        mock_parse.return_value = self.nutrition_data
        
        # Mock aiofiles
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_label_with_external_ocr
            
            result = await scan_label_with_external_ocr(self.valid_image)
        
        # Verify external OCR was used
        assert isinstance(result, ScanResponse)
        assert result.source == "External OCR"
        assert result.confidence == 0.9
        assert result.nutriments.energy_kcal_per_100g == 280.0
        
        # Verify external OCR was called
        mock_external.assert_called_once_with("/tmp/test_image.jpg")
    
    @patch('app.services.ocr.call_external_ocr')
    @patch('app.services.ocr.ocr_service.extract_text')
    @patch('app.services.ocr.nutrition_parser.parse_nutrition_text')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    async def test_external_scan_fallback_to_local(self, mock_unlink, mock_tempfile, 
                                                  mock_parse, mock_local, mock_external):
        """Test external scan falling back to local OCR"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock external OCR failure/unavailable
        mock_external.return_value = None
        
        # Mock local OCR success
        mock_local.return_value = "Local OCR nutrition text..."
        mock_parse.return_value = self.nutrition_data
        
        # Mock aiofiles
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_label_with_external_ocr
            
            result = await scan_label_with_external_ocr(self.valid_image)
        
        # Verify fallback to local OCR
        assert isinstance(result, ScanResponse)
        assert result.source == "Local OCR (fallback)"
        assert result.confidence == 0.9
        
        # Verify both external and local OCR were called
        mock_external.assert_called_once_with("/tmp/test_image.jpg")
        mock_local.assert_called_once_with("/tmp/test_image.jpg")
    
    @patch('app.services.ocr.call_external_ocr')
    @patch('app.services.ocr.nutrition_parser.parse_nutrition_text')
    @patch('tempfile.NamedTemporaryFile')
    async def test_external_scan_low_confidence_no_external_suggestion(self, mock_tempfile, 
                                                                      mock_parse, mock_external):
        """Test external scan with low confidence after using external OCR"""
        # Mock temp file
        mock_temp = Mock()
        mock_temp.name = "/tmp/test_image.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock external OCR returns text but low confidence parsing
        mock_external.return_value = "Poor quality nutrition text..."
        low_confidence_data = {
            'nutrition_data': {'energy_kcal': 200.0},
            'serving_size': None,
            'confidence': 0.3
        }
        mock_parse.return_value = low_confidence_data
        
        # Mock aiofiles
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_label_with_external_ocr
            
            result = await scan_label_with_external_ocr(self.valid_image)
        
        # Verify low confidence response doesn't suggest external OCR
        # (since we already tried external)
        assert isinstance(result, LowConfidenceScanResponse)
        assert result.suggest_external_ocr is False  # We already used external
        assert result.confidence == 0.3
    
    async def test_external_scan_invalid_image(self):
        """Test external scan with invalid image file"""
        invalid_image = MockUploadFile(
            filename="document.txt",
            content_type="text/plain"
        )
        
        from app.routes.product import scan_label_with_external_ocr
        
        with pytest.raises(MockHTTPException) as exc_info:
            await scan_label_with_external_ocr(invalid_image)
        
        assert exc_info.value.status_code == 400
        assert "image" in exc_info.value.detail.lower()


class TestRouteValidationLogic:
    """Test input validation logic for routes"""
    
    async def test_barcode_request_validation(self):
        """Test BarcodeRequest validation"""
        # Valid barcode
        valid_request = BarcodeRequest(barcode="1234567890123")
        assert valid_request.barcode == "1234567890123"
        
        # Test that whitespace is handled by route logic, not model
        whitespace_request = BarcodeRequest(barcode="  1234567890123  ")
        assert whitespace_request.barcode == "  1234567890123  "
    
    def test_nutrition_scan_response_models(self):
        """Test scan response model construction"""
        # High confidence scan response
        nutriments = Nutriments(
            energy_kcal_per_100g=300.0,
            protein_g_per_100g=15.0,
            fat_g_per_100g=8.0,
            carbs_g_per_100g=45.0,
            sugars_g_per_100g=20.0,
            salt_g_per_100g=1.5
        )
        
        scan_response = ScanResponse(
            source="Local OCR",
            confidence=0.85,
            raw_text="Nutrition Facts...",
            serving_size="100g",
            nutriments=nutriments,
            scanned_at=datetime.now()
        )
        
        assert scan_response.source == "Local OCR"
        assert scan_response.confidence == 0.85
        assert scan_response.serving_size == "100g"
        assert scan_response.nutriments.energy_kcal_per_100g == 300.0
        
        # Low confidence scan response
        low_conf_response = LowConfidenceScanResponse(
            low_confidence=True,
            confidence=0.45,
            raw_text="Partial text...",
            partial_parsed={'energy_kcal': 250.0, 'protein_g': None},
            suggest_external_ocr=True,
            scanned_at=datetime.now()
        )
        
        assert low_conf_response.low_confidence is True
        assert low_conf_response.confidence == 0.45
        assert low_conf_response.suggest_external_ocr is True
        assert low_conf_response.partial_parsed['energy_kcal'] == 250.0
    
    def test_error_response_model(self):
        """Test error response model"""
        error = ErrorResponse(
            error="Product not found",
            detail="The specified barcode was not found in the database"
        )
        
        assert error.error == "Product not found"
        assert error.detail == "The specified barcode was not found in the database"


class TestRouteIntegrationScenarios:
    """Test realistic integration scenarios"""
    
    @patch('app.services.openfoodfacts.openfoodfacts_service.get_product')
    @patch('app.services.cache.cache_service.get')
    @patch('app.services.cache.cache_service.set')
    async def test_complete_barcode_workflow(self, mock_cache_set, mock_cache_get, mock_openfoodfacts):
        """Test complete barcode lookup workflow"""
        # Scenario: Cache miss -> API success -> Cache storage
        mock_cache_get.return_value = None
        
        api_product = ProductResponse(
            source="OpenFoodFacts",
            barcode="5901234123457",  # Example EAN-13
            name="Organic Granola",
            brand="Healthy Foods Co",
            image_url="https://example.com/granola.jpg",
            serving_size="50g",
            nutriments=Nutriments(
                energy_kcal_per_100g=450.0,
                protein_g_per_100g=12.0,
                fat_g_per_100g=18.0,
                carbs_g_per_100g=60.0,
                sugars_g_per_100g=8.0,
                salt_g_per_100g=0.3
            ),
            fetched_at=datetime.now()
        )
        mock_openfoodfacts.return_value = api_product
        mock_cache_set.return_value = None
        
        from app.routes.product import get_product_by_barcode
        
        request = BarcodeRequest(barcode="5901234123457")
        result = await get_product_by_barcode(request)
        
        # Verify complete workflow
        assert isinstance(result, ProductResponse)
        assert result.name == "Organic Granola"
        assert result.brand == "Healthy Foods Co"
        assert result.nutriments.energy_kcal_per_100g == 450.0
        
        # Verify service calls
        mock_cache_get.assert_called_once_with("product:5901234123457")
        mock_openfoodfacts.assert_called_once_with("5901234123457")
        mock_cache_set.assert_called_once()
        
        # Verify cache data
        cache_call_args = mock_cache_set.call_args
        cached_data = cache_call_args[0][1]  # Second argument
        assert cached_data['name'] == "Organic Granola"
        assert cache_call_args[1]['ttl_hours'] == 24  # TTL keyword argument
    
    @patch('app.services.ocr.ocr_service.extract_text')
    @patch('app.services.ocr.nutrition_parser.parse_nutrition_text')
    @patch('tempfile.NamedTemporaryFile')
    @patch('os.unlink')
    async def test_complete_scan_workflow_high_confidence(self, mock_unlink, mock_tempfile,
                                                         mock_parse, mock_extract):
        """Test complete scan workflow with high confidence result"""
        # Mock temp file handling
        mock_temp = Mock()
        mock_temp.name = "/tmp/nutrition_scan_12345.jpg"
        mock_tempfile.return_value = mock_temp
        
        # Mock OCR pipeline
        mock_extract.return_value = """
        NUTRITION FACTS
        Per 100g:
        Energy: 350 kcal
        Protein: 14g
        Fat: 9g
        Carbohydrates: 55g
        Sugars: 12g
        Salt: 0.8g
        """
        
        mock_parse.return_value = {
            'nutrition_data': {
                'energy_kcal': 350.0,
                'protein_g': 14.0,
                'fat_g': 9.0,
                'carbs_g': 55.0,
                'sugars_g': 12.0,
                'salt_g': 0.8
            },
            'serving_size': '100g',
            'confidence': 0.92
        }
        
        # Mock file operations
        mock_aiofiles = AsyncMock()
        with patch('aiofiles.open', mock_aiofiles):
            from app.routes.product import scan_nutrition_label
            
            image = MockUploadFile(
                filename="cereal_label.jpg",
                content_type="image/jpeg",
                size=2 * 1024 * 1024,  # 2MB
                content=b"actual image bytes would be here"
            )
            
            result = await scan_nutrition_label(image)
        
        # Verify complete scan workflow
        assert isinstance(result, ScanResponse)
        assert result.source == "Local OCR"
        assert result.confidence == 0.92
        assert result.serving_size == "100g"
        
        # Verify nutriment extraction
        assert result.nutriments.energy_kcal_per_100g == 350.0
        assert result.nutriments.protein_g_per_100g == 14.0
        assert result.nutriments.fat_g_per_100g == 9.0
        assert result.nutriments.carbs_g_per_100g == 55.0
        assert result.nutriments.sugars_g_per_100g == 12.0
        assert result.nutriments.salt_g_per_100g == 0.8
        
        # Verify timestamp
        assert isinstance(result.scanned_at, datetime)
        
        # Verify cleanup
        mock_unlink.assert_called_once_with("/tmp/nutrition_scan_12345.jpg")


@pytest.fixture
def sample_nutrition_image():
    """Fixture for sample nutrition label image"""
    return MockUploadFile(
        filename="nutrition_facts.jpg",
        content_type="image/jpeg",
        size=1024 * 1024,  # 1MB
        content=b"mock image data representing nutrition label"
    )
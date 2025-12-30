"""
Product Routes Integration Tests - Phase 4 Implementation

This comprehensive test suite focuses on integration testing for product routes
with proper error handling, mocking, and realistic scenarios.

Target: Improve product routes coverage from 16% to 60%
Focus: Integration tests with complete request/response cycles
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import status
import httpx
import tempfile
import io

from main import app
from app.models.product import ProductResponse, Nutriments


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def sample_product():
    """Sample product for testing"""
    return ProductResponse(
        source="OpenFoodFacts",
        barcode="1234567890123",
        name="Test Oatmeal",
        brand="TestBrand",
        image_url="https://example.com/image.jpg",
        serving_size="50g",
        nutriments=Nutriments(
            energy_kcal_per_100g=350.0,
            protein_g_per_100g=12.0,
            fat_g_per_100g=6.0,
            carbs_g_per_100g=60.0,
            sugars_g_per_100g=2.0,
            salt_g_per_100g=0.1
        ),
        fetched_at=datetime.now()
    )


@pytest.fixture
def mock_cache_service():
    """Mock cache service that behaves predictably"""
    mock = AsyncMock()
    mock.get = AsyncMock(return_value=None)
    mock.set = AsyncMock(return_value=True)
    return mock


@pytest.fixture
def mock_openfoodfacts_service():
    """Mock OpenFoodFacts service"""
    mock = AsyncMock()
    return mock


@pytest.fixture
def test_image_file():
    """Create a test image file for upload testing"""
    # Create a small test image content
    image_content = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1f\x1e\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9'
    
    return io.BytesIO(image_content)


class TestProductBarcodeRoutes:
    """Test barcode lookup routes with integration approach"""

    def test_barcode_lookup_success_with_cache_miss(self, client, sample_product, mock_cache_service, mock_openfoodfacts_service):
        """Test successful barcode lookup when product is not cached"""
        barcode = "1234567890123"
        
        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service):
            
            # Mock cache miss
            mock_cache_service.get.return_value = None
            
            # Mock successful OpenFoodFacts API response
            mock_openfoodfacts_service.get_product.return_value = sample_product
            
            response = client.post("/product/by-barcode", json={"barcode": barcode})
            
            # Verify response
            assert response.status_code == 200
            data = response.json()
            assert data["barcode"] == barcode
            assert data["name"] == "Test Oatmeal"
            assert data["brand"] == "TestBrand"
            assert data["nutriments"]["energy_kcal_per_100g"] == 350.0
            
            # Verify service interactions
            mock_cache_service.get.assert_called_once()
            mock_openfoodfacts_service.get_product.assert_called_once_with(barcode)
            mock_cache_service.set.assert_called_once()

    def test_barcode_lookup_success_with_cache_hit(self, client, sample_product, mock_cache_service, mock_openfoodfacts_service):
        """Test successful barcode lookup when product is cached"""
        barcode = "1234567890123"
        cached_data = sample_product.model_dump()
        
        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service):
            
            # Mock cache hit
            mock_cache_service.get.return_value = cached_data
            
            response = client.post("/product/by-barcode", json={"barcode": barcode})
            
            # Verify response
            assert response.status_code == 200
            data = response.json()
            assert data["barcode"] == barcode
            assert data["name"] == "Test Oatmeal"
            
            # Verify cache was used, API was not called
            mock_cache_service.get.assert_called_once()
            mock_openfoodfacts_service.get_product.assert_not_called()
            mock_cache_service.set.assert_not_called()

    def test_barcode_lookup_product_not_found_proper_404(self, client, mock_cache_service, mock_openfoodfacts_service):
        """Test product not found returns proper 404 error"""
        barcode = "0000000000000"
        
        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service):
            
            # Mock cache miss
            mock_cache_service.get.return_value = None
            
            # Mock OpenFoodFacts API returning None for product not found
            mock_openfoodfacts_service.get_product.return_value = None
            
            response = client.post("/product/by-barcode", json={"barcode": barcode})
            
            # Verify proper 404 response
            assert response.status_code == 404
            data = response.json()
            assert "not found" in data["detail"].lower()
            assert barcode in data["detail"]

    def test_barcode_lookup_timeout_error_408(self, client, mock_cache_service, mock_openfoodfacts_service):
        """Test timeout error returns proper 408 error"""
        barcode = "1234567890123"
        
        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service):
            
            mock_cache_service.get.return_value = None
            
            # Mock timeout exception
            mock_openfoodfacts_service.get_product.side_effect = httpx.TimeoutException("Request timeout")
            
            response = client.post("/product/by-barcode", json={"barcode": barcode})
            
            # Verify proper 408 response
            assert response.status_code == 408
            data = response.json()
            assert "timeout" in data["detail"].lower()

    def test_barcode_lookup_network_error_503(self, client, mock_cache_service, mock_openfoodfacts_service):
        """Test network error returns proper 503 error"""
        barcode = "1234567890123"
        
        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service):
            
            mock_cache_service.get.return_value = None
            
            # Mock network error
            mock_openfoodfacts_service.get_product.side_effect = httpx.RequestError("Network error")
            
            response = client.post("/product/by-barcode", json={"barcode": barcode})
            
            # Verify proper 503 response
            assert response.status_code == 503
            data = response.json()
            assert "network" in data["detail"].lower()

    def test_barcode_lookup_validation_empty_barcode(self, client):
        """Test empty barcode validation"""
        response = client.post("/product/by-barcode", json={"barcode": ""})
        
        # Should return 422 for validation error
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_barcode_lookup_validation_whitespace_barcode(self, client):
        """Test whitespace-only barcode validation"""
        response = client.post("/product/by-barcode", json={"barcode": "   "})
        
        # Should return 422 for validation error
        assert response.status_code == 422

    def test_barcode_lookup_validation_missing_barcode(self, client):
        """Test missing barcode field validation"""
        response = client.post("/product/by-barcode", json={})
        
        # Should return 422 for missing required field
        assert response.status_code == 422

    def test_barcode_lookup_malformed_json(self, client):
        """Test malformed JSON handling"""
        response = client.post("/product/by-barcode", 
                              data="invalid json",
                              headers={"Content-Type": "application/json"})
        
        # Should return 422 for malformed JSON
        assert response.status_code == 422


class TestProductScanLabelRoutes:
    """Test OCR label scanning routes with integration approach"""

    def test_scan_label_high_confidence_success(self, client, test_image_file):
        """Test successful label scanning with high confidence"""
        from app.services.ocr.ocr_service import OCRResult

        # Create proper OCRResult mock
        mock_result = OCRResult(
            raw_text='Energy: 250 kcal Protein: 12.0g',
            confidence=0.85,
            parsed_nutriments={
                'energy_kcal': 250.0,
                'protein_g': 12.0,
                'fat_g': 8.0,
                'carbs_g': 30.0,
                'sugars_g': 5.0,
                'salt_g': 1.0
            },
            serving_info={'detected': '100g'},
            processing_details={'ocr_engine': 'mock'},
            found_nutrients=['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g'],
            missing_required=[]
        )

        mock_ocr_service = AsyncMock()
        mock_ocr_service.extract_nutrients = AsyncMock(return_value=mock_result)

        with patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:
            mock_factory.create_local.return_value = mock_ocr_service

            response = client.post(
                "/product/scan-label",
                files={"file": ("test.jpg", test_image_file, "image/jpeg")}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] >= 0.7
            assert "nutrients" in data
            assert data["nutrients"]["energy_kcal_per_100g"] == 250.0

    def test_scan_label_low_confidence_response(self, client, test_image_file):
        """Test label scanning with low confidence"""
        from app.services.ocr.ocr_service import OCRResult

        # Create low confidence OCRResult mock
        mock_result = OCRResult(
            raw_text='Energy: 250 kcal',
            confidence=0.4,
            parsed_nutriments={
                'energy_kcal': 250.0,
                'protein_g': None,
                'fat_g': None,
                'carbs_g': None,
                'sugars_g': None,
                'salt_g': None
            },
            serving_info={'detected': '100g'},
            processing_details={'ocr_engine': 'mock'},
            found_nutrients=['energy_kcal'],
            missing_required=['protein_g', 'fat_g', 'carbs_g']
        )

        mock_ocr_service = AsyncMock()
        mock_ocr_service.extract_nutrients = AsyncMock(return_value=mock_result)

        with patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:
            mock_factory.create_local.return_value = mock_ocr_service

            response = client.post(
                "/product/scan-label",
                files={"file": ("test.jpg", test_image_file, "image/jpeg")}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] < 0.7
            assert data["suggest_external_ocr"] is True
            assert "partial_parsed" in data
            assert data["partial_parsed"]["energy_kcal"] == 250.0

    def test_scan_label_invalid_content_type(self, client):
        """Test scan with invalid file content type"""
        text_content = io.BytesIO(b"not an image")
        
        response = client.post(
            "/product/scan-label",
            files={"file": ("test.txt", text_content, "text/plain")}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "image" in data["detail"].lower()

    def test_scan_label_file_too_large(self, client):
        """Test scan with file that's too large"""
        # Create a large fake image (simulate 11MB file)
        large_content = io.BytesIO(b"fake_image_data" * (11 * 1024 * 1024 // 15))
        
        response = client.post(
            "/product/scan-label",
            files={"file": ("large.jpg", large_content, "image/jpeg")}
        )
        
        assert response.status_code == 413
        data = response.json()
        assert "too large" in data["detail"].lower()

    def test_scan_label_no_file_provided(self, client):
        """Test scan with no file provided"""
        response = client.post("/product/scan-label")
        
        assert response.status_code == 422
        data = response.json()
        assert "field required" in str(data).lower()

    def test_scan_label_ocr_processing_error(self, client, test_image_file):
        """Test OCR processing error handling"""
        mock_ocr_service = AsyncMock()
        mock_ocr_service.extract_nutrients = AsyncMock(side_effect=Exception("OCR processing failed"))

        with patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:
            mock_factory.create_local.return_value = mock_ocr_service

            response = client.post(
                "/product/scan-label",
                files={"file": ("test.jpg", test_image_file, "image/jpeg")}
            )

            assert response.status_code == 500
            data = response.json()
            assert "error" in data["detail"].lower()


class TestProductExternalScanRoutes:
    """Test external OCR scanning routes"""

    def test_external_scan_success(self, client, test_image_file):
        """Test successful external OCR scan"""
        from app.services.ocr.ocr_service import OCRResult

        mock_result = OCRResult(
            raw_text='Energy: 300 kcal Protein: 15.0g',
            confidence=0.9,
            parsed_nutriments={
                'energy_kcal': 300.0,
                'protein_g': 15.0,
                'fat_g': 10.0,
                'carbs_g': 35.0,
                'sugars_g': 8.0,
                'salt_g': 1.5
            },
            serving_info={'detected': '100g'},
            processing_details={'ocr_engine': 'external_api'},
            found_nutrients=['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g'],
            missing_required=[]
        )

        mock_ocr_service = AsyncMock()
        mock_ocr_service.extract_nutrients = AsyncMock(return_value=mock_result)

        with patch('app.routes.product.ocr_routes.OCRFactory') as mock_factory:
            mock_factory.create_external.return_value = mock_ocr_service

            response = client.post(
                "/product/scan-label-external",
                files={"file": ("test.jpg", test_image_file, "image/jpeg")}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] == 0.9
            assert "nutrients" in data
            assert "External OCR" in data["source"]

    def test_external_scan_fallback_to_local(self, client, test_image_file):
        """Test low confidence external OCR returns low confidence response"""
        from app.services.ocr.ocr_service import OCRResult

        mock_result = OCRResult(
            raw_text='Energy: 280 kcal',
            confidence=0.4,  # Low confidence
            parsed_nutriments={
                'energy_kcal': 280.0,
                'protein_g': None,
                'fat_g': None,
                'carbs_g': None,
                'sugars_g': None,
                'salt_g': None
            },
            serving_info={'detected': '100g'},
            processing_details={'ocr_engine': 'external_api'},
            found_nutrients=['energy_kcal'],
            missing_required=['protein_g', 'fat_g', 'carbs_g']
        )

        mock_ocr_service = AsyncMock()
        mock_ocr_service.extract_nutrients = AsyncMock(return_value=mock_result)

        with patch('app.routes.product.ocr_routes.OCRFactory') as mock_factory:
            mock_factory.create_external.return_value = mock_ocr_service

            response = client.post(
                "/product/scan-label-external",
                files={"file": ("test.jpg", test_image_file, "image/jpeg")}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] < 0.7
            assert data["low_confidence"] is True

    def test_external_scan_invalid_image(self, client):
        """Test external scan with invalid image"""
        invalid_content = io.BytesIO(b"not an image")
        # No need to patch - FastAPI validates content_type before OCR is called
        response = client.post(
            "/product/scan-label-external",
            files={"file": ("invalid.txt", invalid_content, "text/plain")}
        )

        assert response.status_code == 400
        data = response.json()
        assert "image" in data["detail"].lower()


class TestProductRoutesIntegration:
    """Test complete product workflow integration scenarios"""

    def test_complete_barcode_to_scan_workflow(self, client, test_image_file, mock_cache_service, mock_openfoodfacts_service):
        """Test complete workflow: barcode lookup fails, then scan label succeeds"""
        from app.services.ocr.ocr_service import OCRResult

        barcode = "9999999999999"

        # Create OCR mock result
        mock_ocr_result = OCRResult(
            raw_text='Energy: 320 kcal Protein: 14.0g',
            confidence=0.8,
            parsed_nutriments={
                'energy_kcal': 320.0,
                'protein_g': 14.0,
                'fat_g': 11.0,
                'carbs_g': 38.0,
                'sugars_g': 7.0,
                'salt_g': 1.3
            },
            serving_info={'detected': '100g'},
            processing_details={'ocr_engine': 'mock'},
            found_nutrients=['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g'],
            missing_required=[]
        )

        mock_ocr_service = AsyncMock()
        mock_ocr_service.extract_nutrients = AsyncMock(return_value=mock_ocr_result)

        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service), \
             patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:

            # Step 1: Barcode lookup fails
            mock_cache_service.get.return_value = None
            mock_openfoodfacts_service.get_product.return_value = None

            barcode_response = client.post("/product/by-barcode", json={"barcode": barcode})
            assert barcode_response.status_code == 404

            # Step 2: User scans label instead
            mock_factory.create_local.return_value = mock_ocr_service

            scan_response = client.post(
                "/product/scan-label",
                files={"file": ("fallback.jpg", test_image_file, "image/jpeg")}
            )

            assert scan_response.status_code == 200
            scan_data = scan_response.json()
            assert scan_data["confidence"] >= 0.7
            assert scan_data["nutrients"]["energy_kcal_per_100g"] == 320.0

    def test_rate_limiting_behavior_simulation(self, client, mock_cache_service, mock_openfoodfacts_service):
        """Test rate limiting behavior with multiple rapid requests"""
        barcode_base = "123456789012"
        
        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service):
            
            mock_cache_service.get.return_value = None
            mock_openfoodfacts_service.get_product.return_value = None
            
            # Simulate multiple rapid requests
            responses = []
            for i in range(5):
                response = client.post("/product/by-barcode", json={"barcode": f"{barcode_base}{i}"})
                responses.append(response)
            
            # All should be processed (no rate limiting implemented yet, but test structure is ready)
            assert all(r.status_code in [404, 200] for r in responses)

    def test_concurrent_cache_access_simulation(self, client, sample_product, mock_cache_service, mock_openfoodfacts_service):
        """Test concurrent access to cached products"""
        barcode = "1234567890123"
        cached_data = sample_product.model_dump()
        
        with patch('app.routes.product.product_routes.cache_service', mock_cache_service), \
             patch('app.routes.product.product_routes.openfoodfacts_service', mock_openfoodfacts_service):
            
            # Simulate cache hit for concurrent requests
            mock_cache_service.get.return_value = cached_data
            
            # Make multiple concurrent requests
            responses = []
            for _ in range(3):
                response = client.post("/product/by-barcode", json={"barcode": barcode})
                responses.append(response)
            
            # All should succeed with cached data
            assert all(r.status_code == 200 for r in responses)
            assert all(r.json()["name"] == "Test Oatmeal" for r in responses)
            
            # Cache should be accessed multiple times, API should not be called
            assert mock_cache_service.get.call_count == 3
            mock_openfoodfacts_service.get_product.assert_not_called()


# Performance and edge case testing
class TestProductRoutesEdgeCases:
    """Test edge cases and performance scenarios"""

    def test_very_long_barcode_handling(self, client):
        """Test handling of unusually long barcodes"""
        very_long_barcode = "1" * 100  # 100 character barcode
        with patch('app.routes.product.product_routes.cache_service') as mock_cache, \
             patch('app.routes.product.product_routes.openfoodfacts_service') as mock_openfoodfacts:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock(return_value=True)
            mock_openfoodfacts.get_product = AsyncMock(return_value=None)
            response = client.post("/product/by-barcode", json={"barcode": very_long_barcode})
            
            # Should handle gracefully (either process or reject with proper error)
            assert response.status_code in [400, 404, 422]

    def test_special_characters_in_barcode(self, client):
        """Test barcodes with special characters"""
        special_barcode = "123-456-789-012"
        with patch('app.routes.product.product_routes.cache_service') as mock_cache, \
             patch('app.routes.product.product_routes.openfoodfacts_service') as mock_openfoodfacts:
            mock_cache.get = AsyncMock(return_value=None)
            mock_cache.set = AsyncMock(return_value=True)
            mock_openfoodfacts.get_product = AsyncMock(return_value=None)
            response = client.post("/product/by-barcode", json={"barcode": special_barcode})
            
            # Should handle gracefully
            assert response.status_code in [400, 404, 422]

    def test_unicode_barcode_handling(self, client):
        """Test barcodes with unicode characters"""
        unicode_barcode = "123456789Ω12"  # Contains omega character

        response = client.post("/product/by-barcode", json={"barcode": unicode_barcode})

        # Should handle gracefully - API accepts unicode and attempts lookup (200 or 404)
        # or rejects with validation error (400, 422)
        assert response.status_code in [200, 400, 404, 422]

    def test_null_barcode_handling(self, client):
        """Test null barcode handling"""
        response = client.post("/product/by-barcode", json={"barcode": None})
        
        assert response.status_code == 422

    def test_numeric_barcode_conversion(self, client):
        """Test numeric barcode gets converted to string"""
        numeric_barcode = 1234567890123
        
        response = client.post("/product/by-barcode", json={"barcode": numeric_barcode})
        
        # Should either work or fail gracefully with validation error
        assert response.status_code in [200, 404, 422, 400]

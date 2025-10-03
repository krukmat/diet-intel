"""
Product Routes Focused Integration Tests - Phase 4

Focused integration tests for product routes with proper mocking and realistic scenarios.
This simplified approach ensures tests work reliably and improve coverage effectively.

Target: Product routes coverage 16% → 60%
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import status
import httpx
import io

from main import app
from app.models.product import ProductResponse, Nutriments


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


class TestProductBarcodeRoutesCore:
    """Core barcode lookup functionality tests"""
    
    def test_barcode_route_cache_miss_api_success(self, client):
        """Test barcode lookup with cache miss and successful API call"""
        test_barcode = "test_cache_miss_123"
        
        # Create test product
        test_product = ProductResponse(
            source="OpenFoodFacts",
            barcode=test_barcode,
            name="Test Product Cache Miss",
            brand="TestBrand",
            image_url="https://example.com/test.jpg",
            serving_size="100g",
            nutriments=Nutriments(
                energy_kcal_per_100g=300.0,
                protein_g_per_100g=15.0,
                fat_g_per_100g=8.0,
                carbs_g_per_100g=35.0,
                sugars_g_per_100g=12.0,
                salt_g_per_100g=0.8
            ),
            fetched_at=datetime.now()
        )
        
        with patch('app.services.cache.cache_service.get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.services.cache.cache_service.set', new_callable=AsyncMock) as mock_cache_set, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_api:
            
            # Mock cache miss
            mock_cache_get.return_value = None
            
            # Mock API success
            mock_api.return_value = test_product
            
            response = client.post("/product/by-barcode", json={"barcode": test_barcode})
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            assert data["barcode"] == test_barcode
            assert data["name"] == "Test Product Cache Miss"
            assert data["brand"] == "TestBrand"
            
            # Verify service calls
            mock_cache_get.assert_called_once()
            mock_api.assert_called_once_with(test_barcode)
            mock_cache_set.assert_called_once()
    
    def test_barcode_route_cache_hit(self, client):
        """Test barcode lookup with cache hit"""
        test_barcode = "test_cache_hit_456"
        
        # Cached product data
        cached_data = {
            "source": "OpenFoodFacts",
            "barcode": test_barcode,
            "name": "Cached Test Product",
            "brand": "CachedBrand",
            "image_url": "https://example.com/cached.jpg",
            "serving_size": "150g",
            "nutriments": {
                "energy_kcal_per_100g": 250.0,
                "protein_g_per_100g": 10.0,
                "fat_g_per_100g": 5.0,
                "carbs_g_per_100g": 40.0,
                "sugars_g_per_100g": 8.0,
                "salt_g_per_100g": 0.5
            },
            "fetched_at": "2024-01-01T00:00:00"
        }
        
        with patch('app.services.cache.cache_service.get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_api:
            
            # Mock cache hit
            mock_cache_get.return_value = cached_data
            
            response = client.post("/product/by-barcode", json={"barcode": test_barcode})
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            assert data["barcode"] == test_barcode
            assert data["name"] == "Cached Test Product"
            assert data["brand"] == "CachedBrand"
            
            # Verify cache was used, API not called
            mock_cache_get.assert_called_once()
            mock_api.assert_not_called()
    
    def test_barcode_route_product_not_found(self, client):
        """Test barcode lookup when product is not found"""
        test_barcode = "not_found_789"
        
        with patch('app.services.cache.cache_service.get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_api:
            
            # Mock cache miss and API returns None
            mock_cache_get.return_value = None
            mock_api.return_value = None
            
            response = client.post("/product/by-barcode", json={"barcode": test_barcode})
            
            # Verify 404
            assert response.status_code == 404
            data = response.json()
            assert "not found" in data["detail"].lower()
            assert test_barcode in data["detail"]
    
    def test_barcode_route_timeout_error(self, client):
        """Test barcode lookup timeout handling"""
        test_barcode = "timeout_test_999"
        
        with patch('app.services.cache.cache_service.get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_api:
            
            # Mock cache miss and timeout
            mock_cache_get.return_value = None
            mock_api.side_effect = httpx.TimeoutException("Request timeout")
            
            response = client.post("/product/by-barcode", json={"barcode": test_barcode})
            
            # Verify 408 timeout
            assert response.status_code == 408
            data = response.json()
            assert "timeout" in data["detail"].lower()
    
    def test_barcode_route_network_error(self, client):
        """Test barcode lookup network error handling"""
        test_barcode = "network_error_888"
        
        with patch('app.services.cache.cache_service.get', new_callable=AsyncMock) as mock_cache_get, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_api:
            
            # Mock cache miss and network error
            mock_cache_get.return_value = None
            mock_api.side_effect = httpx.RequestError("Network error")
            
            response = client.post("/product/by-barcode", json={"barcode": test_barcode})
            
            # Verify 503 service unavailable
            assert response.status_code == 503
            data = response.json()
            assert "connect" in data["detail"].lower()


class TestProductBarcodeValidation:
    """Test barcode input validation"""
    
    def test_empty_barcode_validation(self, client):
        """Test empty barcode is rejected"""
        response = client.post("/product/by-barcode", json={"barcode": ""})

        assert response.status_code == 400

    def test_whitespace_barcode_validation(self, client):
        """Test whitespace-only barcode is rejected"""
        response = client.post("/product/by-barcode", json={"barcode": "   "})

        assert response.status_code == 400
    
    def test_missing_barcode_field(self, client):
        """Test missing barcode field is rejected"""
        response = client.post("/product/by-barcode", json={})
        
        assert response.status_code == 422
    
    def test_null_barcode_validation(self, client):
        """Test null barcode is rejected"""
        response = client.post("/product/by-barcode", json={"barcode": None})
        
        assert response.status_code == 422
    
    def test_malformed_json_request(self, client):
        """Test malformed JSON is handled properly"""
        response = client.post("/product/by-barcode",
                               data="invalid json content",
                               headers={"Content-Type": "application/json"})
        
        assert response.status_code == 422


class TestProductScanLabelRoutesCore:
    """Core label scanning functionality tests"""
    
    @pytest.fixture
    def test_image_bytes(self):
        """Create minimal valid JPEG bytes for testing"""
        # Minimal JPEG header for testing
        return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xd9'
    
    def test_scan_label_high_confidence_success(self, client, test_image_bytes):
        """Test successful label scan with high confidence"""
        with patch('app.services.ocr.ocr_service.extract_nutrients') as mock_ocr:
            
            # Mock high confidence result
            mock_ocr.return_value = {
                'confidence': 0.85,
                'parsed_nutriments': {
                    'energy_kcal_per_100g': 280.0,
                    'protein_g_per_100g': 14.0,
                    'fat_g_per_100g': 9.0,
                    'carbs_g_per_100g': 32.0,
                    'sugars_g_per_100g': 6.0,
                    'salt_g_per_100g': 1.2
                }
            }
            
            response = client.post(
                "/product/scan-label",
                files={"file": ("test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] >= 0.7
            assert "nutrients" in data
            assert data["nutrients"]["energy_kcal_per_100g"] == 280.0
            assert "source" in data
    
    def test_scan_label_low_confidence_suggestion(self, client, test_image_bytes):
        """Test label scan with low confidence suggests external OCR"""
        with patch('app.services.ocr.ocr_service.extract_nutrients') as mock_ocr:
            
            # Mock low confidence result
            mock_ocr.return_value = {
                'confidence': 0.45,
                'parsed_nutriments': {
                    'energy_kcal_per_100g': 200.0,
                    'protein_g_per_100g': None,
                    'fat_g_per_100g': None,
                    'carbs_g_per_100g': None,
                    'sugars_g_per_100g': None,
                    'salt_g_per_100g': None
                }
            }
            
            response = client.post(
                "/product/scan-label",
                files={"file": ("test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] < 0.7
            assert "suggestion" in data
            assert "external" in data["suggestion"].lower()
    
    def test_scan_label_invalid_content_type(self, client):
        """Test scan with non-image content type"""
        text_content = io.BytesIO(b"This is not an image file")
        
        response = client.post(
            "/product/scan-label",
            files={"file": ("test.txt", text_content, "text/plain")}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "image" in data["detail"].lower()
    
    def test_scan_label_missing_file(self, client):
        """Test scan with no file provided"""
        response = client.post("/product/scan-label")
        
        assert response.status_code == 422
    
    def test_scan_label_ocr_processing_error(self, client, test_image_bytes):
        """Test OCR processing error handling"""
        with patch('app.services.ocr.ocr_service.extract_nutrients') as mock_ocr:
            
            # Mock OCR processing error
            mock_ocr.side_effect = Exception("OCR processing failed")
            
            response = client.post(
                "/product/scan-label",
                files={"file": ("test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 500
            data = response.json()
            assert "error" in data["detail"].lower() or "processing" in data["detail"].lower()


class TestProductExternalScanRoutes:
    """Test external OCR functionality"""
    
    @pytest.fixture
    def test_image_bytes(self):
        """Create test image bytes"""
        return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xd9'
    
    def test_external_scan_success(self, client, test_image_bytes):
        """Test successful external OCR scan"""
        with patch('app.services.ocr.call_external_ocr') as mock_external:
            
            # Mock successful external OCR
            mock_external.return_value = {
                'confidence': 0.92,
                'parsed_nutriments': {
                    'energy_kcal_per_100g': 320.0,
                    'protein_g_per_100g': 16.0,
                    'fat_g_per_100g': 12.0,
                    'carbs_g_per_100g': 38.0,
                    'sugars_g_per_100g': 9.0,
                    'salt_g_per_100g': 1.5
                }
            }
            
            response = client.post(
                "/product/scan-label-external",
                files={"file": ("test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] == 0.92
            assert "nutrients" in data
            assert data["source"] == "external_ocr"
    
    def test_external_scan_fallback_to_local(self, client, test_image_bytes):
        """Test external OCR failure falls back to local OCR"""
        with patch('app.services.ocr.call_external_ocr') as mock_external, \
             patch('app.services.ocr.ocr_service.extract_nutrients') as mock_local:
            
            # Mock external OCR failure
            mock_external.side_effect = Exception("External service unavailable")
            
            # Mock local OCR success
            mock_local.return_value = {
                'confidence': 0.78,
                'parsed_nutriments': {
                    'energy_kcal_per_100g': 290.0,
                    'protein_g_per_100g': 13.0,
                    'fat_g_per_100g': 10.0,
                    'carbs_g_per_100g': 33.0,
                    'sugars_g_per_100g': 7.0,
                    'salt_g_per_100g': 1.1
                }
            }
            
            response = client.post(
                "/product/scan-label-external",
                files={"file": ("test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["confidence"] == 0.78
            assert data["source"] == "local_ocr_fallback"


class TestProductRoutesIntegrationWorkflows:
    """Test realistic integration workflows"""
    
    def test_complete_barcode_not_found_to_scan_workflow(self, client):
        """Test workflow: barcode lookup fails → user scans label"""
        unknown_barcode = "unknown_product_12345"
        test_image = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xd9'
        
        # Step 1: Barcode lookup fails
        with patch('app.services.cache.cache_service.get', new_callable=AsyncMock) as mock_cache, \
             patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_api:
            
            mock_cache.return_value = None
            mock_api.return_value = None
            
            barcode_response = client.post("/product/by-barcode", json={"barcode": unknown_barcode})
            assert barcode_response.status_code == 404
        
        # Step 2: User scans label instead
        with patch('app.services.ocr.ocr_service.extract_nutrients') as mock_ocr:
            
            mock_ocr.return_value = {
                'confidence': 0.82,
                'parsed_nutriments': {
                    'energy_kcal_per_100g': 340.0,
                    'protein_g_per_100g': 17.0,
                    'fat_g_per_100g': 13.0,
                    'carbs_g_per_100g': 39.0,
                    'sugars_g_per_100g': 10.0,
                    'salt_g_per_100g': 1.6
                }
            }
            
            scan_response = client.post(
                "/product/scan-label",
                files={"file": ("fallback.jpg", io.BytesIO(test_image), "image/jpeg")}
            )
            
            assert scan_response.status_code == 200
            scan_data = scan_response.json()
            assert scan_data["confidence"] >= 0.7
            assert scan_data["nutrients"]["energy_kcal_per_100g"] == 340.0
    
    def test_multiple_barcode_requests_different_results(self, client):
        """Test multiple barcode requests with different outcomes"""
        test_cases = [
            ("valid_product_001", "success"),
            ("invalid_product_002", "not_found"),
            ("timeout_product_003", "timeout")
        ]
        
        for barcode, expected_outcome in test_cases:
            with patch('app.services.cache.cache_service.get', new_callable=AsyncMock) as mock_cache, \
                 patch('app.services.openfoodfacts.openfoodfacts_service.get_product', new_callable=AsyncMock) as mock_api:
                
                mock_cache.return_value = None
                
                if expected_outcome == "success":
                    mock_api.return_value = ProductResponse(
                        source="OpenFoodFacts",
                        barcode=barcode,
                        name=f"Product {barcode}",
                        brand="TestBrand",
                        image_url=f"https://example.com/{barcode}.jpg",
                        serving_size="100g",
                        nutriments=Nutriments(
                            energy_kcal_per_100g=250.0,
                            protein_g_per_100g=12.0,
                            fat_g_per_100g=8.0,
                            carbs_g_per_100g=30.0,
                            sugars_g_per_100g=5.0,
                            salt_g_per_100g=1.0
                        ),
                        fetched_at=datetime.now()
                    )
                    expected_status = 200
                elif expected_outcome == "not_found":
                    mock_api.return_value = None
                    expected_status = 404
                elif expected_outcome == "timeout":
                    mock_api.side_effect = httpx.TimeoutException("Request timeout")
                    expected_status = 408
                
                response = client.post("/product/by-barcode", json={"barcode": barcode})
                assert response.status_code == expected_status


class TestProductRoutesPerformanceAndEdgeCases:
    """Test edge cases and performance scenarios"""
    
    def test_very_long_barcode_handling(self, client):
        """Test handling of unusually long barcodes"""
        very_long_barcode = "1" * 50  # 50 character barcode
        
        response = client.post("/product/by-barcode", json={"barcode": very_long_barcode})
        
        # Should handle gracefully - either process or reject appropriately
        assert response.status_code in [200, 400, 404, 422]
    
    def test_special_characters_in_barcode(self, client):
        """Test barcodes with special characters"""
        special_barcode = "123-456-789-ABC"
        
        response = client.post("/product/by-barcode", json={"barcode": special_barcode})
        
        # Should handle gracefully
        assert response.status_code in [200, 400, 404, 422]
    
    def test_numeric_barcode_as_integer(self, client):
        """Test numeric barcode provided as integer"""
        numeric_barcode = 1234567890123
        
        response = client.post("/product/by-barcode", json={"barcode": numeric_barcode})
        
        # Should either work or fail with validation error
        assert response.status_code in [200, 400, 404, 422]

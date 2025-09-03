"""
Enhanced Product Routes Integration Tests
Tests the updated OCR routes using the enhanced nutrition_ocr service
"""
import pytest
import tempfile
import os
import io
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from fastapi import UploadFile

# Import the FastAPI app
from main import app

pytestmark = pytest.mark.asyncio

@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)

@pytest.fixture  
def test_image_bytes():
    """Sample image bytes for testing"""
    # Simple JPEG header + minimal data
    return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xd9'


class TestEnhancedScanLabelRoute:
    """Test the updated scan-label route with enhanced OCR integration"""
    
    @pytest.fixture
    def mock_high_confidence_ocr_result(self):
        """Mock high confidence OCR result from enhanced service"""
        return {
            'raw_text': 'Energy: 350 kcal\nProtein: 12.5g\nFat: 8.2g\nCarbohydrates: 65.3g\nSugars: 15.2g\nSalt: 1.1g',
            'parsed_nutriments': {
                'energy_kcal': 350.0,
                'protein_g': 12.5,
                'fat_g': 8.2,
                'carbs_g': 65.3,
                'sugars_g': 15.2,
                'salt_g': 1.1
            },
            'confidence': 0.85,
            'extraction_details': {
                'energy_kcal': {'pattern': 'Energy: 350 kcal', 'confidence': 0.9}
            },
            'processing_details': {
                'ocr_engine': 'tesseract',
                'processing_time_ms': 1500
            }
        }
    
    @pytest.fixture
    def mock_low_confidence_ocr_result(self):
        """Mock low confidence OCR result"""
        return {
            'raw_text': 'Energy: 35O kcal\nProtei: 12g\nFat unclear',
            'parsed_nutriments': {
                'energy_kcal': 350.0,
                'protein_g': 12.0
            },
            'confidence': 0.45,
            'extraction_details': {
                'energy_kcal': {'pattern': 'Energy: 35O kcal', 'confidence': 0.6}
            },
            'processing_details': {
                'ocr_engine': 'tesseract',
                'processing_time_ms': 1200
            }
        }
    
    def test_scan_label_high_confidence_success(self, client, test_image_bytes, mock_high_confidence_ocr_result):
        """Test successful label scan with high confidence"""
        # Patch the function that's imported in the route module
        with patch('app.routes.product.extract_nutrients_from_image', return_value=mock_high_confidence_ocr_result):
            response = client.post(
                "/product/scan-label",
                files={"image": ("nutrition_label.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Check response structure
            assert data["source"] == "Local OCR"
            assert data["confidence"] == 0.85
            assert "raw_text" in data
            assert "nutriments" in data
            assert "scanned_at" in data
            
            # Check nutriments structure
            nutriments = data["nutriments"]
            assert nutriments["energy_kcal_per_100g"] == 350.0
            assert nutriments["protein_g_per_100g"] == 12.5
            assert nutriments["fat_g_per_100g"] == 8.2
            assert nutriments["carbs_g_per_100g"] == 65.3
            assert nutriments["sugars_g_per_100g"] == 15.2
            assert nutriments["salt_g_per_100g"] == 1.1
    
    def test_scan_label_low_confidence_suggestion(self, client, test_image_bytes, mock_low_confidence_ocr_result):
        """Test label scan with low confidence suggests external OCR"""
        with patch('app.routes.product.extract_nutrients_from_image', return_value=mock_low_confidence_ocr_result):
            response = client.post(
                "/product/scan-label",
                files={"image": ("blurry_label.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Check low confidence response structure
            assert data["low_confidence"] is True
            assert data["confidence"] == 0.45
            assert data["suggest_external_ocr"] is True
            assert "partial_parsed" in data
            assert "raw_text" in data
            
            # Check partial parsing
            partial = data["partial_parsed"]
            assert partial["energy_kcal"] == 350.0
            assert partial["protein_g"] == 12.0
    
    def test_scan_label_invalid_content_type(self, client):
        """Test scan with non-image content type"""
        text_content = io.BytesIO(b"This is not an image file")
        
        response = client.post(
            "/product/scan-label",
            files={"image": ("test.txt", text_content, "text/plain")}
        )
        
        assert response.status_code == 400
        assert "image" in response.json()["detail"].lower()
    
    def test_scan_label_file_too_large(self, client):
        """Test scan with file too large"""
        # Create a mock large file
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        
        # Mock UploadFile with size property
        with patch('fastapi.UploadFile') as mock_upload:
            mock_file = MagicMock()
            mock_file.content_type = "image/jpeg"
            mock_file.size = 11 * 1024 * 1024  # 11MB
            mock_file.filename = "large_image.jpg"
            
            response = client.post(
                "/product/scan-label",
                files={"image": ("large_image.jpg", io.BytesIO(large_content), "image/jpeg")}
            )
            
            # Note: This test depends on FastAPI's file size validation
            # The actual status code may vary based on server configuration
            assert response.status_code in [400, 413]
    
    def test_scan_label_no_text_extracted(self, client, test_image_bytes):
        """Test scan when no text can be extracted"""
        empty_ocr_result = {
            'raw_text': '',
            'parsed_nutriments': {},
            'confidence': 0.0,
            'extraction_details': {},
            'processing_details': {'ocr_engine': 'tesseract'}
        }
        
        with patch('app.services.nutrition_ocr.extract_nutrients_from_image', return_value=empty_ocr_result):
            response = client.post(
                "/product/scan-label",
                files={"image": ("blank_image.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 400
            assert "No text could be extracted" in response.json()["detail"]
    
    def test_scan_label_processing_error(self, client, test_image_bytes):
        """Test OCR processing error handling"""
        with patch('app.services.nutrition_ocr.extract_nutrients_from_image', side_effect=Exception("OCR processing failed")):
            response = client.post(
                "/product/scan-label",
                files={"image": ("corrupted.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 500
            assert "Error processing image" in response.json()["detail"]


class TestEnhancedExternalScanRoute:
    """Test the updated scan-label-external route"""
    
    @pytest.fixture
    def mock_external_ocr_success(self):
        """Mock successful external OCR result"""
        return {
            'raw_text': 'Energy: 400 kcal\nProtein: 15.0g\nFat: 10.5g\nCarbohydrates: 70.0g\nSugars: 20.0g\nSalt: 1.5g',
            'parsed_nutriments': {
                'energy_kcal': 400.0,
                'protein_g': 15.0,
                'fat_g': 10.5,
                'carbs_g': 70.0,
                'sugars_g': 20.0,
                'salt_g': 1.5
            },
            'confidence': 0.95,
            'extraction_details': {
                'energy_kcal': {'pattern': 'Energy: 400 kcal', 'confidence': 0.98}
            },
            'processing_details': {
                'ocr_engine': 'external_api',
                'provider': 'premium_ocr',
                'processing_time_ms': 800
            }
        }
    
    @pytest.fixture
    def mock_external_ocr_failure(self):
        """Mock external OCR failure (returns empty result)"""
        return {
            'raw_text': '',
            'parsed_nutriments': {},
            'confidence': 0.0,
            'extraction_details': {},
            'processing_details': {'error': 'External service unavailable'}
        }
    
    def test_external_scan_success(self, client, test_image_bytes, mock_external_ocr_success):
        """Test external OCR service success"""
        with patch('app.routes.product.call_external_ocr', return_value=mock_external_ocr_success):
            response = client.post(
                "/product/scan-label-external",
                files={"image": ("premium_scan.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Should use external OCR
            assert data["source"] == "External OCR"
            assert data["confidence"] == 0.95
            
            # Check enhanced accuracy
            nutriments = data["nutriments"]
            assert nutriments["energy_kcal_per_100g"] == 400.0
            assert nutriments["protein_g_per_100g"] == 15.0
    
    def test_external_scan_fallback_to_local(self, client, test_image_bytes, 
                                           mock_external_ocr_failure, mock_high_confidence_ocr_result):
        """Test fallback to local OCR when external fails"""
        with patch('app.services.nutrition_ocr.call_external_ocr', return_value=mock_external_ocr_failure), \
             patch('app.services.nutrition_ocr.extract_nutrients_from_image', return_value=mock_high_confidence_ocr_result):
            
            response = client.post(
                "/product/scan-label-external", 
                files={"image": ("fallback_test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Should fallback to local OCR
            assert data["source"] == "Local OCR (fallback)"
            assert data["confidence"] == 0.85  # From mock_high_confidence_ocr_result
    
    def test_external_scan_low_confidence_no_suggest(self, client, test_image_bytes):
        """Test external scan with low confidence doesn't suggest external OCR again"""
        low_confidence_external = {
            'raw_text': 'unclear text',
            'parsed_nutriments': {'energy_kcal': 200.0},
            'confidence': 0.3,
            'extraction_details': {},
            'processing_details': {'ocr_engine': 'external_api'}
        }
        
        with patch('app.services.nutrition_ocr.call_external_ocr', return_value=low_confidence_external):
            response = client.post(
                "/product/scan-label-external",
                files={"image": ("low_quality.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Should not suggest external OCR since we already tried it
            assert data["low_confidence"] is True
            assert data["suggest_external_ocr"] is False


class TestEnhancedIntegrationWorkflow:
    """Test complete workflow scenarios with enhanced OCR"""
    
    def test_complete_nutrition_extraction_workflow(self, client, test_image_bytes):
        """Test complete workflow from image upload to nutrition data extraction"""
        complete_ocr_result = {
            'raw_text': '''Nutrition Information per 100g
            Energy: 2000 kJ / 478 kcal
            Protein: 8.5g
            Fat: 25.0g
            of which saturates: 15.0g
            Carbohydrate: 55.0g
            of which sugars: 35.0g  
            Salt: 0.8g''',
            'parsed_nutriments': {
                'energy_kcal': 478.0,
                'energy_kj': 2000.0, 
                'protein_g': 8.5,
                'fat_g': 25.0,
                'carbs_g': 55.0,
                'sugars_g': 35.0,
                'salt_g': 0.8
            },
            'confidence': 0.92,
            'extraction_details': {
                'energy_kcal': {'pattern': '478 kcal', 'confidence': 0.95},
                'energy_kj': {'pattern': '2000 kJ', 'confidence': 0.90},
                'protein_g': {'pattern': 'Protein: 8.5g', 'confidence': 0.95}
            },
            'processing_details': {
                'ocr_engine': 'tesseract',
                'preprocessing_applied': ['grayscale', 'denoise', 'threshold'],
                'processing_time_ms': 2100
            }
        }
        
        with patch('app.services.nutrition_ocr.extract_nutrients_from_image', return_value=complete_ocr_result):
            response = client.post(
                "/product/scan-label",
                files={"image": ("complete_label.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify complete nutrition extraction
            assert data["confidence"] >= 0.7  # High confidence
            nutriments = data["nutriments"]
            
            # Check all major nutrients were extracted
            assert nutriments["energy_kcal_per_100g"] == 478.0
            assert nutriments["protein_g_per_100g"] == 8.5
            assert nutriments["fat_g_per_100g"] == 25.0
            assert nutriments["carbs_g_per_100g"] == 55.0
            assert nutriments["sugars_g_per_100g"] == 35.0
            assert nutriments["salt_g_per_100g"] == 0.8
            
            # Check metadata
            assert data["source"] == "Local OCR"
            assert "scanned_at" in data
            assert len(data["raw_text"]) > 0
    
    def test_error_recovery_workflow(self, client, test_image_bytes):
        """Test error recovery in the OCR workflow"""
        # First attempt fails
        with patch('app.services.nutrition_ocr.extract_nutrients_from_image', side_effect=Exception("Temporary error")):
            response = client.post(
                "/product/scan-label", 
                files={"image": ("test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 500
        
        # Second attempt with external OCR succeeds
        success_result = {
            'raw_text': 'Energy: 300 kcal\nProtein: 10g',
            'parsed_nutriments': {'energy_kcal': 300.0, 'protein_g': 10.0},
            'confidence': 0.8,
            'extraction_details': {},
            'processing_details': {'ocr_engine': 'external_api'}
        }
        
        with patch('app.services.nutrition_ocr.call_external_ocr', return_value=success_result):
            response = client.post(
                "/product/scan-label-external",
                files={"image": ("test.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            assert response.status_code == 200
            assert response.json()["source"] == "External OCR"


@pytest.fixture
def mock_high_confidence_ocr_result():
    """Shared fixture for high confidence OCR result"""
    return {
        'raw_text': 'Energy: 350 kcal\nProtein: 12.5g\nFat: 8.2g\nCarbohydrates: 65.3g\nSugars: 15.2g\nSalt: 1.1g',
        'parsed_nutriments': {
            'energy_kcal': 350.0,
            'protein_g': 12.5,
            'fat_g': 8.2,
            'carbs_g': 65.3,
            'sugars_g': 15.2,
            'salt_g': 1.1
        },
        'confidence': 0.85,
        'extraction_details': {
            'energy_kcal': {'pattern': 'Energy: 350 kcal', 'confidence': 0.9}
        },
        'processing_details': {
            'ocr_engine': 'tesseract',
            'processing_time_ms': 1500
        }
    }
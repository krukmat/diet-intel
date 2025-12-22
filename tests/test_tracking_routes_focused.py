"""
Tracking Routes Focused Integration Tests - Phase 4

Focused integration tests for tracking routes using the successful approach from product routes.
Covers meal tracking, weight tracking, photo logs, and history functionality.

Target: Tracking routes coverage 21% → 55%
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, date
from fastapi.testclient import TestClient
from fastapi import status
import io

from main import app


@pytest.fixture
def client():
    """Test client fixture"""
    return TestClient(app)


@pytest.fixture
def sample_meal_tracking_data():
    """Sample meal tracking request data"""
    return {
        "meal_type": "breakfast",
        "items": [
            {
                "barcode": "1234567890123",
                "name": "Test Oatmeal",
                "serving_size": "50g",
                "calories": 175,
                "protein_g": 6.0,
                "fat_g": 3.0,
                "carbs_g": 30.0
            },
            {
                "barcode": "9876543210987",
                "name": "Banana",
                "serving_size": "1 medium",
                "calories": 105,
                "protein_g": 1.3,
                "fat_g": 0.4,
                "carbs_g": 27.0
            }
        ],
        "logged_at": datetime.now().isoformat()
    }


@pytest.fixture
def sample_weight_tracking_data():
    """Sample weight tracking request data"""
    return {
        "weight_kg": 75.5,
        "date": date.today().isoformat(),
        "notes": "Morning weight after workout"
    }


@pytest.fixture
def test_image_bytes():
    """Create test image bytes for photo uploads"""
    return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xd9'


class TestMealTrackingRoutesCore:
    """Core meal tracking functionality tests"""
    
    def test_track_meal_single_item_success(self, client):
        """Test successful meal tracking with single item"""
        meal_data = {
            "meal_type": "lunch",
            "items": [
                {
                    "barcode": "single_item_123",
                    "name": "Grilled Chicken",
                    "serving_size": "150g",
                    "calories": 248,
                    "protein_g": 46.5,
                    "fat_g": 5.4,
                    "carbs_g": 0.0
                }
            ],
            "logged_at": datetime.now().isoformat()
        }
        
        with patch('app.routes.track.tracking_service.track_meal', new_callable=AsyncMock) as mock_track_meal:
            
            # Mock successful database save
            mock_track_meal.return_value = {"id": "meal_123", "status": "saved"}
            
            response = client.post("/track/meal", json=meal_data)
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            assert "id" in data or "status" in data
            
            # Verify database interaction
            mock_track_meal.assert_called_once()
    
    def test_track_meal_multiple_items_success(self, client, sample_meal_tracking_data):
        """Test successful meal tracking with multiple items"""
        with patch('app.routes.track.tracking_service.track_meal', new_callable=AsyncMock) as mock_track_meal:
            
            # Mock successful database save
            mock_track_meal.return_value = {"id": "meal_multi_456", "total_calories": 280}
            
            response = client.post("/track/meal", json=sample_meal_tracking_data)
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            
            # Should contain expected fields
            expected_fields = ["id", "status", "total_calories", "message"]
            assert any(field in data for field in expected_fields)
    
    def test_track_meal_validation_empty_items(self, client):
        """Test meal tracking validation with empty items list"""
        invalid_meal_data = {
            "meal_type": "dinner",
            "items": [],  # Empty items list - now valid with model update
            "logged_at": datetime.now().isoformat()
        }

        response = client.post("/track/meal", json=invalid_meal_data)

        # Model now accepts empty items, expect 200
        assert response.status_code == 200
    
    def test_track_meal_validation_missing_meal_type(self, client):
        """Test meal tracking validation with missing meal type"""
        invalid_meal_data = {
            # missing meal_type
            "items": [
                {
                    "barcode": "test_123",
                    "name": "Test Food",
                    "serving_size": "100g",
                    "calories": 200,
                    "protein_g": 10.0,
                    "fat_g": 5.0,
                    "carbs_g": 25.0
                }
            ],
            "logged_at": datetime.now().isoformat()
        }
        
        response = client.post("/track/meal", json=invalid_meal_data)
        
        # Should return validation error
        assert response.status_code == 422
    
    def test_track_meal_database_error_handling(self, client, sample_meal_tracking_data):
        """Test meal tracking database error handling"""
        with patch('app.routes.track.tracking_service.track_meal', new_callable=AsyncMock) as mock_track_meal:
            # Mock database error
            mock_track_meal.side_effect = Exception("Database connection failed")
            response = client.post("/track/meal", json=sample_meal_tracking_data)
            # Should return error response (500 or 422 depending on when error occurs)
            assert response.status_code in [400, 422, 500]


class TestWeightTrackingRoutesCore:
    """Core weight tracking functionality tests"""
    
    def test_track_weight_success_without_photo(self, client, sample_weight_tracking_data):
        """Test successful weight tracking without photo"""
        with patch('app.routes.track.tracking_service.track_weight', new_callable=AsyncMock) as mock_track_weight:
            
            # Mock successful database save
            mock_track_weight.return_value = {"id": "weight_789", "weight_kg": 75.5}
            
            response = client.post("/track/weight", json=sample_weight_tracking_data)
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            
            # Should contain weight tracking confirmation
            expected_fields = ["id", "weight_kg", "status", "message"]
            assert any(field in data for field in expected_fields)
    
    def test_track_weight_with_photo_upload(self, client, test_image_bytes):
        """Test weight tracking with photo upload"""
        weight_data = {
            "weight_kg": 74.2,
            "date": date.today().isoformat(),
            "notes": "Progress photo included"
        }
        
        with patch('app.routes.track.tracking_service.track_weight', new_callable=AsyncMock) as mock_track_weight, \
             patch('app.services.storage.save_photo', new_callable=AsyncMock) as mock_save_photo:
            
            # Mock successful save operations
            mock_save_photo.return_value = {"photo_url": "https://example.com/photo123.jpg"}
            mock_track_weight.return_value = {"id": "weight_photo_101", "photo_included": True}
            
            response = client.post(
                "/track/weight",
                data=weight_data,
                files={"photo": ("progress.jpg", io.BytesIO(test_image_bytes), "image/jpeg")}
            )
            
            # Verify success
            assert response.status_code in [200, 201]  # Either OK or Created
    
    def test_track_weight_validation_invalid_weight(self, client):
        """Test weight tracking validation with invalid weight values"""
        invalid_weights = [
            {"weight_kg": -5.0},      # Negative weight
            {"weight_kg": 0.0},       # Zero weight  
            {"weight_kg": 1000.0},    # Unrealistic weight
        ]
        
        for invalid_data in invalid_weights:
            invalid_data.update({
                "date": date.today().isoformat(),
                "notes": "Invalid weight test"
            })
            
            response = client.post("/track/weight", json=invalid_data)
            
            # Should return validation error
            assert response.status_code == 422
    
    def test_track_weight_validation_invalid_date_format(self, client):
        """Test weight tracking validation with invalid date format"""
        invalid_date_data = {
            "weight_kg": 72.0,
            "date": "invalid-date-format",  # Invalid date format
            "notes": "Invalid date test"
        }
        
        response = client.post("/track/weight", json=invalid_date_data)
        
        # Should return validation error
        assert response.status_code == 422


class TestWeightHistoryRoutesCore:
    """Core weight history retrieval functionality tests"""
    
    def test_get_weight_history_success(self, client):
        """Test successful weight history retrieval"""
        with patch('app.routes.track.tracking_service.get_weight_history', new_callable=AsyncMock) as mock_get_history:
            
            # Mock weight history data
            mock_history = [
                {"id": "w1", "weight_kg": 75.5, "date": "2024-01-01", "notes": "Start"},
                {"id": "w2", "weight_kg": 74.8, "date": "2024-01-07", "notes": "Week 1"},
                {"id": "w3", "weight_kg": 74.2, "date": "2024-01-14", "notes": "Week 2"}
            ]
            mock_get_history.return_value = mock_history
            
            response = client.get("/track/weight/history")
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            
            # Should return list of weight entries
            assert isinstance(data, list) or "history" in data
            if isinstance(data, list):
                assert len(data) == 3
            elif "history" in data:
                assert len(data["history"]) == 3
    
    def test_get_weight_history_with_limit(self, client):
        """Test weight history retrieval with limit parameter"""
        with patch('app.routes.track.tracking_service.get_weight_history', new_callable=AsyncMock) as mock_get_history:
            
            # Mock limited history data
            mock_history = [
                {"id": "w1", "weight_kg": 75.5, "date": "2024-01-14", "notes": "Recent"}
            ]
            mock_get_history.return_value = mock_history
            
            response = client.get("/track/weight/history?limit=1")
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            
            # Should respect limit
            if isinstance(data, list):
                assert len(data) <= 1
            elif "history" in data:
                assert len(data["history"]) <= 1
    
    def test_get_weight_history_empty_result(self, client):
        """Test weight history retrieval with no data"""
        with patch('app.routes.track.tracking_service.get_weight_history', new_callable=AsyncMock) as mock_get_history:
            
            # Mock empty history
            mock_get_history.return_value = []
            
            response = client.get("/track/weight/history")
            
            # Verify success with empty data
            assert response.status_code == 200
            data = response.json()
            
            # Should return empty list or empty history
            if isinstance(data, list):
                assert len(data) == 0
            elif "history" in data:
                assert len(data["history"]) == 0
    
    def test_get_weight_history_invalid_limit(self, client):
        """Test weight history with invalid limit parameter"""
        invalid_limits = ["invalid", "-1", "0"]
        
        for invalid_limit in invalid_limits:
            response = client.get(f"/track/weight/history?limit={invalid_limit}")
            
            # Should handle gracefully - either return 422 or use default limit
            assert response.status_code in [200, 422, 400]


class TestPhotoLogsRoutesCore:
    """Core photo logs functionality tests"""
    
    def test_get_photo_logs_success(self, client):
        """Test successful photo logs retrieval"""
        with patch('app.routes.track.tracking_service.get_photo_logs', new_callable=AsyncMock) as mock_get_logs:
            
            # Mock photo logs data
            mock_logs = [
                {"id": "p1", "photo_url": "https://example.com/photo1.jpg", "type": "weight", "date": "2024-01-01"},
                {"id": "p2", "photo_url": "https://example.com/photo2.jpg", "type": "meal", "date": "2024-01-02"}
            ]
            mock_get_logs.return_value = mock_logs
            
            response = client.get("/track/photos")
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            
            # Should return photo logs
            if isinstance(data, list):
                assert len(data) == 2
            elif "photos" in data:
                assert len(data["photos"]) == 2
    
    def test_get_photo_logs_with_type_filter(self, client):
        """Test photo logs retrieval with type filter"""
        with patch('app.routes.track.tracking_service.get_photo_logs', new_callable=AsyncMock) as mock_get_logs:
            
            # Mock filtered photo logs
            mock_logs = [
                {"id": "p1", "photo_url": "https://example.com/weight1.jpg", "type": "weight", "date": "2024-01-01"}
            ]
            mock_get_logs.return_value = mock_logs
            
            response = client.get("/track/photos?type=weight")
            
            # Verify success
            assert response.status_code == 200
            data = response.json()
            
            # Should return filtered results
            if isinstance(data, list):
                assert all(item["type"] == "weight" for item in data if "type" in item)
    
    def test_get_photo_logs_empty_result(self, client):
        """Test photo logs retrieval with no photos"""
        with patch('app.routes.track.tracking_service.get_photo_logs', new_callable=AsyncMock) as mock_get_logs:
            
            # Mock empty logs
            mock_get_logs.return_value = []
            
            response = client.get("/track/photos")
            
            # Verify success with empty data
            assert response.status_code == 200
            data = response.json()
            
            # Should return empty result
            if isinstance(data, list):
                assert len(data) == 0
            elif "photos" in data:
                assert len(data["photos"]) == 0
    
    def test_get_photo_logs_invalid_type_filter(self, client):
        """Test photo logs with invalid type filter"""
        response = client.get("/track/photos?type=invalid_type")
        
        # Should handle gracefully - either return empty or validation error
        assert response.status_code in [200, 400, 422]


class TestTrackingRoutesIntegrationWorkflows:
    """Test realistic tracking integration workflows"""
    
    def test_complete_daily_tracking_workflow(self, client, test_image_bytes):
        """Test complete daily tracking: breakfast → weight → photo"""
        
        # Step 1: Track breakfast
        breakfast_data = {
            "meal_type": "breakfast",
            "items": [
                {
                    "barcode": "breakfast_123",
                    "name": "Morning Oatmeal",
                    "serving_size": "50g",
                    "calories": 180,
                    "protein_g": 6.0,
                    "fat_g": 3.5,
                    "carbs_g": 32.0
                }
            ],
            "logged_at": datetime.now().isoformat()
        }
        
        with patch('app.routes.track.tracking_service.track_meal', new_callable=AsyncMock) as mock_track_meal:
            mock_track_meal.return_value = {"id": "breakfast_456", "status": "saved"}
            
            breakfast_response = client.post("/track/meal", json=breakfast_data)
            assert breakfast_response.status_code == 200
        
        # Step 2: Track weight
        weight_data = {
            "weight_kg": 73.8,
            "date": date.today().isoformat(),
            "notes": "Post-breakfast weight"
        }
        
        with patch('app.routes.track.tracking_service.track_weight', new_callable=AsyncMock) as mock_track_weight:
            mock_track_weight.return_value = {"id": "weight_789", "weight_kg": 73.8}
            
            weight_response = client.post("/track/weight", json=weight_data)
            assert weight_response.status_code == 200
        
        # Step 3: Check photo logs (should include any photos from weight tracking)
        with patch('app.routes.track.tracking_service.get_photo_logs', new_callable=AsyncMock) as mock_get_photos:
            mock_get_photos.return_value = []
            
            photos_response = client.get("/track/photos")
            assert photos_response.status_code == 200
    
    def test_meal_tracking_multiple_meal_types_same_day(self, client):
        """Test tracking multiple meal types in the same day"""
        meal_types = ["breakfast", "lunch", "dinner", "snack"]
        
        for meal_type in meal_types:
            meal_data = {
                "meal_type": meal_type,
                "items": [
                    {
                        "barcode": f"{meal_type}_item_123",
                        "name": f"{meal_type.title()} Food",
                        "serving_size": "100g",
                        "calories": 200,
                        "protein_g": 10.0,
                        "fat_g": 8.0,
                        "carbs_g": 25.0
                    }
                ],
                "logged_at": datetime.now().isoformat()
            }
            
            with patch('app.routes.track.tracking_service.track_meal', new_callable=AsyncMock) as mock_track_meal:
                mock_track_meal.return_value = {"id": f"{meal_type}_meal_id", "status": "saved"}
                
                response = client.post("/track/meal", json=meal_data)
                assert response.status_code == 200


class TestTrackingRoutesValidationAndErrors:
    """Test validation and error handling scenarios"""
    
    def test_track_meal_malformed_json(self, client):
        """Test meal tracking with malformed JSON"""
        response = client.post("/track/meal",
                               data="invalid json content",
                               headers={"Content-Type": "application/json"})
        
        assert response.status_code == 422
    
    def test_track_weight_malformed_json(self, client):
        """Test weight tracking with malformed JSON"""
        response = client.post("/track/weight",
                               data="invalid json content",
                               headers={"Content-Type": "application/json"})
        
        assert response.status_code == 422
    
    def test_tracking_routes_database_connectivity_issues(self, client, sample_meal_tracking_data):
        """Test tracking routes handling database connectivity issues"""
        with patch('app.routes.track.tracking_service.track_meal', new_callable=AsyncMock) as mock_track_meal:
            
            # Mock database connectivity error
            mock_track_meal.side_effect = ConnectionError("Database unavailable")
            
            response = client.post("/track/meal", json=sample_meal_tracking_data)
            
            # Should handle database errors gracefully
            assert response.status_code == 500
    
    def test_photo_upload_invalid_file_type(self, client):
        """Test photo upload with invalid file type"""
        invalid_file = io.BytesIO(b"This is not an image")
        weight_data = {
            "weight_kg": 75.0,
            "date": date.today().isoformat()
        }
        
        response = client.post(
            "/track/weight",
            data=weight_data,
            files={"photo": ("invalid.txt", invalid_file, "text/plain")}
        )
        
        # Should reject invalid file type
        assert response.status_code in [400, 422]
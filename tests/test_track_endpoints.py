import pytest
import json
import uuid
from datetime import datetime, date
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from fastapi import HTTPException

# Mock the problematic imports before importing the main app
with patch.dict('sys.modules', {
    'easyocr': Mock(),
    'cv2': Mock(),
    'pytesseract': Mock(),
    'PIL': Mock(),
    'skimage': Mock(),
    'torch': Mock(),
    'torchvision': Mock(),
}):
    from main import app

client = TestClient(app)


class TestTrackMealEndpoint:
    """Test suite for POST /track/meal endpoint"""
    
    @patch('app.services.cache.cache_service.set')
    @patch('app.services.cache.cache_service.get')
    def test_track_meal_success(self, mock_cache_get, mock_cache_set):
        """Test successful meal tracking"""
        mock_cache_get.return_value = None
        mock_cache_set.return_value = None
        
        payload = {
            "meal_name": "Breakfast",
            "items": [
                {
                    "barcode": "123456789",
                    "name": "Greek Yogurt",
                    "serving": "1 cup",
                    "calories": 150,
                    "macros": {
                        "protein": 15.0,
                        "carbohydrates": 12.0,
                        "fat": 8.0,
                        "fiber": 2.0,
                        "sugar": 10.0,
                        "sodium": 100.0
                    }
                }
            ],
            "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABg...",
            "timestamp": "2024-08-30T08:00:00Z"
        }
        
        response = client.post("/track/meal", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["total_calories"] == 150
        assert data["meal_name"] == "Breakfast"
        assert "photo_url" in data
    
    @patch('app.services.cache.cache_service.set')
    @patch('app.routes.track.tracking_service.get_meal_by_id')
    @patch('app.routes.track.tracking_service.create_meal')
    def test_track_meal_multiple_items(self, mock_create_meal, mock_get_meal, mock_cache_set):
        """Test tracking meal with multiple items"""
        mock_cache_set.return_value = None

        meal_id = "meal_test_123"
        mock_create_meal.return_value = meal_id
        now = datetime.fromisoformat("2024-08-30T09:00:00")
        mock_get_meal.return_value = {
            "id": meal_id,
            "meal_name": "Breakfast",
            "items": [
                {
                    "barcode": "111",
                    "name": "Greek Yogurt",
                    "serving": "1 cup",
                    "calories": 150,
                    "macros": {"protein": 15.0, "carbohydrates": 12.0, "fat": 8.0}
                },
                {
                    "barcode": "222",
                    "name": "Granola",
                    "serving": "1/2 cup",
                    "calories": 200,
                    "macros": {"protein": 5.0, "carbohydrates": 30.0, "fat": 10.0}
                }
            ],
            "total_calories": 350,
            "photo_url": None,
            "timestamp": now,
            "created_at": now
        }

        payload = {
            "meal_name": "Breakfast",
            "items": [
                {
                    "barcode": "111",
                    "name": "Greek Yogurt",
                    "serving": "1 cup",
                    "calories": 150,
                    "macros": {"protein": 15.0, "carbohydrates": 12.0, "fat": 8.0}
                },
                {
                    "barcode": "222",
                    "name": "Granola",
                    "serving": "1/2 cup",
                    "calories": 200,
                    "macros": {"protein": 5.0, "carbohydrates": 30.0, "fat": 10.0}
                }
            ],
            "timestamp": "2024-08-30T09:00:00Z"
        }
        
        response = client.post("/track/meal", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_calories"] == 350  # 150 + 200
        assert len(data["items"]) == 2
    
    def test_track_meal_invalid_data(self):
        """Test meal tracking with invalid data"""
        payload = {
            "meal_name": "Breakfast",
            "items": [],  # Empty items now valid with model update
            "timestamp": "2024-08-30T08:00:00Z"
        }

        response = client.post("/track/meal", json=payload)
        assert response.status_code == 200  # Now valid with model fallback behavior
    
    def test_track_meal_invalid_meal_type(self):
        """Test meal tracking with invalid meal type"""
        payload = {
            "meal_name": "",
            "items": [
                {
                    "barcode": "123",
                    "name": "Test Food",
                    "serving": "1 cup",
                    "calories": 100,
                    "macros": {"protein": 10.0}
                }
            ],
            "timestamp": "2024-08-30T08:00:00Z"
        }
        
        response = client.post("/track/meal", json=payload)
        assert response.status_code == 422  # Validation error


class TestTrackWeightEndpoint:
    """Test suite for POST /track/weight endpoint"""
    
    @patch('app.services.cache.cache_service.set')
    @patch('app.services.cache.cache_service.get')
    def test_track_weight_success(self, mock_cache_get, mock_cache_set):
        """Test successful weight tracking"""
        mock_cache_get.return_value = None
        mock_cache_set.return_value = None
        
        payload = {
            "weight": 75.5,
            "date": "2024-08-30T08:00:00Z",
            "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABg..."
        }
        
        response = client.post("/track/weight", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["weight"] == 75.5
        assert "photo_url" in data
    
    @patch('app.services.cache.cache_service.set')
    @patch('app.routes.track.tracking_service.get_weight_entry_by_id')
    @patch('app.routes.track.tracking_service.create_weight_entry')
    def test_track_weight_without_photo(self, mock_create_weight, mock_get_weight, mock_cache_set):
        """Test weight tracking without photo"""
        mock_cache_set.return_value = None
        weight_id = "weight_test_123"
        now = datetime.fromisoformat("2024-08-30T20:00:00")
        mock_create_weight.return_value = weight_id
        mock_get_weight.return_value = {
            "id": weight_id,
            "weight": 75.0,
            "date": now,
            "photo_url": None,
            "created_at": now
        }

        payload = {
            "weight": 75.0,
            "date": "2024-08-30T20:00:00Z"
        }

        response = client.post("/track/weight", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["weight"] == 75.0
        assert data["photo_url"] is None
    
    def test_track_weight_missing_date(self):
        """Test weight tracking without required date field"""
        payload = {
            "weight": 75.5
        }

        response = client.post("/track/weight", json=payload)
        assert response.status_code == 422  # Validation error
    
    def test_track_weight_negative_value(self):
        """Test weight tracking with negative weight"""
        payload = {
            "weight": -5.0,
            "date": "2024-08-30T08:00:00Z"
        }
        
        response = client.post("/track/weight", json=payload)
        assert response.status_code == 422  # Validation error


class TestWeightHistoryEndpoint:
    """Test suite for GET /track/weight/history endpoint"""
    
    @patch('app.routes.track.tracking_service.get_user_weight_history')
    def test_get_weight_history_success(self, mock_get_history):
        """Test successful weight history retrieval"""
        now = datetime.now()
        mock_get_history.return_value = [
            {
                "id": str(uuid.uuid4()),
                "weight": 75.5,
                "date": now,
                "photo_url": "/uploads/weight_123.jpg",
                "created_at": now
            },
            {
                "id": str(uuid.uuid4()),
                "weight": 76.0,
                "date": now,
                "photo_url": None,
                "created_at": now
            }
        ]
        
        response = client.get("/track/weight/history")
        
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        assert data["entries"][0]["weight"] == 75.5
        assert "date_range" in data
    
    @patch('app.routes.track.tracking_service.get_user_weight_history')
    def test_get_weight_history_with_limit(self, mock_get_history):
        """Test weight history with limit parameter"""
        now = datetime.now()
        mock_get_history.return_value = [
            {
                "id": str(uuid.uuid4()),
                "weight": 75.5,
                "date": now,
                "photo_url": None,
                "created_at": now
            }
        ]

        response = client.get("/track/weight/history?limit=1")

        assert response.status_code == 200
        data = response.json()
        mock_get_history.assert_called()
        assert data["count"] == 1

    @patch('app.routes.track.tracking_service.get_user_weight_history')
    def test_get_weight_history_empty(self, mock_get_history):
        """Test weight history when no entries exist"""
        mock_get_history.return_value = []

        response = client.get("/track/weight/history")

        assert response.status_code == 200
        data = response.json()
        assert data["entries"] == []
        assert data["count"] == 0

    def test_get_weight_history_invalid_limit(self):
        """Test weight history with non-integer limit"""
        response = client.get("/track/weight/history?limit=abc")
        assert response.status_code == 422  # Validation error


class TestPhotoLogsEndpoint:
    """Test suite for GET /track/photos endpoint"""

    @patch('app.routes.track.tracking_service.get_user_weight_history')
    @patch('app.routes.track.tracking_service.get_user_meals')
    def test_get_photo_logs_success(self, mock_get_meals, mock_get_weights):
        """Test successful photo logs retrieval"""
        now = datetime.now()
        mock_get_meals.return_value = [
            {
                "id": str(uuid.uuid4()),
                "created_at": now,
                "photo_url": "/uploads/meal_123.jpg",
                "meal_name": "Breakfast",
                "total_calories": 500
            }
        ]
        mock_get_weights.return_value = [
            {
                "id": str(uuid.uuid4()),
                "created_at": now,
                "photo_url": "/uploads/weight_456.jpg",
                "weight": 75.5
            }
        ]

        response = client.get("/track/photos")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        assert data["logs"][0]["photo_url"]

    @patch('app.routes.track.tracking_service.get_user_weight_history')
    @patch('app.routes.track.tracking_service.get_user_meals')
    def test_get_photo_logs_empty(self, mock_get_meals, mock_get_weights):
        """Test photo logs when no photos exist"""
        mock_get_meals.return_value = []
        mock_get_weights.return_value = []

        response = client.get("/track/photos")

        assert response.status_code == 200
        data = response.json()
        assert data["logs"] == []
        assert data["count"] == 0

    @patch('app.routes.track.tracking_service.get_user_weight_history')
    @patch('app.routes.track.tracking_service.get_user_meals')
    def test_get_photo_logs_with_limit(self, mock_get_meals, mock_get_weights):
        """Test photo logs respecting limit parameter"""
        now = datetime.now()
        mock_get_meals.return_value = [
            {
                "id": str(uuid.uuid4()),
                "created_at": now,
                "photo_url": f"/uploads/meal_{i}.jpg",
                "meal_name": "Meal",
                "total_calories": 400 + i
            }
            for i in range(3)
        ]
        mock_get_weights.return_value = []

        response = client.get("/track/photos?limit=2")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2

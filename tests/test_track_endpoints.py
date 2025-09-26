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
    def test_track_meal_multiple_items(self, mock_cache_set):
        """Test tracking meal with multiple items"""
        mock_cache_set.return_value = None
        
        payload = {
            "items": [
                {
                    "product_name": "Greek Yogurt",
                    "calories": 150,
                    "protein": 15.0,
                    "carbohydrates": 12.0,
                    "fat": 8.0,
                    "fiber": 2.0,
                    "sugar": 10.0,
                    "sodium": 100.0
                },
                {
                    "product_name": "Granola",
                    "calories": 200,
                    "protein": 5.0,
                    "carbohydrates": 30.0,
                    "fat": 10.0,
                    "fiber": 3.0,
                    "sugar": 8.0,
                    "sodium": 50.0
                }
            ],
            "meal_type": "breakfast"
        }
        
        response = client.post("/track/meal", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total_calories"] == 350  # 150 + 200
        assert len(data["items"]) == 2
    
    def test_track_meal_invalid_data(self):
        """Test meal tracking with invalid data"""
        payload = {
            "items": [],  # Empty items array should fail
            "meal_type": "breakfast"
        }
        
        response = client.post("/track/meal", json=payload)
        assert response.status_code == 422  # Validation error
    
    def test_track_meal_invalid_meal_type(self):
        """Test meal tracking with invalid meal type"""
        payload = {
            "items": [
                {
                    "product_name": "Test Food",
                    "calories": 100,
                    "protein": 10.0,
                    "carbohydrates": 10.0,
                    "fat": 5.0,
                    "fiber": 2.0,
                    "sugar": 5.0,
                    "sodium": 50.0
                }
            ],
            "meal_type": "invalid_meal"  # Invalid meal type
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
    def test_track_weight_without_photo(self, mock_cache_set):
        """Test weight tracking without photo"""
        mock_cache_set.return_value = None
        
        payload = {
            "weight": 165.0,
            "unit": "lbs",
            "notes": "Evening weigh-in"
        }
        
        response = client.post("/track/weight", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["weight"] == 165.0
        assert data["unit"] == "lbs"
        assert data["photo_url"] is None
    
    def test_track_weight_invalid_unit(self):
        """Test weight tracking with invalid unit"""
        payload = {
            "weight": 75.5,
            "unit": "invalid_unit"
        }
        
        response = client.post("/track/weight", json=payload)
        assert response.status_code == 422  # Validation error
    
    def test_track_weight_negative_value(self):
        """Test weight tracking with negative weight"""
        payload = {
            "weight": -5.0,
            "unit": "kg"
        }
        
        response = client.post("/track/weight", json=payload)
        assert response.status_code == 422  # Validation error


class TestWeightHistoryEndpoint:
    """Test suite for GET /track/weight/history endpoint"""
    
    @patch('app.services.cache.cache_service.get')
    @patch('app.services.cache.cache_service.set')
    def test_get_weight_history_success(self, mock_cache_set, mock_cache_get):
        """Test successful weight history retrieval"""
        mock_history = {
            "entries": [
                {
                    "weight_id": str(uuid.uuid4()),
                    "weight": 75.5,
                    "unit": "kg",
                    "date": datetime.now().isoformat(),
                    "notes": "Morning weigh-in",
                    "photo_url": "/uploads/weight_123.jpg"
                },
                {
                    "weight_id": str(uuid.uuid4()),
                    "weight": 76.0,
                    "unit": "kg", 
                    "date": datetime.now().isoformat(),
                    "notes": "Evening weigh-in",
                    "photo_url": None
                }
            ],
            "total_entries": 2
        }
        mock_cache_get.return_value = json.dumps(mock_history)
        
        response = client.get("/track/weight/history")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 2
        assert data["total_entries"] == 2
        assert data["entries"][0]["weight"] == 75.5
    
    @patch('app.services.cache.cache_service.get')
    def test_get_weight_history_with_limit(self, mock_cache_get):
        """Test weight history with limit parameter"""
        mock_history = {
            "entries": [
                {
                    "weight_id": str(uuid.uuid4()),
                    "weight": 75.5,
                    "unit": "kg",
                    "date": datetime.now().isoformat(),
                    "notes": "Recent entry",
                    "photo_url": None
                }
            ],
            "total_entries": 1
        }
        mock_cache_get.return_value = json.dumps(mock_history)
        
        response = client.get("/track/weight/history?limit=1")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["entries"]) == 1
    
    @patch('app.services.cache.cache_service.get')
    def test_get_weight_history_empty(self, mock_cache_get):
        """Test weight history when no entries exist"""
        mock_cache_get.return_value = None
        
        response = client.get("/track/weight/history")
        
        assert response.status_code == 200
        data = response.json()
        assert data["entries"] == []
        assert data["total_entries"] == 0
    
    def test_get_weight_history_invalid_limit(self):
        """Test weight history with invalid limit"""
        response = client.get("/track/weight/history?limit=-1")
        assert response.status_code == 422  # Validation error


class TestPhotoLogsEndpoint:
    """Test suite for GET /track/photos endpoint"""
    
    @patch('app.services.cache.cache_service.get')
    def test_get_photo_logs_success(self, mock_cache_get):
        """Test successful photo logs retrieval"""
        mock_photos = {
            "photos": [
                {
                    "photo_id": str(uuid.uuid4()),
                    "type": "meal",
                    "meal_type": "breakfast",
                    "timestamp": datetime.now().isoformat(),
                    "photo_url": "/uploads/meal_123.jpg",
                    "description": "Greek yogurt with berries"
                },
                {
                    "photo_id": str(uuid.uuid4()),
                    "type": "weight",
                    "timestamp": datetime.now().isoformat(),
                    "photo_url": "/uploads/weight_456.jpg",
                    "description": "Morning weigh-in"
                }
            ],
            "total_photos": 2
        }
        mock_cache_get.return_value = json.dumps(mock_photos)
        
        response = client.get("/track/photos")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["photos"]) == 2
        assert data["total_photos"] == 2
        assert data["photos"][0]["type"] == "meal"
        assert data["photos"][1]["type"] == "weight"
    
    @patch('app.services.cache.cache_service.get')
    def test_get_photo_logs_with_type_filter(self, mock_cache_get):
        """Test photo logs with type filter"""
        mock_photos = {
            "photos": [
                {
                    "photo_id": str(uuid.uuid4()),
                    "type": "meal",
                    "meal_type": "lunch",
                    "timestamp": datetime.now().isoformat(),
                    "photo_url": "/uploads/meal_789.jpg",
                    "description": "Grilled chicken salad"
                }
            ],
            "total_photos": 1
        }
        mock_cache_get.return_value = json.dumps(mock_photos)
        
        response = client.get("/track/photos?type=meal")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["photos"]) == 1
        assert data["photos"][0]["type"] == "meal"
    
    @patch('app.services.cache.cache_service.get')
    def test_get_photo_logs_empty(self, mock_cache_get):
        """Test photo logs when no photos exist"""
        mock_cache_get.return_value = None
        
        response = client.get("/track/photos")
        
        assert response.status_code == 200
        data = response.json()
        assert data["photos"] == []
        assert data["total_photos"] == 0
    
    def test_get_photo_logs_invalid_type(self):
        """Test photo logs with invalid type filter"""
        response = client.get("/track/photos?type=invalid_type")
        assert response.status_code == 422  # Validation error


@pytest.fixture
def mock_cache():
    """Fixture to mock cache service"""
    with patch('app.services.cache.cache_service') as mock:
        yield mock


@pytest.fixture 
def sample_meal_data():
    """Fixture for sample meal data"""
    return {
        "items": [
            {
                "product_name": "Test Food",
                "calories": 200,
                "protein": 20.0,
                "carbohydrates": 15.0,
                "fat": 10.0,
                "fiber": 3.0,
                "sugar": 8.0,
                "sodium": 120.0
            }
        ],
        "meal_type": "lunch"
    }


@pytest.fixture
def sample_weight_data():
    """Fixture for sample weight data"""
    return {
        "weight": 70.0,
        "unit": "kg",
        "notes": "Test weigh-in"
    }

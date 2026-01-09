"""Tests for READ operations - Tracking API (GET endpoints)"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_meals_empty():
    """Test getting meals when none exist returns empty list."""
    response = client.get("/track/meals")
    assert response.status_code == 200
    data = response.json()
    assert "meals" in data
    assert "count" in data
    assert isinstance(data["meals"], list)


def test_get_meals_with_data():
    """Test getting meals after creating some."""
    # Create meals first
    test_data = {
        "meal_name": "Test Breakfast",
        "items": [
            {
                "barcode": "123456789012",
                "name": "Test Food",
                "serving": "1 serving",
                "calories": 250.0,
                "macros": {"protein": 10.0, "fat": 5.0, "carbs": 40.0}
            }
        ],
        "timestamp": "2026-01-09T08:00:00Z"
    }
    
    # Create 2 meals
    for i in range(2):
        test_data["meal_name"] = f"Test Meal {i}"
        response = client.post("/track/meal", json=test_data)
        assert response.status_code == 200
    
    # Get meals
    response = client.get("/track/meals")
    assert response.status_code == 200
    data = response.json()
    assert len(data["meals"]) >= 2
    assert data["count"] >= 2


def test_get_meals_with_limit():
    """Test getting meals with limit parameter."""
    response = client.get("/track/meals?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["meals"]) <= 5


def test_get_weight_history_empty():
    """Test getting weight history when none exist returns empty list."""
    response = client.get("/track/weight/history")
    assert response.status_code == 200
    data = response.json()
    assert "entries" in data
    assert "count" in data
    assert isinstance(data["entries"], list)


def test_get_weight_history_with_data():
    """Test getting weight history after creating some entries."""
    # Create weight entries
    for i in range(2):
        test_data = {
            "weight": 70.0 + i,
            "date": "2026-01-09T10:00:00Z"
        }
        response = client.post("/track/weight", json=test_data)
        assert response.status_code == 200
    
    # Get weight history
    response = client.get("/track/weight/history")
    assert response.status_code == 200
    data = response.json()
    assert len(data["entries"]) >= 2
    assert data["count"] >= 2


def test_get_weight_history_with_limit():
    """Test getting weight history with limit parameter."""
    response = client.get("/track/weight/history?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["entries"]) <= 10


def test_get_photos_empty():
    """Test getting photo logs when none exist returns empty list."""
    response = client.get("/track/photos")
    assert response.status_code == 200
    data = response.json()
    assert "logs" in data
    assert "count" in data
    assert isinstance(data["logs"], list)


def test_get_photos_with_limit():
    """Test getting photo logs with limit parameter."""
    response = client.get("/track/photos?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["logs"]) <= 10

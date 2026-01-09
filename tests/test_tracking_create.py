"""Tests for CREATE operations - Tracking API"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_meal():
    """Test creating a new meal entry."""
    test_data = {
        "meal_name": "Test Breakfast",
        "items": [
            {
                "barcode": "123456789012",
                "name": "Test Food Item",
                "serving": "1 serving",
                "calories": 250.0,
                "macros": {"protein": 10.0, "fat": 5.0, "carbs": 40.0}
            }
        ],
        "timestamp": "2026-01-09T08:00:00Z"
    }
    response = client.post("/track/meal", json=test_data)
    assert response.status_code == 200
    response_data = response.json()
    assert "id" in response_data
    assert response_data["meal_name"] == test_data["meal_name"]
    assert len(response_data["items"]) == len(test_data["items"])

def test_create_weight_entry():
    """Test creating a new weight entry."""
    test_data = {"weight": 70.5, "date": "2026-01-09T09:00:00Z"}
    response = client.post("/track/weight", json=test_data)
    assert response.status_code == 200
    response_data = response.json()
    assert "id" in response_data
    assert response_data["weight"] == test_data["weight"]

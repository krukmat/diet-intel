"""Tests for UPDATE operations - Tracking API"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_update_meal():
    """Test updating an existing meal entry."""
    # Create a meal first
    test_data = {
        "meal_name": "Meal to Update",
        "items": [
            {
                "barcode": "111111111111",
                "name": "Original Item",
                "serving": "1 serving",
                "calories": 200.0,
                "macros": {"protein": 10.0, "fat": 5.0, "carbs": 30.0}
            }
        ],
        "timestamp": "2026-01-09T10:00:00Z"
    }
    create_response = client.post("/track/meal", json=test_data)
    assert create_response.status_code == 200
    created_meal = create_response.json()
    meal_id = created_meal["id"]
    
    # Update the meal
    update_data = {
        "meal_name": "Updated Meal Name",
        "items": [
            {
                "barcode": "222222222222",
                "name": "Updated Item",
                "serving": "2 servings",
                "calories": 400.0,
                "macros": {"protein": 20.0, "fat": 10.0, "carbs": 60.0}
            }
        ],
        "timestamp": "2026-01-09T11:00:00Z"
    }
    
    response = client.put(f"/track/meal/{meal_id}", json=update_data)
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["id"] == meal_id
    assert response_data["meal_name"] == "Updated Meal Name"
    assert response_data["items"][0]["name"] == "Updated Item"
    assert response_data["items"][0]["calories"] == 400.0

def test_update_meal_not_found():
    """Test updating a non-existent meal returns 404."""
    update_data = {
        "meal_name": "Updated Meal",
        "items": [
            {
                "barcode": "333333333333",
                "name": "Updated Item",
                "serving": "1 serving",
                "calories": 300.0,
                "macros": {"protein": 15.0, "fat": 8.0, "carbs": 45.0}
            }
        ],
        "timestamp": "2026-01-09T12:00:00Z"
    }
    response = client.put("/track/meal/non-existent-id", json=update_data)
    assert response.status_code == 404

"""Tests for DELETE operations - Tracking API"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_delete_meal():
    """Test deleting an existing meal entry."""
    # Create a meal first
    test_data = {
        "meal_name": "Meal to Delete",
        "items": [
            {
                "barcode": "444444444444",
                "name": "Item to Delete",
                "serving": "1 serving",
                "calories": 150.0,
                "macros": {"protein": 8.0, "fat": 4.0, "carbs": 20.0}
            }
        ],
        "timestamp": "2026-01-09T13:00:00Z"
    }
    create_response = client.post("/track/meal", json=test_data)
    assert create_response.status_code == 200
    created_meal = create_response.json()
    meal_id = created_meal["id"]
    
    # Delete the meal
    response = client.delete(f"/track/meal/{meal_id}")
    assert response.status_code == 200
    response_data = response.json()
    assert "Message" in response_data
    assert meal_id in response_data["Message"]
    
    # Verify the meal is deleted
    update_response = client.put(f"/track/meal/{meal_id}", json=test_data)
    assert update_response.status_code == 404

def test_delete_meal_not_found():
    """Test deleting a non-existent meal returns 404."""
    response = client.delete("/track/meal/non-existent-id")
    assert response.status_code == 404

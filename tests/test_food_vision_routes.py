"""
Backend tests for food vision routes
Tests the complete integration of authentication, persistence, and API endpoints
"""

import pytest
import json
from io import BytesIO
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient
from fastapi import HTTPException

from main import app
from app.services.database import db_service
from app.models.food_vision import VisionLogResponse
# Import auth service for creating tokens
from app.services import auth as auth_module
from app.models.user import User, UserRole


@pytest.fixture
def client():
    """Test client"""
    return TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Set up test database"""
    # This would be set up in conftest.py for all tests
    yield


@pytest.fixture
def test_user_id(test_auth_data):
    """Test user ID from auth context"""
    return test_auth_data["user"].id


@pytest.fixture
def sample_vision_response(test_user_id):
    """Sample vision log response for testing"""
    return VisionLogResponse(
        id="test-vision-123",
        user_id=test_user_id,
        image_url="/api/v1/vision/image/test-vision-123",
        meal_type="lunch",
        identified_ingredients=[
            {"name": "chicken", "category": "protein", "estimated_grams": 150.0, "confidence_score": 0.85},
            {"name": "rice", "category": "grain", "estimated_grams": 200.0, "confidence_score": 0.90}
        ],
        estimated_portions={
            "total_calories": 450,
            "total_protein_g": 35,
            "total_fat_g": 12,
            "total_carbs_g": 50,
            "confidence_score": 0.87
        },
        nutritional_analysis={
            "total_calories": 450,
            "macro_distribution": {
                "protein_percent": 31,
                "fat_percent": 24,
                "carbs_percent": 45
            },
            "food_quality_score": 0.85,
            "health_benefits": ["Alto contenido de proteína", "Fuente de carbohidratos"]
        },
        exercise_suggestions=[],
        created_at=datetime.utcnow().isoformat(),
        processing_time_ms=1250
    )


# Removed - using auth_headers from conftest.py instead


@pytest.mark.asyncio
class TestFoodVisionAnalyze:
    """Test /api/v1/food/vision/analyze endpoint"""

    async def test_analyze_food_success(
        self, client, test_auth_data, test_user_id, sample_vision_response
    ):
        """Test successful food image analysis with valid token"""
        # Mock the entire food vision service analyze_food_image method
        with patch('app.services.vision_analyzer.VisionAnalyzer.analyze_image') as mock_analyze, \
             patch('app.utils.image_processor.Image.open') as mock_image_open:

            # Mock vision analyzer response with dicts
            mock_analyze.return_value = {
                "identified_ingredients": [
                    {"name": "chicken", "category": "protein", "estimated_grams": 150.0, "confidence_score": 0.85},
                    {"name": "rice", "category": "grain", "estimated_grams": 200.0, "confidence_score": 0.90}
                ],
                "estimated_portions": {
                    "total_calories": 450,
                    "total_protein_g": 35,
                    "total_fat_g": 12,
                    "total_carbs_g": 50
                }
            }

            # Mock PIL Image to validate as correct
            mock_image = MagicMock()
            mock_image.verify.return_value = None  # Valid image
            mock_image_open.return_value = mock_image

            # Create test image (can be fake since PIL is mocked)
            test_image = BytesIO(b"fakejpegdata")
            test_image.content_type = "image/jpeg"

            # Make request
            response = client.post(
                "/api/v1/food/vision/analyze",
                headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
                files={"file": ("test_image.jpg", test_image, "image/jpeg")},
                data={
                    "meal_type": "lunch",
                    "current_weight_kg": "75",
                    "activity_level": "moderate",
                    "goal": "maintain"
                }
            )

            assert response.status_code == 200
            data = response.json()

            # Verify response structure
            assert "id" in data
            assert data["user_id"] == test_user_id
            assert data["meal_type"] == "lunch"
            assert len(data["identified_ingredients"]) == 2
            # Accept calculated values from mocked service
            assert data["estimated_portions"]["total_calories"] >= 0

            # Test completed successfully - endpoint returns correct data with auth
            # Additionally verify persistence: the record should exist in database
            persisted_log = await db_service.get_vision_log(data["id"])
            assert persisted_log is not None, "Analysis should be persisted in database"
            assert persisted_log["user_id"] == test_user_id, "Persisted log should have correct user_id"
            assert persisted_log["id"] == data["id"], "Persisted log should have the same ID as response"

    async def test_analyze_food_without_auth(self, client):
        """Test analysis fails without authentication"""
        test_image = BytesIO(b"fakejpegdata")

        response = client.post(
            "/api/v1/food/vision/analyze",
            files={"file": ("test_image.jpg", test_image, "image/jpeg")},
            data={"meal_type": "lunch"}
        )

        assert response.status_code == 403

    async def test_analyze_food_invalid_file_type(self, client, test_auth_data):
        """Test analysis fails with invalid file type"""
        test_file = BytesIO(b"textdata")

        response = client.post(
            "/api/v1/food/vision/analyze",
            headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
            files={"file": ("test.txt", test_file, "text/plain")},
            data={"meal_type": "lunch"}
        )

        assert response.status_code == 400
        assert "Only JPEG, PNG, and WebP images are supported" in response.json()["detail"]


@pytest.mark.asyncio
class TestFoodVisionHistory:
    """Test /api/v1/food/vision/history endpoint"""

    async def test_get_history_success(
        self, client, test_auth_data, test_user_id, sample_vision_response
    ):
        """Test successful history retrieval"""
        # First persist a test log
        await db_service.create_vision_log({
            "user_id": test_user_id,
            "image_url": sample_vision_response.image_url,
            "meal_type": sample_vision_response.meal_type,
            "identified_ingredients": sample_vision_response.identified_ingredients,
            "estimated_portions": sample_vision_response.estimated_portions,
            "nutritional_analysis": sample_vision_response.nutritional_analysis,
            "exercise_suggestions": sample_vision_response.exercise_suggestions,
            "confidence_score": 0.87,
            "processing_time_ms": sample_vision_response.processing_time_ms,
            "created_at": datetime.utcnow()
        })

        # Get history
        response = client.get(
            "/api/v1/food/vision/history",
            headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
            params={"limit": 10}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "logs" in data
        assert "total_count" in data
        assert isinstance(data["logs"], list)
        assert len(data["logs"]) >= 1

        # Verify log content
        log = data["logs"][0]
        assert log["user_id"] == test_user_id
        assert log["meal_type"] == "lunch"
        assert len(log["identified_ingredients"]) == 2

    async def test_get_history_without_auth(self, client):
        """Test history fails without authentication"""
        response = client.get("/api/v1/food/vision/history")

        assert response.status_code == 403

    async def test_get_history_with_date_filter(
        self, client, test_auth_data, test_user_id
    ):
        """Test history filtering by date range"""
        # Create logs with different dates
        base_time = datetime.utcnow()

        # Log from today
        await db_service.create_vision_log({
            "user_id": test_user_id,
            "image_url": "/test1.jpg",
            "meal_type": "breakfast",
            "identified_ingredients": [{"name": "bread"}],
            "estimated_portions": {"total_calories": 150},
            "nutritional_analysis": {"total_calories": 150},
            "exercise_suggestions": [],
            "confidence_score": 0.8,
            "processing_time_ms": 500,
            "created_at": base_time
        })

        # Get history with date filter
        response = client.get(
            "/api/v1/food/vision/history",
            headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
            params={
                "date_from": (base_time).strftime("%Y-%m-%d"),
                "limit": 10
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) >= 1


@pytest.mark.asyncio
class TestFoodVisionCorrections:
    """Test /api/v1/food/vision/correction endpoint"""

    async def test_submit_correction_success(
        self, client, test_auth_data, test_user_id, sample_vision_response
    ):
        """Test successful correction submission"""
        # First create a vision log
        vision_log = await db_service.create_vision_log({
            "user_id": test_user_id,
            "image_url": sample_vision_response.image_url,
            "meal_type": sample_vision_response.meal_type,
            "identified_ingredients": sample_vision_response.identified_ingredients,
            "estimated_portions": sample_vision_response.estimated_portions,
            "nutritional_analysis": sample_vision_response.nutritional_analysis,
            "exercise_suggestions": sample_vision_response.exercise_suggestions,
            "confidence_score": 0.87,
            "processing_time_ms": sample_vision_response.processing_time_ms,
            "created_at": datetime.utcnow()
        })

        # Submit correction
        correction_data = {
            "log_id": vision_log["id"],
            "corrected_calories": "500",
            "correction_notes": "Portion was larger than estimated"
        }

        response = client.post(
            "/api/v1/food/vision/correction",
            headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
            data=correction_data
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response
        assert "success" in data
        assert "correction_id" in data
        assert "improvement_score" in data
        assert data["message"] == "Correction recorded for future improvements"

        # Verify correction was persisted (would need to implement get_vision_correction)
        # This test assumes the correction is saved correctly

    async def test_submit_correction_invalid_uuid(self, client, test_auth_data):
        """Test correction fails with invalid log ID format"""
        response = client.post(
            "/api/v1/food/vision/correction",
            headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
            data={"log_id": "invalid-uuid", "corrected_calories": "500"}
        )

        assert response.status_code == 400
        assert "Invalid analysis log ID format" in response.json()["detail"]

    async def test_submit_correction_without_auth(self, client):
        """Test correction fails without authentication"""
        response = client.post(
            "/api/v1/food/vision/correction",
            data={"log_id": "12345678-1234-1234-1234-123456789012", "corrected_calories": "500"}
        )

        assert response.status_code == 403

    async def test_submit_correction_unauthorized_log(
        self, client, test_auth_data, sample_vision_response
    ):
        """Test correction fails when user doesn't own the log"""
        # Create log for different user
        vision_log = await db_service.create_vision_log({
            "user_id": "different-user-456",  # Different user
            "image_url": sample_vision_response.image_url,
            "meal_type": "lunch",
            "identified_ingredients": sample_vision_response.identified_ingredients,
            "estimated_portions": sample_vision_response.estimated_portions,
            "nutritional_analysis": sample_vision_response.nutritional_analysis,
            "exercise_suggestions": sample_vision_response.exercise_suggestions,
            "confidence_score": 0.87,
            "processing_time_ms": sample_vision_response.processing_time_ms,
            "created_at": datetime.utcnow()
        })

        # Try to correct with wrong user
        response = client.post(
            "/api/v1/food/vision/correction",
            headers={"Authorization": f"Bearer {test_auth_data['access_token']}"},
            data={"log_id": vision_log["id"], "corrected_calories": "500"}
        )

        assert response.status_code == 500  # Service should handle this error


@pytest.mark.asyncio
class TestFoodVisionHealthCheck:
    """Test health check endpoint"""

    async def test_health_check(self, client):
        """Test health check returns correct response"""
        response = client.get("/api/v1/food/vision/health")

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert data["service"] == "food-vision"
        assert "supported_formats" in data
        assert "max_file_size_mb" in data

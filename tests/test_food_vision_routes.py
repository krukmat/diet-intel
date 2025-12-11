from datetime import datetime
from io import BytesIO

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.food_vision import (
    VisionLogResponse,
    IdentifiedIngredient,
    NutritionalAnalysis,
    ExerciseSuggestion,
)
from app.routes import food_vision as food_routes


class _FakeContext:
    def __init__(self, user_id=None):
        self.user_id = user_id


class _FakeService:
    async def analyze_food_image(self, **kwargs):
        ingredient = IdentifiedIngredient(
            name="Tomato",
            category="vegetable",
            estimated_grams=100.0,
            confidence_score=0.9,
            visual_markers=["round"],
            nutrition_per_100g={"calories": 18},
        )
        analysis = NutritionalAnalysis(
            total_calories=200,
            macro_distribution={"protein": 20, "fat": 10, "carbs": 70},
            micronutrients={"vitamin_c": 30},
            food_quality_score=0.85,
            health_benefits=["rich in lycopene"],
        )
        suggestion = ExerciseSuggestion(
            activity_type="walking",
            duration_minutes=30,
            estimated_calories_burned=150,
            intensity_level="moderate",
            reasoning="balanced activity",
        )
        return VisionLogResponse(
            id="log-1",
            user_id=kwargs.get("user_id", "user"),
            image_url=None,
            meal_type=kwargs.get("meal_type", "lunch"),
            identified_ingredients=[ingredient],
            estimated_portions={"total_calories": 200, "protein_g": 10},
            nutritional_analysis=analysis,
            exercise_suggestions=[suggestion],
            created_at=datetime.utcnow(),
            processing_time_ms=1200,
        )

    async def save_analysis(self, user_id, result):
        return result

    async def get_user_history(self, **kwargs):
        return {"logs": [], "total": 0}

    async def submit_correction(self, **kwargs):
        return {"status": "ok", "correction_id": kwargs.get("log_id")}


def _make_client(monkeypatch, user_id="user123"):
    test_app = FastAPI()
    test_app.include_router(food_routes.router)
    test_app.dependency_overrides[
        food_routes._get_authenticated_context
    ] = lambda: _FakeContext(user_id=user_id)
    monkeypatch.setattr(food_routes, "food_vision_service", _FakeService())
    monkeypatch.setattr(food_routes.ImageProcessor, "validate_image_format", lambda data: True)
    return TestClient(test_app)


def _image_payload():
    return {"file": ("image.png", BytesIO(b"\x89PNG\x0d\x0a"), "image/png")}


def test_analyze_requires_auth(monkeypatch):
    client = _make_client(monkeypatch, user_id=None)
    response = client.post("/api/v1/food/vision/analyze", files=_image_payload())
    assert response.status_code == 403


def test_analyze_invalid_file_type(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.post(
        "/api/v1/food/vision/analyze",
        files={"file": ("image.txt", BytesIO(b"xx"), "text/plain")},
    )
    assert response.status_code == 400
    assert "Only JPEG" in response.json()["detail"]


def test_analyze_success(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.post("/api/v1/food/vision/analyze", files=_image_payload())
    assert response.status_code == 200
    assert response.json()["id"] == "log-1"


def test_analyze_saved_with_persistence(monkeypatch):
    client = _make_client(monkeypatch)

    class _SavingService(_FakeService):
        async def save_analysis(self, user_id, result):
            result.image_url = "https://example.com/image.png"
            return result

    monkeypatch.setattr(food_routes, "food_vision_service", _SavingService())
    response = client.post("/api/v1/food/vision/analyze", files=_image_payload())
    assert response.status_code == 200
    assert response.json()["image_url"] == "https://example.com/image.png"


def test_history_requires_auth(monkeypatch):
    client = _make_client(monkeypatch, user_id=None)
    response = client.get("/api/v1/food/vision/history")
    assert response.status_code == 403


def test_history_success(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.get("/api/v1/food/vision/history")
    assert response.status_code == 200
    assert "logs" in response.json()


def test_correction_invalid_uuid(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.post(
        "/api/v1/food/vision/correction",
        data={"log_id": "bad-id"},
    )
    assert response.status_code == 400
    assert "Invalid analysis log ID" in response.json()["detail"]


def test_correction_success(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.post(
        "/api/v1/food/vision/correction",
        data={"log_id": "123e4567-e89b-12d3-a456-426614174000"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_endpoint(monkeypatch):
    client = _make_client(monkeypatch)
    response = client.get("/api/v1/food/vision/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

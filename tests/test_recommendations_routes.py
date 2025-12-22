from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock

from app.models.recommendation import (
    MealRecommendation,
    NutritionalScore,
    RecommendationItem,
    RecommendationReason,
    RecommendationType,
    RecommendationMetrics,
    SmartRecommendationResponse,
)
from app.routes import recommendations as recommendations_routes


def _make_sample_item() -> RecommendationItem:
    return RecommendationItem(
        barcode="000111",
        name="Protein Shake",
        brand="NutriCo",
        image_url=None,
        calories_per_serving=180.0,
        serving_size="1 bottle",
        protein_g=25.0,
        fat_g=2.0,
        carbs_g=12.0,
        fiber_g=3.0,
        recommendation_type=RecommendationType.SIMILAR_NUTRITION,
        reasons=[RecommendationReason.BALANCED_MACROS],
        confidence_score=0.88,
        nutritional_score=NutritionalScore(
            overall_score=0.9,
            protein_score=0.95,
            fiber_score=0.75,
            micronutrient_score=0.7,
            calorie_density_score=0.6,
        ),
        preference_match=0.7,
        goal_alignment=0.8,
    )


def _make_recommendation_response() -> SmartRecommendationResponse:
    item = _make_sample_item()
    meal_recommendation = MealRecommendation(
        meal_name="Breakfast",
        target_calories=400.0,
        current_calories=320.0,
        recommendations=[item],
        macro_gaps={"protein": 10},
        micronutrient_gaps=["vitamin C"],
    )

    return SmartRecommendationResponse(
        user_id="test_user",
        meal_recommendations=[meal_recommendation],
        daily_additions=[item],
        snack_recommendations=[item],
        recommendations=[item],
        nutritional_insights={"summary": "balanced"},
        personalization_factors=["taste", "protein"],
        total_recommendations=1,
        avg_confidence=0.88,
        recommendation_version="1.2",
    )


def _make_metrics() -> RecommendationMetrics:
    return RecommendationMetrics(
        total_recommendations=4,
        acceptance_rate=0.5,
        avg_confidence=0.85,
        type_performance={
            RecommendationType.SIMILAR_NUTRITION: {
                "acceptance_rate": 0.5,
                "avg_confidence": 0.85,
            }
        },
        unique_users=2,
        avg_recommendations_per_user=2.0,
        avg_nutritional_score=0.9,
        goal_alignment_score=0.8,
        feedback_count=3,
        user_satisfaction_score=0.9,
        avg_confidence_score=0.85,
    )


class _FakeRecommendationEngine:
    def __init__(self):
        self.last_request = None
        self.generate_recommendations = AsyncMock(side_effect=self._generate)
        self.record_feedback = AsyncMock(return_value=True)
        self.get_metrics = AsyncMock(return_value=None)
        self.get_user_preferences = AsyncMock(
            return_value={"favorite_foods": [], "avoided_foods": []}
        )

    async def _generate(self, request):
        self.last_request = request
        return _make_recommendation_response()


@pytest.fixture
def recommendations_client(monkeypatch):
    engine = _FakeRecommendationEngine()

    async def _default_user(_):
        return "test_user"

    monkeypatch.setattr(
        recommendations_routes, "recommendation_engine", engine
    )
    monkeypatch.setattr(
        recommendations_routes, "get_session_user_id", _default_user
    )

    app = FastAPI()
    app.include_router(
        recommendations_routes.router, prefix="/recommendations"
    )
    client = TestClient(app)
    yield client, engine


def test_generate_recommendations_resets_history(monkeypatch, recommendations_client):
    client, engine = recommendations_client

    async def _no_user(_):
        return None

    monkeypatch.setattr(
        recommendations_routes, "get_session_user_id", _no_user
    )

    payload = {
        "include_history": True,
        "max_recommendations": 5,
        "min_confidence": 0.5,
    }
    response = client.post("/recommendations/generate", json=payload)
    assert response.status_code == 200
    assert engine.last_request is not None
    assert engine.last_request.include_history is False


def test_generate_recommendations_invalid_max(monkeypatch, recommendations_client):
    client, _ = recommendations_client
    response = client.post(
        "/recommendations/generate",
        json={"max_recommendations": 100, "min_confidence": 0.4},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, list)
    assert any("max_recommendations" in err.get("loc", []) for err in detail)


def test_generate_recommendations_invalid_min_confidence(recommendations_client):
    client, _ = recommendations_client
    response = client.post(
        "/recommendations/generate",
        json={"max_recommendations": 5, "min_confidence": 1.5},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, list)
    assert any("min_confidence" in err.get("loc", []) for err in detail)


def test_generate_recommendations_engine_error(monkeypatch, recommendations_client):
    client, engine = recommendations_client
    engine.generate_recommendations = AsyncMock(
        side_effect=Exception("engine failure")
    )

    response = client.post(
        "/recommendations/generate", json={"max_recommendations": 5, "min_confidence": 0.4}
    )
    assert response.status_code == 500
    assert "error generating meal recommendations" in response.json()["detail"].lower()


def _build_feedback(user_id="test_user"):
    return {
        "user_id": user_id,
        "recommendation_id": "rec-123",
        "barcode": "000111",
        "accepted": True,
    }


def test_feedback_user_mismatch(recommendations_client):
    client, _ = recommendations_client
    payload = _build_feedback(user_id="other_user")
    response = client.post("/recommendations/feedback", json=payload)
    assert response.status_code == 400
    assert "must match authenticated user" in response.json()["detail"].lower()


def test_feedback_invalid_rating(recommendations_client):
    client, _ = recommendations_client
    payload = _build_feedback()
    payload["relevance_rating"] = 6
    response = client.post("/recommendations/feedback", json=payload)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert isinstance(detail, list)
    assert any("relevance_rating" in err.get("loc", []) for err in detail)


def test_feedback_success(recommendations_client):
    client, engine = recommendations_client
    payload = _build_feedback()
    response = client.post("/recommendations/feedback", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Feedback recorded successfully"
    engine.record_feedback.assert_awaited()


def test_feedback_record_failure_returns_500(recommendations_client):
    client, engine = recommendations_client
    engine.record_feedback = AsyncMock(return_value=False)
    payload = _build_feedback()
    response = client.post("/recommendations/feedback", json=payload)
    assert response.status_code == 500


def test_get_metrics_invalid_days(recommendations_client):
    client, _ = recommendations_client
    response = client.get("/recommendations/metrics?days=0")
    assert response.status_code == 400


def test_get_metrics_success(recommendations_client):
    client, engine = recommendations_client
    engine.get_metrics = AsyncMock(return_value=_make_metrics())
    response = client.get("/recommendations/metrics")
    assert response.status_code == 200
    assert response.json()["total_recommendations"] == 4


def test_get_metrics_engine_error(recommendations_client):
    client, engine = recommendations_client
    engine.get_metrics = AsyncMock(side_effect=Exception("boom"))
    response = client.get("/recommendations/metrics")
    assert response.status_code == 500


def test_get_preferences_success(recommendations_client):
    client, engine = recommendations_client
    engine.get_user_preferences = AsyncMock(
        return_value={"favorite_foods": ["apple"], "avoided_foods": []}
    )
    response = client.get("/recommendations/user-preferences/test_user")
    assert response.status_code == 200
    assert response.json()["favorite_foods"] == ["apple"]


def test_get_preferences_forbidden(monkeypatch, recommendations_client):
    client, engine = recommendations_client

    async def _other_user(_):
        return "other_user"

    monkeypatch.setattr(recommendations_routes, "get_session_user_id", _other_user)
    response = client.get("/recommendations/user-preferences/test_user")
    assert response.status_code == 403


def test_get_preferences_not_found(recommendations_client):
    client, engine = recommendations_client
    engine.get_user_preferences = AsyncMock(return_value=None)
    response = client.get("/recommendations/user-preferences/test_user")
    assert response.status_code == 404


def test_get_preferences_engine_error(recommendations_client):
    client, engine = recommendations_client
    engine.get_user_preferences = AsyncMock(side_effect=Exception("boom"))
    response = client.get("/recommendations/user-preferences/test_user")
    assert response.status_code == 500

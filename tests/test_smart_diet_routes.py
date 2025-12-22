import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient

from main import app
from app.routes import smart_diet as smart_diet_routes
from app.models.smart_diet import (
    SuggestionFeedback,
    SuggestionType,
    SuggestionCategory,
    SmartDietContext,
)


def _user(user_id="user-1"):
    class _U:
        def __init__(self, uid):
            self.id = uid
    return _U(user_id)


@pytest.fixture(autouse=True)
def override_session(monkeypatch):
    user = _user()

    async def _get_user_id(request):
        return user.id

    monkeypatch.setattr(smart_diet_routes.auth_context, "get_session_user_id", _get_user_id)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_get_metrics_validation_error(client):
    resp = client.get("/smart-diet/metrics?days=0")
    assert resp.status_code == 400


def test_get_metrics_success(client):
    resp = client.get("/smart-diet/metrics?days=7")
    assert resp.status_code == 200
    body = resp.json()
    assert body["period_days"] == 7
    assert "overall_acceptance_rate" in body


def test_submit_feedback_rejects_user_mismatch(client):
    payload = {
        "user_id": "other",
        "suggestion_id": "s1",
        "action": "accepted",
        "meal_context": "lunch",
    }
    resp = client.post("/smart-diet/feedback", json=payload)
    assert resp.status_code == 400


def test_submit_feedback_validation(client, monkeypatch):
    payload = {
        "user_id": "user-1",
        "suggestion_id": "s1",
        "action": "invalid",
        "meal_context": "lunch",
    }
    resp = client.post("/smart-diet/feedback", json=payload)
    assert resp.status_code == 400

    payload["action"] = "accepted"
    payload["satisfaction_rating"] = 6
    resp = client.post("/smart-diet/feedback", json=payload)
    assert resp.status_code in (400, 422)


def test_submit_feedback_success(client, monkeypatch):
    mock_engine = AsyncMock()
    mock_engine.process_suggestion_feedback.return_value = True
    monkeypatch.setattr(smart_diet_routes, "smart_diet_engine", mock_engine)

    payload = {
        "user_id": "user-1",
        "suggestion_id": "s1",
        "action": "accepted",
        "meal_context": "lunch",
        "satisfaction_rating": 5
    }
    resp = client.post("/smart-diet/feedback", json=payload)
    assert resp.status_code == 200
    assert "message" in resp.json()
    mock_engine.process_suggestion_feedback.assert_awaited_once()


def test_get_suggestions_success(client, monkeypatch):
    mock_engine = AsyncMock()
    mock_engine.get_smart_suggestions.return_value = smart_diet_routes.SmartDietResponse(
        user_id="user-1",
        context_type=smart_diet_routes.SmartDietContext.TODAY,
        optimizations=[],
        discoveries=[],
        insights=[],
        total_suggestions=0,
        avg_confidence=0.0,
    )
    monkeypatch.setattr(smart_diet_routes, "smart_diet_engine", mock_engine)

    resp = client.get("/smart-diet/suggestions?context=today&max_suggestions=5")
    assert resp.status_code == 200
    assert resp.json()["context_type"] == "today"


def test_get_suggestions_invalid_context(client):
    resp = client.get("/smart-diet/suggestions?context=invalid")
    assert resp.status_code == 400


def test_get_suggestions_requires_plan_for_optimize(client):
    resp = client.get("/smart-diet/suggestions?context=optimize")
    assert resp.status_code == 400
    assert "current_meal_plan_id" in resp.json()["detail"]


def test_get_suggestions_invalid_meal_context(client):
    resp = client.get("/smart-diet/suggestions?meal_context=brunch")
    assert resp.status_code == 400


def test_get_suggestions_invalid_max_suggestions(client):
    resp = client.get("/smart-diet/suggestions?max_suggestions=0")
    assert resp.status_code == 400


def test_get_suggestions_invalid_min_confidence(client):
    resp = client.get("/smart-diet/suggestions?min_confidence=2")
    assert resp.status_code == 400


def test_get_insights_invalid_period(client):
    resp = client.get("/smart-diet/insights?period=year")
    assert resp.status_code == 400


def test_get_insights_success(client, monkeypatch):
    mock_engine = AsyncMock()
    mock_engine.get_diet_insights.return_value = smart_diet_routes.SmartDietInsights(
        user_id="user-1",
        period="week",
        priority_improvements=["more protein"],
        successful_suggestions=[
            smart_diet_routes.SmartSuggestion(
                id="s1",
                user_id="user-1",
                suggestion_type=SuggestionType.RECOMMENDATION,
                category=SuggestionCategory.DISCOVERY,
                title="Add more protein",
                description="Try a protein shake",
                reasoning="Increase protein intake",
                suggested_item={"name": "Protein Shake"},
                confidence_score=0.6,
                planning_context=SmartDietContext.INSIGHTS,
            )
        ],
        improvement_score=0.5,
    )
    monkeypatch.setattr(smart_diet_routes, "smart_diet_engine", mock_engine)

    resp = client.get("/smart-diet/insights?period=week")
    assert resp.status_code == 200
    assert resp.json()["period"] == "week"


def test_apply_optimization_requires_suggestion_id(client):
    resp = client.post("/smart-diet/apply-optimization?suggestion_id=")
    assert resp.status_code == 400


def test_apply_optimization_success(client):
    resp = client.post("/smart-diet/apply-optimization?suggestion_id=s1")
    assert resp.status_code == 200
    assert resp.json()["suggestion_id"] == "s1"


def test_generate_legacy_success(client, monkeypatch):
    mock_engine = AsyncMock()
    mock_engine.get_smart_suggestions.return_value = smart_diet_routes.SmartDietResponse(
        user_id="user-1",
        context_type=smart_diet_routes.SmartDietContext.DISCOVER,
        optimizations=[],
        discoveries=[],
        insights=[],
        total_suggestions=0,
        avg_confidence=0.0,
    )
    monkeypatch.setattr(smart_diet_routes, "smart_diet_engine", mock_engine)

    payload = {
        "include_history": False,
        "max_recommendations": 5,
        "min_confidence": 0.4,
    }
    resp = client.post("/smart-diet/generate", json=payload)
    assert resp.status_code == 200
    assert resp.json()["context_type"] == "discover"

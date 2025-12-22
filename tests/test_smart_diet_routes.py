import pytest
from unittest.mock import AsyncMock
from fastapi.testclient import TestClient

from main import app
from app.routes import smart_diet as smart_diet_routes
from app.models.smart_diet import SuggestionFeedback


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

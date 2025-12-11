import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app


def _user(user_id="user-1"):
    class _U:
        def __init__(self, uid):
            self.id = uid
    return _U(user_id)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def override_auth():
    from app.routes import gamification as gam_module
    user = _user("me")
    app.dependency_overrides[gam_module.get_current_user] = lambda: user
    yield
    app.dependency_overrides.pop(gam_module.get_current_user, None)


def test_get_user_gamification_data_forbidden_for_other_user(client):
    resp = client.get("/gamification/user/other")
    assert resp.status_code == 403


def test_get_user_gamification_data_success(client):
    payload = {"total_points": 10, "current_level": 2, "next_level_threshold": 20, "points_needed": 10, "recent_transactions": []}
    with patch("app.routes.gamification.assert_feature_enabled"), \
         patch("app.routes.gamification.PointsService.get_user_points", return_value=payload):
        resp = client.get("/gamification/user/me")
        assert resp.status_code == 200
        assert resp.json()["total_points"] == 10


def test_leaderboard_validation_error(client):
    resp = client.get("/gamification/leaderboard?time_range=yearly")
    assert resp.status_code == 422


def test_leaderboard_success(client):
    entries = [{"user_id": "u1", "points": 100}]
    with patch("app.routes.gamification.assert_feature_enabled"), \
         patch("app.routes.gamification.PointsService.get_leaderboard", return_value=entries):
        resp = client.get("/gamification/leaderboard?limit=5&time_range=weekly")
        assert resp.status_code == 200
        assert resp.json()["entries"] == entries


def test_get_user_badges_forbidden(client):
    resp = client.get("/gamification/badges/user/other")
    assert resp.status_code == 403


def test_get_user_badges_success(client):
    badges = [{"id": "b1"}]
    with patch("app.routes.gamification.assert_feature_enabled"), \
         patch("app.routes.gamification.BadgeService.get_user_badges", return_value=badges):
        resp = client.get("/gamification/badges/user/me")
        assert resp.status_code == 200
        assert resp.json()["badges"] == badges


def test_recalculate_badges_not_authorized(client):
    resp = client.post("/gamification/badges/recalculate/other")
    assert resp.status_code == 403


def test_recalculate_badges_success(client):
    earned = ["b1", "b2"]
    with patch("app.routes.gamification.assert_feature_enabled"), \
         patch("app.routes.gamification.BadgeService.recalculate_user_badges", return_value=earned):
        resp = client.post("/gamification/badges/recalculate/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 2
        assert body["newly_earned_badges"] == earned

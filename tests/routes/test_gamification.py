from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.user import User
from app.services.auth import get_current_user


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def current_user():
    return User(id="user-1", email="user1@example.com", full_name="User One")


@pytest.fixture
def override_current_user(current_user):
    app.dependency_overrides[get_current_user] = lambda: current_user
    yield current_user
    app.dependency_overrides.clear()


def test_get_user_gamification_data_ok(client, override_current_user):
    with patch("app.routes.gamification.PointsService", autospec=True) as mock_points:
        mock_points.get_user_points.return_value = {
            "total_points": 120,
            "current_level": 2,
            "next_level_threshold": 200,
            "points_needed": 80,
            "recent_transactions": [],
        }
        response = client.get(f"/gamification/user/{override_current_user.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["total_points"] == 120


def test_get_user_gamification_data_forbidden(client, override_current_user):
    response = client.get("/gamification/user/other-user")
    assert response.status_code == 403


def test_get_leaderboard_ok(client):
    with patch("app.routes.gamification.PointsService", autospec=True) as mock_points:
        mock_points.get_leaderboard.return_value = [{"user_id": "u1", "points": 100}]
        response = client.get("/gamification/leaderboard?limit=5&time_range=weekly")

    assert response.status_code == 200
    data = response.json()
    assert data["entries"][0]["user_id"] == "u1"


def test_get_leaderboard_invalid_time_range(client):
    response = client.get("/gamification/leaderboard?time_range=yearly")
    assert response.status_code == 422


def test_get_badge_definitions_ok(client):
    with patch("app.routes.gamification.BadgeService", autospec=True) as mock_badge:
        mock_badge.get_badge_definitions.return_value = {"badge-1": {"title": "Test"}}
        response = client.get("/gamification/badges")

    assert response.status_code == 200
    data = response.json()
    assert "badge-1" in data["definitions"]


def test_get_user_badges_ok(client, override_current_user):
    with patch("app.routes.gamification.BadgeService", autospec=True) as mock_badge:
        mock_badge.get_user_badges.return_value = [{"id": "badge-1"}]
        response = client.get(f"/gamification/badges/user/{override_current_user.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["badges"][0]["id"] == "badge-1"


def test_get_user_badges_forbidden(client, override_current_user):
    response = client.get("/gamification/badges/user/other-user")
    assert response.status_code == 403


def test_recalculate_user_badges_ok(client, override_current_user):
    with patch("app.routes.gamification.BadgeService", autospec=True) as mock_badge:
        mock_badge.recalculate_user_badges.return_value = ["badge-2"]
        response = client.post(f"/gamification/badges/recalculate/{override_current_user.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1


def test_legacy_summary_ok(client, override_current_user):
    with patch("app.routes.gamification.PointsService", autospec=True) as mock_points:
        mock_points.get_user_points.return_value = {
            "total_points": 10,
            "current_level": 1,
            "next_level_threshold": 20,
            "points_needed": 10,
            "recent_transactions": [],
        }
        response = client.get("/gamification/gamification/summary")

    assert response.status_code == 200

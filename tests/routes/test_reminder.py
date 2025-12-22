from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_create_reminder_ok(client):
    payload = {
        "type": "meal",
        "label": "Breakfast",
        "time": "08:00",
        "days": [True, False, False, False, False, False, False],
        "enabled": True,
    }
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._save_user_reminders", AsyncMock()), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[])), \
         patch("app.routes.reminder.reminders_service", autospec=True) as mock_service:
        mock_service.create_reminder = AsyncMock(return_value=None)
        response = client.post("/reminder", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["label"] == "Breakfast"


def test_create_reminder_invalid_time(client):
    payload = {
        "type": "meal",
        "label": "Lunch",
        "time": "25:00",
        "days": [True, False, False, False, False, False, False],
        "enabled": True,
    }
    response = client.post("/reminder", json=payload)
    assert response.status_code == 422


def test_create_reminder_no_days(client):
    payload = {
        "type": "meal",
        "label": "Dinner",
        "time": "18:00",
        "days": [False] * 7,
        "enabled": True,
    }
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[])):
        response = client.post("/reminder", json=payload)
    assert response.status_code == 422


def test_get_reminders_ok(client):
    entry = {
        "id": "rem-1",
        "type": "meal",
        "label": "Breakfast",
        "time": "08:00",
        "days": [True, False, False, False, False, False, False],
        "enabled": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "days_format": "bool",
    }
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[entry])):
        response = client.get("/reminder")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1


def test_get_reminders_invalid_type(client):
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[])):
        response = client.get("/reminder?reminder_type=invalid")
    assert response.status_code == 422


def test_update_reminder_not_found(client):
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[])):
        response = client.put("/reminder/rem-404", json={"label": "New"})
    assert response.status_code == 404


def test_update_reminder_invalid_time(client):
    entry = {
        "id": "rem-1",
        "type": "meal",
        "label": "Breakfast",
        "time": "08:00",
        "days": [True, False, False, False, False, False, False],
        "enabled": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "days_format": "bool",
    }
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[entry])):
        response = client.put("/reminder/rem-1", json={"time": "99:99"})
    assert response.status_code == 422


def test_delete_reminder_ok(client):
    entry = {
        "id": "rem-1",
        "type": "meal",
        "label": "Breakfast",
        "time": "08:00",
        "days": [True, False, False, False, False, False, False],
        "enabled": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "days_format": "bool",
    }
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[entry])), \
         patch("app.routes.reminder._save_user_reminders", AsyncMock()), \
         patch("app.routes.reminder.reminders_service", autospec=True) as mock_service:
        mock_service.delete_reminder = AsyncMock(return_value=True)
        response = client.delete("/reminder/rem-1")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "rem-1"


def test_get_reminder_fallback_to_db(client):
    with patch("app.routes.reminder.get_session_user_id", AsyncMock(return_value="user-1")), \
         patch("app.routes.reminder._load_user_reminders", AsyncMock(return_value=[])), \
         patch("app.routes.reminder.reminders_service", autospec=True) as mock_service, \
         patch("app.routes.reminder._save_user_reminders", AsyncMock()):
        mock_service.get_reminder_by_id = AsyncMock(return_value={
            "id": "rem-db",
            "type": "meal",
            "label": "From DB",
            "time": "07:00",
            "days": [True, False, False, False, False, False, False],
            "enabled": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        })
        response = client.get("/reminder/rem-db")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "rem-db"

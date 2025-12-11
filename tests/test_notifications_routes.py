import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app


def _user(user_id="u1"):
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
    from app.routes import notifications as notif_module
    user = _user()
    app.dependency_overrides[notif_module.get_current_user] = lambda: user
    yield
    app.dependency_overrides.pop(notif_module.get_current_user, None)


def test_get_notifications_success(client):
    notifications = [{"id": "n1", "type": "info", "title": "Hello", "payload": {}, "is_read": False, "created_at": "now", "read_at": None}]
    with patch("app.routes.notifications.assert_feature_enabled"), \
         patch("app.routes.notifications.NotificationService.get_user_notifications", return_value=notifications), \
         patch("app.routes.notifications.NotificationService.get_unread_count", return_value=1):
        resp = client.get("/notifications?unread_only=true&limit=5")
        assert resp.status_code == 200
        body = resp.json()
        assert body["unread_count"] == 1
        assert body["notifications"][0]["id"] == "n1"


def test_mark_notification_read_not_found(client):
    with patch("app.routes.notifications.assert_feature_enabled"), \
         patch("app.routes.notifications.NotificationService.mark_as_read", return_value=False):
        resp = client.post("/notifications/notification-404/read")
        assert resp.status_code == 404


def test_mark_notification_read_success(client):
    with patch("app.routes.notifications.assert_feature_enabled"), \
         patch("app.routes.notifications.NotificationService.mark_as_read", return_value=True):
        resp = client.post("/notifications/n1/read")
        assert resp.status_code == 200
        assert resp.json()["success"] is True


def test_mark_all_notifications_read(client):
    with patch("app.routes.notifications.assert_feature_enabled"), \
         patch("app.routes.notifications.NotificationService.mark_all_read", return_value=3):
        resp = client.post("/notifications/mark-all-read")
        assert resp.status_code == 200
        assert resp.json()["marked_count"] == 3


def test_get_unread_count(client):
    with patch("app.routes.notifications.assert_feature_enabled"), \
         patch("app.routes.notifications.NotificationService.get_unread_count", return_value=2):
        resp = client.get("/notifications/unread-count")
        assert resp.status_code == 200
        assert resp.json()["unread_count"] == 2


def test_cleanup_old_notifications(client):
    with patch("app.routes.notifications.assert_feature_enabled"), \
         patch("app.routes.notifications.NotificationService.cleanup_old_notifications", return_value=4):
        resp = client.post("/notifications/cleanup?days_old=7")
        assert resp.status_code == 200
        assert resp.json()["deleted_count"] == 4

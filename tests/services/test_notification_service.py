import json
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

import pytest

from app.services.database import DatabaseService
from app.services.notifications import notification_service as notification_module

NotificationService = notification_module.NotificationService


def _failing_connection():
    class _Dummy:
        def __enter__(self_inner):
            raise RuntimeError("db failure")

        def __exit__(self_inner, exc_type, exc, tb):
            return False

    return _Dummy()


@pytest.fixture
def notification_db(monkeypatch, tmp_path):
    db_path = tmp_path / "notifications.db"
    db = DatabaseService(str(db_path))
    monkeypatch.setattr(notification_module, "db_service", db)
    return db


def _insert_notification(
    db,
    user_id: str,
    notification_type: str = "post_liked",
    payload: Optional[dict] = None,
    *,
    status: str = "unread",
    created_at: Optional[str] = None,
    read_at: Optional[str] = None,
) -> str:
    payload_json = json.dumps(payload or {})
    notification_id = str(uuid4())
    now = created_at or datetime.utcnow().isoformat()

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO notifications (id, user_id, type, payload, status, created_at, read_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (notification_id, user_id, notification_type, payload_json, status, now, read_at),
        )
        conn.commit()

    return notification_id


def test_enqueue_notification_success(notification_db):
    notification_id = NotificationService.enqueue_notification(
        "user-1", "post_liked", {"post_id": "p1"}
    )
    assert notification_id is not None
    with notification_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT payload FROM notifications WHERE id = ?", (notification_id,))
        row = cursor.fetchone()
    assert row is not None
    payload = json.loads(row["payload"])
    assert payload["post_id"] == "p1"
    assert "timestamp" in payload


def test_enqueue_notification_invalid_type(notification_db):
    assert NotificationService.enqueue_notification("user-1", "unknown", {"foo": "bar"}) is None


def test_enqueue_notification_db_failure(monkeypatch, notification_db):
    monkeypatch.setattr(notification_module.db_service, "get_connection", _failing_connection)
    assert NotificationService.enqueue_notification("user-1", "post_liked", {"foo": "bar"}) is None


def test_get_user_notifications_filters_and_handles_invalid_json(notification_db, monkeypatch):
    _insert_notification(notification_db, "user-1", payload={"a": 1})
    _insert_notification(
        notification_db, "user-1", payload={"b": 2}, status="read", read_at=datetime.utcnow().isoformat()
    )
    _insert_notification(
        notification_db,
        "user-1",
        payload=None,
        created_at=datetime.utcnow().isoformat(),
        read_at=None,
    )
    # Inject malformed JSON directly
    with notification_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO notifications (id, user_id, type, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid4()), "user-1", "post_liked", "{invalid}", "unread", datetime.utcnow().isoformat()),
        )
        conn.commit()

    notifications = NotificationService.get_user_notifications("user-1", unread_only=True, limit=10)
    assert len(notifications) == 2
    assert all(note["type"] == "post_liked" for note in notifications)
    assert all(not note["is_read"] for note in notifications)

    # Ensure DB exception returns empty list
    monkeypatch.setattr(notification_module.db_service, "get_connection", _failing_connection)
    assert NotificationService.get_user_notifications("user-1") == []


def test_mark_as_read_scopes_user(notification_db):
    notification_id = _insert_notification(notification_db, "user-1")
    assert NotificationService.mark_as_read(notification_id, user_id="user-1")
    with notification_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT read_at FROM notifications WHERE id = ?", (notification_id,))
        row = cursor.fetchone()
    assert row["read_at"] is not None


def test_mark_as_read_with_wrong_user(notification_db):
    notification_id = _insert_notification(notification_db, "user-1")
    assert not NotificationService.mark_as_read(notification_id, user_id="other-user")


def test_mark_as_read_handles_error(monkeypatch):
    monkeypatch.setattr(notification_module.db_service, "get_connection", _failing_connection)
    assert not NotificationService.mark_as_read("id", user_id="user-1")


def test_unread_count_and_mark_all_read(notification_db):
    _insert_notification(notification_db, "user-1")
    _insert_notification(notification_db, "user-1")
    _insert_notification(notification_db, "user-1", read_at=datetime.utcnow().isoformat())

    assert NotificationService.get_unread_count("user-1") == 2
    assert NotificationService.mark_all_read("user-1") == 2
    assert NotificationService.get_unread_count("user-1") == 0


def test_unread_count_handles_failure(monkeypatch):
    monkeypatch.setattr(notification_module.db_service, "get_connection", _failing_connection)
    assert NotificationService.get_unread_count("user-1") == 0


def test_mark_all_read_handles_failure(monkeypatch):
    monkeypatch.setattr(notification_module.db_service, "get_connection", _failing_connection)
    assert NotificationService.mark_all_read("user-1") == 0


def test_cleanup_old_notifications(notification_db):
    cutoff = datetime.utcnow() - timedelta(days=31)
    _insert_notification(
        notification_db,
        "user-1",
        created_at=cutoff.isoformat(),
        read_at=datetime.utcnow().isoformat(),
    )
    _insert_notification(
        notification_db,
        "user-1",
        read_at=None,
        created_at=datetime.utcnow().isoformat(),
    )
    deleted = NotificationService.cleanup_old_notifications(days_old=30)
    assert deleted == 1

def test_cleanup_old_notifications_failure(monkeypatch):
    monkeypatch.setattr(notification_module.db_service, "get_connection", _failing_connection)
    assert NotificationService.cleanup_old_notifications() == 0

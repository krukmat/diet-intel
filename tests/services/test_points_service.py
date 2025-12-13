import uuid
from datetime import datetime

import pytest

from app.config import config
from app.services.database import db_service
from app.services.gamification.points_service import PointsService


TEST_USER_PREFIX = "batch5_points"


def _cleanup_user_records(user_id: str):
    """Remove any rows left behind for the helper user."""
    tables = [
        ("points_ledger", "user_id"),
        ("user_levels", "user_id"),
        ("notifications", "user_id"),
    ]
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        for table, column in tables:
            cursor.execute(f"DELETE FROM {table} WHERE {column} = ?", (user_id,))
        conn.commit()


def _insert_points_entry(user_id: str, source: str, points: int = 1, created_at: str = None):
    created_at = created_at or datetime.utcnow().isoformat()
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO points_ledger (id, user_id, source, points, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, source, points, created_at),
        )
        conn.commit()


@pytest.fixture(autouse=True)
def ensure_clean_points_data():
    """Guarantee a clean state before and after each test that touches points tables."""
    cleanup_users = []

    yield cleanup_users

    for user in cleanup_users:
        _cleanup_user_records(user)


def test_add_points_creates_ledger_and_level(monkeypatch, ensure_clean_points_data):
    user_id = f"{TEST_USER_PREFIX}_add"
    ensure_clean_points_data.append(user_id)

    import app.services.notifications.notification_service as notification_module

    class DummyNotification:
        @staticmethod
        def enqueue_notification(*args, **kwargs):
            return None

    monkeypatch.setattr(notification_module, "NotificationService", DummyNotification)

    points_awarded = PointsService.add_points(user_id, "post_create")
    assert points_awarded == PointsService.DEFAULT_EARNING_RULES["post_create"]

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total FROM points_ledger WHERE user_id = ?", (user_id,))
        ledger_count = cursor.fetchone()["total"]
        cursor.execute("SELECT points_total, level FROM user_levels WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()

    assert ledger_count == 1
    assert row["points_total"] >= points_awarded
    assert row["level"] >= 1


def test_daily_cap_blocks_extra_entries(ensure_clean_points_data):
    user_id = f"{TEST_USER_PREFIX}_cap"
    ensure_clean_points_data.append(user_id)

    cap_source = "like_received"
    cap_limit = PointsService.DAILY_CAPS[cap_source]
    for _ in range(cap_limit):
        _insert_points_entry(user_id, cap_source)

    assert PointsService._check_daily_cap(user_id, cap_source) is False


def test_earning_rules_respect_overrides():
    original_rules = dict(config.gamification_point_rules)
    config.gamification_point_rules = {"custom_action": "7", "post_create": "11"}

    rules = PointsService._get_earning_rules()
    assert rules["custom_action"] == 7
    assert rules["post_create"] == 11
    assert "post_create" in rules

    config.gamification_point_rules = original_rules


def test_leaderboard_orders_by_points(ensure_clean_points_data):
    user_a = f"{TEST_USER_PREFIX}_leader_a"
    user_b = f"{TEST_USER_PREFIX}_leader_b"
    for user in (user_a, user_b):
        _cleanup_user_records(user)
    ensure_clean_points_data.extend([user_a, user_b])

    fixed_time = datetime.utcnow().isoformat()
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO user_levels (user_id, level, points_total, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_a, 2, 150, fixed_time),
        )
        cursor.execute(
            """
            INSERT OR REPLACE INTO user_levels (user_id, level, points_total, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_b, 3, 360, fixed_time),
        )
        conn.commit()

    leaderboard = PointsService.get_leaderboard(limit=5, time_range="all_time")
    filtered = [entry for entry in leaderboard if entry["user_id"] in {user_a, user_b}]
    assert len(filtered) == 2
    assert filtered[0]["user_id"] == user_b
    assert filtered[1]["user_id"] == user_a
    assert filtered[0]["current_level"] == 3

    _cleanup_user_records(user_a)
    _cleanup_user_records(user_b)

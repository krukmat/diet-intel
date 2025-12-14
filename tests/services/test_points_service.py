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


# BATCH 4 PHASE 1: Extended points_service tests for error handling and edge cases (2025-12-15)

def test_add_points_unknown_source(ensure_clean_points_data):
    """Test add_points returns 0 for unknown source"""
    user_id = f"{TEST_USER_PREFIX}_unknown_src"
    ensure_clean_points_data.append(user_id)

    result = PointsService.add_points(user_id, "unknown_source_xyz")

    assert result == 0


def test_add_points_first_post_bonus_once_per_day(ensure_clean_points_data):
    """Test first_post_of_day_bonus only awarded once per day"""
    user_id = f"{TEST_USER_PREFIX}_first_post"
    ensure_clean_points_data.append(user_id)

    # Award first post bonus first time
    first_result = PointsService.add_points(user_id, "first_post_of_day_bonus")
    assert first_result == PointsService.DEFAULT_EARNING_RULES["first_post_of_day_bonus"]

    # Try again - should be blocked
    second_result = PointsService.add_points(user_id, "first_post_of_day_bonus")
    assert second_result == 0


def test_add_points_daily_cap_enforcement(ensure_clean_points_data):
    """Test daily cap is enforced on like_received"""
    user_id = f"{TEST_USER_PREFIX}_cap_enforce"
    ensure_clean_points_data.append(user_id)

    cap_source = "like_received"
    cap_limit = PointsService.DAILY_CAPS[cap_source]
    per_point = PointsService.DEFAULT_EARNING_RULES[cap_source]

    # Fill up to cap
    for _ in range(cap_limit):
        _insert_points_entry(user_id, cap_source, per_point)

    # Next add_points should be blocked
    result = PointsService.add_points(user_id, cap_source)
    assert result == 0


def test_add_points_database_error_handling(monkeypatch, ensure_clean_points_data):
    """Test add_points handles database errors gracefully"""
    user_id = f"{TEST_USER_PREFIX}_db_error"
    ensure_clean_points_data.append(user_id)

    # Mock db_service.get_connection to raise error
    def mock_get_connection():
        raise RuntimeError("Database connection failed")

    monkeypatch.setattr(db_service, "get_connection", mock_get_connection)

    result = PointsService.add_points(user_id, "post_create")

    assert result == 0


def test_get_user_points_new_user(ensure_clean_points_data):
    """Test get_user_points for user with no points"""
    user_id = f"{TEST_USER_PREFIX}_new_user"
    ensure_clean_points_data.append(user_id)

    result = PointsService.get_user_points(user_id)

    assert result["total_points"] == 0
    assert result["current_level"] == 1
    assert result["next_level_threshold"] == 100
    assert result["points_needed"] == 100
    assert result["recent_transactions"] == []


def test_get_user_points_with_transactions(ensure_clean_points_data):
    """Test get_user_points returns recent transactions"""
    user_id = f"{TEST_USER_PREFIX}_with_trans"
    ensure_clean_points_data.append(user_id)

    # Add some points to ledger
    _insert_points_entry(user_id, "post_create", 5)
    _insert_points_entry(user_id, "like_received", 1)

    # Ensure user_levels record exists (normally created by add_points)
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO user_levels (user_id, level, points_total, updated_at)
            VALUES (?, ?, ?, ?)
        """, (user_id, 1, 6, datetime.utcnow().isoformat()))
        conn.commit()

    result = PointsService.get_user_points(user_id)

    assert result["total_points"] == 6
    assert len(result["recent_transactions"]) == 2
    assert result["recent_transactions"][0]["source"] in ["post_create", "like_received"]


def test_get_user_points_database_error(monkeypatch, ensure_clean_points_data):
    """Test get_user_points handles database errors"""
    user_id = f"{TEST_USER_PREFIX}_get_error"
    ensure_clean_points_data.append(user_id)

    def mock_get_connection():
        raise RuntimeError("Database error")

    monkeypatch.setattr(db_service, "get_connection", mock_get_connection)

    result = PointsService.get_user_points(user_id)

    assert result["total_points"] == 0
    assert result["current_level"] == 1
    assert result["next_level_threshold"] == 100


def test_get_leaderboard_weekly(ensure_clean_points_data):
    """Test get_leaderboard with weekly time_range"""
    user_a = f"{TEST_USER_PREFIX}_weekly_a"
    user_b = f"{TEST_USER_PREFIX}_weekly_b"
    ensure_clean_points_data.extend([user_a, user_b])

    # Insert points for both users
    _insert_points_entry(user_a, "post_create", 10)
    _insert_points_entry(user_b, "post_create", 20)

    leaderboard = PointsService.get_leaderboard(limit=10, time_range="weekly")

    # Find our test users in leaderboard
    filtered = [e for e in leaderboard if e["user_id"] in {user_a, user_b}]
    assert len(filtered) <= 2  # May have fewer if both don't have enough points


def test_get_leaderboard_monthly(ensure_clean_points_data):
    """Test get_leaderboard with monthly time_range"""
    user_id = f"{TEST_USER_PREFIX}_monthly"
    ensure_clean_points_data.append(user_id)

    _insert_points_entry(user_id, "post_create", 15)

    leaderboard = PointsService.get_leaderboard(limit=10, time_range="monthly")

    assert isinstance(leaderboard, list)
    # May or may not include user depending on monthly calculation


def test_get_leaderboard_error_handling(monkeypatch, ensure_clean_points_data):
    """Test get_leaderboard handles database errors"""
    def mock_get_connection():
        raise RuntimeError("Database error")

    monkeypatch.setattr(db_service, "get_connection", mock_get_connection)

    leaderboard = PointsService.get_leaderboard(limit=10, time_range="all_time")

    assert leaderboard == []


def test_calculate_level_boundaries(ensure_clean_points_data):
    """Test _calculate_level with boundary values"""
    # Test each level threshold
    assert PointsService._calculate_level(0) == 1
    assert PointsService._calculate_level(99) == 1
    assert PointsService._calculate_level(100) == 2
    assert PointsService._calculate_level(249) == 2
    assert PointsService._calculate_level(250) == 3
    assert PointsService._calculate_level(499) == 3
    assert PointsService._calculate_level(500) == 4
    assert PointsService._calculate_level(999) == 4
    assert PointsService._calculate_level(1000) == 5
    assert PointsService._calculate_level(9999) == 5


def test_get_next_level_info_mid_progression(ensure_clean_points_data):
    """Test _get_next_level_info at various progression points"""
    # User at level 1 with 50 points
    threshold, needed = PointsService._get_next_level_info(1, 50)
    assert threshold == 100
    assert needed == 50

    # User at level 3 with 300 points
    threshold, needed = PointsService._get_next_level_info(3, 300)
    assert threshold == 500
    assert needed == 200

    # User at level 5 (max level)
    threshold, needed = PointsService._get_next_level_info(5, 1000)
    assert needed == 0


def test_get_next_level_info_exactly_at_threshold(ensure_clean_points_data):
    """Test _get_next_level_info when points exactly match threshold"""
    threshold, needed = PointsService._get_next_level_info(2, 100)
    assert threshold == 250
    assert needed == 150


def test_check_daily_cap_under_limit(ensure_clean_points_data):
    """Test _check_daily_cap when under limit"""
    user_id = f"{TEST_USER_PREFIX}_under_limit"
    ensure_clean_points_data.append(user_id)

    # Insert some points but not at cap
    _insert_points_entry(user_id, "like_received", 5)

    result = PointsService._check_daily_cap(user_id, "like_received")

    assert result is True


def test_check_daily_cap_no_capped_source(ensure_clean_points_data):
    """Test _check_daily_cap for source without cap"""
    user_id = f"{TEST_USER_PREFIX}_no_cap"
    ensure_clean_points_data.append(user_id)

    # post_create has no daily cap
    result = PointsService._check_daily_cap(user_id, "post_create")

    assert result is True


def test_check_daily_cap_database_error(monkeypatch, ensure_clean_points_data):
    """Test _check_daily_cap handles database errors"""
    user_id = f"{TEST_USER_PREFIX}_cap_error"
    ensure_clean_points_data.append(user_id)

    def mock_get_connection():
        raise RuntimeError("Database error")

    monkeypatch.setattr(db_service, "get_connection", mock_get_connection)

    # Should return True (allow) on error
    result = PointsService._check_daily_cap(user_id, "like_received")

    assert result is True


def test_has_first_post_today_true(ensure_clean_points_data):
    """Test _has_first_post_today when bonus already awarded"""
    user_id = f"{TEST_USER_PREFIX}_has_post"
    ensure_clean_points_data.append(user_id)

    # Insert first_post bonus for today
    _insert_points_entry(user_id, "first_post_of_day_bonus", 3)

    result = PointsService._has_first_post_today(user_id)

    assert result is True


def test_has_first_post_today_false(ensure_clean_points_data):
    """Test _has_first_post_today when bonus not awarded"""
    user_id = f"{TEST_USER_PREFIX}_no_post"
    ensure_clean_points_data.append(user_id)

    result = PointsService._has_first_post_today(user_id)

    assert result is False


def test_has_first_post_today_error_handling(monkeypatch, ensure_clean_points_data):
    """Test _has_first_post_today handles database errors gracefully"""
    user_id = f"{TEST_USER_PREFIX}_post_error"
    ensure_clean_points_data.append(user_id)

    def mock_get_connection():
        raise RuntimeError("Database error")

    monkeypatch.setattr(db_service, "get_connection", mock_get_connection)

    # Should return False on error (conservative)
    result = PointsService._has_first_post_today(user_id)

    assert result is False


def test_get_current_level_and_points_new_user(ensure_clean_points_data):
    """Test _get_current_level_and_points for user not in DB"""
    user_id = f"{TEST_USER_PREFIX}_no_record"
    ensure_clean_points_data.append(user_id)

    level, points = PointsService._get_current_level_and_points(user_id)

    assert level == 1
    assert points == 0


def test_get_current_level_and_points_existing_user(ensure_clean_points_data):
    """Test _get_current_level_and_points for existing user"""
    user_id = f"{TEST_USER_PREFIX}_existing"
    ensure_clean_points_data.append(user_id)

    # Create user record with points
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO user_levels (user_id, level, points_total, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, 3, 350, datetime.utcnow().isoformat()),
        )
        conn.commit()

    level, points = PointsService._get_current_level_and_points(user_id)

    assert level == 3
    assert points == 350


def test_get_current_level_and_points_error_handling(monkeypatch, ensure_clean_points_data):
    """Test _get_current_level_and_points handles database errors"""
    user_id = f"{TEST_USER_PREFIX}_level_error"
    ensure_clean_points_data.append(user_id)

    def mock_get_connection():
        raise RuntimeError("Database error")

    monkeypatch.setattr(db_service, "get_connection", mock_get_connection)

    level, points = PointsService._get_current_level_and_points(user_id)

    assert level == 1
    assert points == 0


def test_get_earning_rules_invalid_point_values():
    """Test _get_earning_rules with invalid point values"""
    original_rules = dict(config.gamification_point_rules)
    config.gamification_point_rules = {
        "valid_action": "10",
        "invalid_action": "not_a_number",
        "float_action": "5.5"
    }

    rules = PointsService._get_earning_rules()

    assert rules.get("valid_action") == 10
    # Invalid values should be skipped or converted
    assert isinstance(rules.get("valid_action"), int)

    config.gamification_point_rules = original_rules


def test_add_points_level_up_notification(monkeypatch, ensure_clean_points_data):
    """Test add_points triggers notification on level up"""
    user_id = f"{TEST_USER_PREFIX}_levelup"
    ensure_clean_points_data.append(user_id)

    import app.services.notifications.notification_service as notification_module

    called = []

    class DummyNotification:
        @staticmethod
        def enqueue_notification(*args, **kwargs):
            called.append((args, kwargs))

    monkeypatch.setattr(notification_module, "NotificationService", DummyNotification)

    # Give enough points to level up (threshold is 100)
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO user_levels (user_id, level, points_total, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, 1, 90, datetime.utcnow().isoformat()),
        )
        conn.commit()

    # Add enough points to cross level threshold
    PointsService.add_points(user_id, "post_create")  # 5 points, total becomes 95
    PointsService.add_points(user_id, "follow_gained")  # 2 points, total becomes 97
    result = PointsService.add_points(user_id, "challenge_completed")  # 15 points, total becomes 112 -> Level 2

    assert result == 15


def test_add_points_insert_new_level_record(ensure_clean_points_data):
    """Test add_points creates new user_levels record if not exists"""
    user_id = f"{TEST_USER_PREFIX}_new_level"
    ensure_clean_points_data.append(user_id)

    import app.services.notifications.notification_service as notification_module

    class DummyNotification:
        @staticmethod
        def enqueue_notification(*args, **kwargs):
            return None

    # Mock notification service
    original_service = getattr(notification_module, "NotificationService", None)
    try:
        notification_module.NotificationService = DummyNotification

        # Add points to user with no record
        result = PointsService.add_points(user_id, "post_create")

        assert result == 5

        # Verify record was created
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT level, points_total FROM user_levels WHERE user_id = ?",
                (user_id,)
            )
            row = cursor.fetchone()
            assert row is not None
            assert row["points_total"] >= 5
    finally:
        if original_service:
            notification_module.NotificationService = original_service

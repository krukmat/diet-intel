from datetime import datetime

from app.services.database import db_service
from app.services.gamification.badge_service import BadgeService


def _cleanup_badge_data(user_id: str):
    tables = [
        ("user_badges", "user_id"),
        ("points_ledger", "user_id"),
        ("profile_stats", "user_id"),
    ]
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        for table, column in tables:
            cursor.execute(f"DELETE FROM {table} WHERE {column} = ?", (user_id,))
        conn.commit()


def test_award_badge_inserts_row_and_awards_points(monkeypatch):
    user_id = "batch5_badge_award"
    _cleanup_badge_data(user_id)

    import app.services.gamification.points_service as points_module

    called = {"count": 0}

    def fake_add_points(uid, source, metadata=None):
        called["count"] += 1
        return 5

    monkeypatch.setattr(points_module.PointsService, "add_points", fake_add_points)

    try:
        earned = BadgeService._award_badge(user_id, "starter")
        assert earned is True

        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT badge_code FROM user_badges WHERE user_id = ?",
                (user_id,),
            )
            row = cursor.fetchone()

        assert row["badge_code"] == "starter"
        assert called["count"] == 1
    finally:
        _cleanup_badge_data(user_id)


def test_evaluate_rule_action_count_reflects_ledger():
    user_id = "batch5_badge_action"
    _cleanup_badge_data(user_id)

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO points_ledger (id, user_id, source, points, created_at) VALUES (?, ?, ?, ?, ?)",
            ("action-test", user_id, "post_create", 1, datetime.utcnow().isoformat()),
        )
        conn.commit()

    assert BadgeService._evaluate_rule(
        user_id,
        "action_count",
        {"source": "post_create", "count": 1},
        "post_create",
        {},
    )

    _cleanup_badge_data(user_id)


def test_evaluate_rule_follower_count_reads_profile_stats():
    user_id = "batch5_badge_followers"
    _cleanup_badge_data(user_id)

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO profile_stats
            (user_id, followers_count, following_count, posts_count, points_total, level, badges_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, 7, 0, 0, 0, 1, 0),
        )
        conn.commit()

    assert BadgeService._evaluate_rule(
        user_id,
        "follower_count",
        {"count": 5},
        "",
        None,
    )

    _cleanup_badge_data(user_id)

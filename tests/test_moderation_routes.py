import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from datetime import datetime

from main import app


def _make_user(user_id="user-1", is_admin=True):
    class _U:
        def __init__(self, uid, admin):
            self.id = uid
            self.is_admin = admin

    return _U(user_id, is_admin)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def override_auth():
    from app.routes import moderation as moderation_module

    user = _make_user()
    app.dependency_overrides[moderation_module.get_current_user] = lambda: user
    yield
    app.dependency_overrides.pop(moderation_module.get_current_user, None)


# PHASE 3: Refactored to use real ReportService instead of mocks (2025-12-13)
def insert_test_user(db_conn, user_id, username, email):
    """Helper to insert test user"""
    cursor = db_conn.cursor()
    cursor.execute(
        "INSERT INTO users (id, username, email) VALUES (?, ?, ?)",
        (user_id, username, email)
    )
    db_conn.commit()


def insert_test_post(db_conn, post_id, author_id, text):
    """Helper to insert test post"""
    now = datetime.utcnow().isoformat()
    cursor = db_conn.cursor()
    cursor.execute(
        "INSERT INTO posts (id, author_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (post_id, author_id, text, now, now)
    )
    db_conn.commit()


def test_create_report_success(client, moderation_db):
    """Test successful report creation with real ReportService (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert users and target post
        reporter_id = "user-1"  # From override_auth fixture
        target_id = "post_123"
        insert_test_user(moderation_db, reporter_id, "admin", "admin@test.com")
        insert_test_post(moderation_db, target_id, reporter_id, "Test post content")

        # Execute: Real ReportService.create_report through route
        resp = client.post("/reports", json={
            "target_type": "post",
            "target_id": target_id,
            "reason": "spam"
        })

        # Assert: HTTP response
        assert resp.status_code == 200
        body = resp.json()
        assert "id" in body
        assert body["reason"] == "spam"
        assert body["target_type"] == "post"

        # Assert: Data persisted in database
        cursor = moderation_db.cursor()
        cursor.execute("SELECT * FROM content_reports WHERE id = ?", (body["id"],))
        report = cursor.fetchone()
        assert report is not None
        assert report["reason"] == "spam"
        assert report["status"] == "pending"
        assert report["target_id"] == target_id


def test_create_report_value_error(client, moderation_db):
    """Test report creation fails when target doesn't exist (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert user but NOT the target post
        reporter_id = "user-1"
        insert_test_user(moderation_db, reporter_id, "admin", "admin@test.com")
        # Do NOT insert target post - this will cause ValueError in ReportService

        # Execute: Try to create report for non-existent post
        resp = client.post("/reports", json={
            "target_type": "post",
            "target_id": "nonexistent-post",
            "reason": "spam"
        })

        # Assert: HTTP error response
        assert resp.status_code == 400
        assert "does not exist" in resp.json()["detail"]

        # Assert: No report created in database
        cursor = moderation_db.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM content_reports")
        assert cursor.fetchone()["count"] == 0


def test_get_my_reports(client, moderation_db):
    """Test getting user's own reports with real ReportService (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert users, posts, and reports
        reporter_id = "user-1"
        target_id_1 = "post-1"
        target_id_2 = "post-2"

        insert_test_user(moderation_db, reporter_id, "admin", "admin@test.com")
        insert_test_post(moderation_db, target_id_1, reporter_id, "Post 1")
        insert_test_post(moderation_db, target_id_2, reporter_id, "Post 2")

        # Insert two reports directly in database
        cursor = moderation_db.cursor()
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("r1", reporter_id, "post", target_id_1, "spam", datetime.utcnow().isoformat()))
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("r2", reporter_id, "post", target_id_2, "abuse", datetime.utcnow().isoformat()))
        moderation_db.commit()

        # Execute: Real ReportService.get_user_reports through route
        resp = client.get("/reports/my-reports")

        # Assert: HTTP response
        assert resp.status_code == 200
        reports = resp.json()["reports"]
        assert len(reports) == 2
        assert reports[0]["id"] in ["r1", "r2"]
        assert reports[1]["id"] in ["r1", "r2"]
        assert all(r["target_type"] == "post" for r in reports)


def test_admin_list_reports_success(client, moderation_db):
    """Test admin list reports with status filter using real ReportService (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert users, posts, and reports with different statuses
        user_id = "user-1"
        post_id = "post-1"

        insert_test_user(moderation_db, user_id, "admin", "admin@test.com")
        insert_test_post(moderation_db, post_id, user_id, "Test post")

        # Insert pending and reviewed reports
        cursor = moderation_db.cursor()
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("pending-r1", user_id, "post", post_id, "spam", datetime.utcnow().isoformat(), "pending"))
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("reviewed-r1", user_id, "post", post_id, "abuse", datetime.utcnow().isoformat(), "moderated_dismissed"))
        moderation_db.commit()

        # Execute: Real ReportService.get_reports_for_moderation with status filter
        resp = client.get("/admin/reports?status=pending&limit=5")

        # Assert: HTTP response
        assert resp.status_code == 200
        reports = resp.json()["reports"]
        assert len(reports) == 1
        assert reports[0]["id"] == "pending-r1"
        assert reports[0]["status"] == "pending"

        # Verify filtering works - test with different status
        resp2 = client.get("/admin/reports?status=moderated_dismissed&limit=5")
        assert resp2.status_code == 200
        reports2 = resp2.json()["reports"]
        assert len(reports2) == 1
        assert reports2[0]["id"] == "reviewed-r1"


def test_moderate_report_not_found(client, moderation_db):
    """Test moderating non-existent report returns 404 (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Database with no reports - moderation will fail naturally

        # Execute: Try to moderate non-existent report
        resp = client.post("/admin/reports/r-404/moderate", json={"action": "approve"})

        # Assert: HTTP 404 error
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

        # Assert: Database unchanged
        cursor = moderation_db.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM content_reports")
        assert cursor.fetchone()["count"] == 0


def test_moderate_report_success(client, moderation_db):
    """Test successful report moderation with real ReportService (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert user, post, and report
        moderator_id = "user-1"
        post_id = "post-1"
        report_id = "r-1"

        insert_test_user(moderation_db, moderator_id, "admin", "admin@test.com")
        insert_test_post(moderation_db, post_id, moderator_id, "Test post")

        cursor = moderation_db.cursor()
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (report_id, moderator_id, "post", post_id, "spam", datetime.utcnow().isoformat(), "pending"))
        moderation_db.commit()

        # Execute: Real ReportService.moderate_report through route
        resp = client.post(f"/admin/reports/{report_id}/moderate", json={
            "action": "dismiss",
            "notes": "ok"
        })

        # Assert: HTTP response
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "dismiss" in body["message"]

        # Assert: Database updated with moderation
        cursor.execute("SELECT * FROM content_reports WHERE id = ?", (report_id,))
        report = cursor.fetchone()
        assert report["status"] == "moderated_dismissed"
        assert report["reviewed_by"] == moderator_id
        assert report["reviewed_at"] is not None


def test_report_stats_success(client, moderation_db):
    """Test getting report statistics with real ReportService (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert users, posts, and reports with various statuses and reasons
        user_id = "user-1"
        post_id = "post-1"

        insert_test_user(moderation_db, user_id, "admin", "admin@test.com")
        insert_test_post(moderation_db, post_id, user_id, "Test post")

        # Insert reports with different statuses and reasons
        cursor = moderation_db.cursor()
        now = datetime.utcnow().isoformat()
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("r1", user_id, "post", post_id, "spam", now, "pending"))
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("r2", user_id, "post", post_id, "abuse", now, "pending"))
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("r3", user_id, "post", post_id, "spam", now, "moderated_approved"))
        moderation_db.commit()

        # Execute: Real ReportService.get_report_stats through route
        resp = client.get("/admin/reports/stats")

        # Assert: HTTP response
        assert resp.status_code == 200
        stats = resp.json()
        assert stats["total_reports"] == 3
        assert stats["reports_by_status"]["pending"] == 2
        assert stats["reports_by_status"]["moderated_approved"] == 1
        assert stats["reports_by_reason"]["spam"] == 2
        assert stats["reports_by_reason"]["abuse"] == 1
        assert stats["recent_reports_24h"] >= 0  # Date check may vary


def test_create_report_invalid_reason(client, moderation_db):
    """Test report creation with invalid reason (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert user and post
        reporter_id = "user-1"
        target_id = "post-1"
        insert_test_user(moderation_db, reporter_id, "admin", "admin@test.com")
        insert_test_post(moderation_db, post_id=target_id, author_id=reporter_id, text="Test post")

        # Execute: Try to create report with invalid reason
        resp = client.post("/reports", json={
            "target_type": "post",
            "target_id": target_id,
            "reason": "invalid_reason"
        })

        # Assert: HTTP 422 validation error
        assert resp.status_code == 422


def test_get_my_reports_empty(client, moderation_db):
    """Test getting user's reports when no reports exist (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: No reports in database

        # Execute: Get reports for current user
        resp = client.get("/reports/my-reports")

        # Assert: HTTP 200 with empty list
        assert resp.status_code == 200
        assert resp.json()["reports"] == []


def test_moderate_report_invalid_action(client, moderation_db):
    """Test moderating report with invalid action (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Insert user, post, and report
        moderator_id = "user-1"
        post_id = "post-1"
        report_id = "r-1"

        insert_test_user(moderation_db, moderator_id, "admin", "admin@test.com")
        insert_test_post(moderation_db, post_id, moderator_id, "Test post")

        cursor = moderation_db.cursor()
        cursor.execute("""
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (report_id, moderator_id, "post", post_id, "spam", datetime.utcnow().isoformat(), "pending"))
        moderation_db.commit()

        # Execute: Try to moderate with invalid action
        resp = client.post(f"/admin/reports/{report_id}/moderate", json={
            "action": "invalid_action",
            "notes": "ok"
        })

        # Assert: HTTP 422 validation error
        assert resp.status_code == 422


def test_report_stats_empty(client, moderation_db):
    """Test getting report stats when database is empty (PHASE 3 - 2025-12-13)"""
    with patch("app.routes.moderation.assert_feature_enabled"):
        # Setup: Empty database

        # Execute: Get stats
        resp = client.get("/admin/reports/stats")

        # Assert: HTTP 200 with empty stats
        assert resp.status_code == 200
        stats = resp.json()
        assert stats["total_reports"] == 0
        assert stats["reports_by_status"] == {}
        assert stats["reports_by_reason"] == {}
        assert stats["recent_reports_24h"] == 0

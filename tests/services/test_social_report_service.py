import pytest
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from app.services.database import DatabaseService
from app.services.social import report_service as report_module

ReportService = report_module.ReportService


@pytest.fixture
def report_db(monkeypatch, tmp_path):
    """Provide a fresh DatabaseService for each test and patch the module dependency."""
    db_path = tmp_path / "report_service.db"
    db = DatabaseService(str(db_path))
    monkeypatch.setattr(report_module, "db_service", db)
    return db


def _insert_post(db, post_id: str, author_id: str = "author"):
    now = datetime.utcnow().isoformat()
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO posts (id, author_id, text, visibility, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (post_id, author_id, "test post", "public", now, now),
        )
        conn.commit()


def _insert_comment(db, comment_id: str, post_id: str, author_id: str = "author"):
    now = datetime.utcnow().isoformat()
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO post_comments (id, post_id, author_id, text, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (comment_id, post_id, author_id, "comment text", now, now),
        )
        conn.commit()


def _insert_user(db, user_id: str):
    now = datetime.utcnow().isoformat()
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO users (id, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, f"{user_id}@example.com", "hash", "Test User", "standard"),
        )
        conn.commit()


def _insert_report(
    db,
    reporter_id: str,
    target_type: str,
    target_id: str,
    *,
    status: str = "pending",
    reason: str = "abuse",
    created_at: Optional[datetime] = None,
) -> str:
    """Seed a report directly to exercise helper branches."""
    report_id = str(uuid4())
    created_at_iso = (created_at or datetime.utcnow()).isoformat()
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO content_reports (id, reporter_id, target_type, target_id, reason, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (report_id, reporter_id, target_type, target_id, reason, status, created_at_iso),
        )
        conn.commit()
    return report_id


class _FailingContext:
    def __enter__(self):
        raise RuntimeError("db failure")

    def __exit__(self, exc_type, exc, tb):
        return False


def _failing_connection():
    return _FailingContext()


def test_create_report_success(report_db):
    _insert_post(report_db, "post-success")
    result = ReportService.create_report("reporter-a", "post", "post-success", "spam")
    assert result["status"] == "pending"
    assert result["target_id"] == "post-success"
    with report_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM content_reports WHERE id = ?", (result["id"],))
        stored = cursor.fetchone()
    assert stored is not None
    assert stored["reporter_id"] == "reporter-a"


@pytest.mark.parametrize("target_type", ("thread", "space"))
def test_create_report_invalid_target_type(report_db, target_type):
    with pytest.raises(ValueError, match="Invalid target_type"):
        ReportService.create_report("reporter-b", target_type, "does-not-matter", "spam")


def test_create_report_invalid_reason(report_db):
    _insert_post(report_db, "post-reason")
    with pytest.raises(ValueError, match="Invalid report reason"):
        ReportService.create_report("reporter-c", "post", "post-reason", "nonsense")


def test_create_report_missing_target(report_db):
    with pytest.raises(ValueError, match="does not exist"):
        ReportService.create_report("reporter-d", "post", "missing-post", "abuse")


def test_create_report_duplicate_report(report_db):
    _insert_post(report_db, "post-dup")
    reporter = "reporter-e"
    ReportService.create_report(reporter, "post", "post-dup", "spam")
    with pytest.raises(ValueError, match="already reported"):
        ReportService.create_report(reporter, "post", "post-dup", "spam")


def test_get_reports_for_moderation_filters_and_limit(report_db):
    base_time = datetime.utcnow()
    _insert_report(report_db, "r1", "post", "post-1", created_at=base_time)
    _insert_report(report_db, "r2", "post", "post-1", created_at=base_time + timedelta(seconds=1))
    _insert_report(report_db, "r3", "post", "post-1", status="moderated_approved", created_at=base_time + timedelta(seconds=2))

    reports = ReportService.get_reports_for_moderation(status="pending", limit=2)
    assert len(reports) == 2
    assert all(rep["status"] == "pending" for rep in reports)
    assert datetime.fromisoformat(reports[0]["created_at"]) >= datetime.fromisoformat(
        reports[1]["created_at"]
    )


def test_get_reports_for_moderation_handles_db_error(report_db, monkeypatch):
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)
    assert ReportService.get_reports_for_moderation() == []


def test_moderate_report_updates_status(report_db):
    _insert_post(report_db, "post-mod")
    report_id = _insert_report(report_db, "r-mod", "post", "post-mod")
    result = ReportService.moderate_report(report_id, "mod-1", "approved")
    assert result
    with report_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT status, reviewed_by FROM content_reports WHERE id = ?", (report_id,))
        updated = cursor.fetchone()
    assert updated["status"] == "moderated_approved"
    assert updated["reviewed_by"] == "mod-1"


def test_moderate_report_handles_db_failure(report_db, monkeypatch):
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)
    assert not ReportService.moderate_report("bad-id", "mod-2", "dismissed")


def test_get_user_reports_limit_and_order(report_db):
    _insert_report(report_db, "user-1", "post", "post-limit", created_at=datetime.utcnow())
    _insert_report(
        report_db,
        "user-1",
        "post",
        "post-limit",
        created_at=datetime.utcnow() - timedelta(minutes=1),
    )
    _insert_report(
        report_db,
        "user-1",
        "post",
        "post-limit",
        created_at=datetime.utcnow() - timedelta(minutes=2),
    )
    _insert_report(
        report_db,
        "other",
        "post",
        "post-limit",
        created_at=datetime.utcnow() - timedelta(minutes=3),
    )

    reports = ReportService.get_user_reports("user-1", limit=2)
    assert len(reports) == 2
    assert datetime.fromisoformat(reports[0]["created_at"]) >= datetime.fromisoformat(
        reports[1]["created_at"]
    )
    assert all(rep["target_id"] == "post-limit" for rep in reports)


def test_get_report_stats_counts(report_db):
    _insert_report(report_db, "stats-1", "post", "post-stats", reason="spam")
    _insert_report(report_db, "stats-2", "post", "post-stats", reason="abuse", status="moderated_approved")
    _insert_report(
        report_db,
        "stats-3",
        "post",
        "post-stats",
        reason="abuse",
        status="moderated_escalated",
    )

    stats = ReportService.get_report_stats()
    assert stats["total_reports"] == 3
    assert stats["reports_by_status"]["moderated_approved"] == 1
    assert stats["reports_by_reason"]["abuse"] == 2
    assert isinstance(stats["recent_reports_24h"], int)


def test_is_post_blocked_true_and_handles_error(report_db, monkeypatch):
    _insert_post(report_db, "post-blocked")
    _insert_report(report_db, "blocker", "post", "post-blocked", status="moderated_approved")

    assert ReportService.is_post_blocked("post-blocked")
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)
    assert not ReportService.is_post_blocked("post-blocked")


def test_verify_target_exists_variants(report_db):
    _insert_post(report_db, "post-verify")
    _insert_comment(report_db, "comment-verify", "post-verify")
    _insert_user(report_db, "user-verify")

    assert ReportService._verify_target_exists("post", "post-verify")
    assert ReportService._verify_target_exists("comment", "comment-verify")
    assert ReportService._verify_target_exists("user", "user-verify")
    assert not ReportService._verify_target_exists("thread", "missing")


def test_has_recent_report_threshold(report_db):
    old_time = datetime.utcnow() - timedelta(days=2)
    _insert_report(report_db, "reporter-old", "post", "post-old", created_at=old_time)
    assert not ReportService._has_recent_report("reporter-old", "post", "post-old")

    _insert_report(report_db, "reporter-new", "post", "post-new")
    assert ReportService._has_recent_report("reporter-new", "post", "post-new")


def test_create_report_handles_db_failure(report_db, monkeypatch):
    monkeypatch.setattr(ReportService, "_verify_target_exists", lambda *args, **kwargs: True)
    monkeypatch.setattr(ReportService, "_has_recent_report", lambda *args, **kwargs: False)
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)

    with pytest.raises(ValueError, match="Failed to create report"):
        ReportService.create_report("reporter-fail", "post", "post-1", "spam")


def test_get_user_reports_handles_failure(report_db, monkeypatch):
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)
    assert ReportService.get_user_reports("user-x") == []


def test_verify_target_exists_handles_failure(monkeypatch):
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)
    assert not ReportService._verify_target_exists("post", "p-1")


def test_has_recent_report_handles_failure(monkeypatch):
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)
    assert not ReportService._has_recent_report("reporter", "post", "post-1")


def test_get_report_stats_handles_failure(monkeypatch):
    monkeypatch.setattr(report_module.db_service, "get_connection", _failing_connection)
    stats = ReportService.get_report_stats()
    assert stats["total_reports"] == 0

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

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


def test_create_report_success(client):
    with patch("app.routes.moderation.assert_feature_enabled"), \
         patch("app.routes.moderation.ReportService.create_report") as mock_create:
        mock_create.return_value = {
            "id": "r1",
            "target_type": "post",
            "target_id": "p1",
            "reason": "spam",
            "created_at": "now",
            "status": "pending",
        }

        resp = client.post("/reports", json={"target_type": "post", "target_id": "p1", "reason": "spam"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == "r1"
        mock_create.assert_called_once()


def test_create_report_value_error(client):
    with patch("app.routes.moderation.assert_feature_enabled"), \
         patch("app.routes.moderation.ReportService.create_report", side_effect=ValueError("boom")):
        resp = client.post("/reports", json={"target_type": "post", "target_id": "p1", "reason": "spam"})
        assert resp.status_code == 400
        assert "boom" in resp.json()["detail"]


def test_get_my_reports(client):
    reports = [{"id": "r1"}, {"id": "r2"}]
    with patch("app.routes.moderation.assert_feature_enabled"), \
         patch("app.routes.moderation.ReportService.get_user_reports", return_value=reports):
        resp = client.get("/reports/my-reports")
        assert resp.status_code == 200
        assert resp.json()["reports"] == reports


def test_admin_list_reports_success(client):
    data = [{"id": "admin-r1"}]
    with patch("app.routes.moderation.assert_feature_enabled"), \
         patch("app.routes.moderation.ReportService.get_reports_for_moderation", return_value=data):
        resp = client.get("/admin/reports?status=pending&limit=5")
        assert resp.status_code == 200
        assert resp.json()["reports"] == data


def test_moderate_report_not_found(client):
    with patch("app.routes.moderation.assert_feature_enabled"), \
         patch("app.routes.moderation.ReportService.moderate_report", return_value=False):
        resp = client.post("/admin/reports/r-404/moderate", json={"action": "approve"})
        assert resp.status_code == 404


def test_moderate_report_success(client):
    with patch("app.routes.moderation.assert_feature_enabled"), \
         patch("app.routes.moderation.ReportService.moderate_report", return_value=True):
        resp = client.post("/admin/reports/r-1/moderate", json={"action": "dismiss", "notes": "ok"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "dismiss" in body["message"]


def test_report_stats_success(client):
    stats = {"total_reports": 1, "reports_by_status": {"pending": 1}, "reports_by_reason": {}, "recent_reports_24h": 1}
    with patch("app.routes.moderation.assert_feature_enabled"), \
         patch("app.routes.moderation.ReportService.get_report_stats", return_value=stats):
        resp = client.get("/admin/reports/stats")
        assert resp.status_code == 200
        assert resp.json()["total_reports"] == 1

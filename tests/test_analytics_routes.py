from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from unittest.mock import AsyncMock

from app.routes import analytics as analytics_routes


class _FakeCursor:
    def __init__(self, rows):
        self.rows = rows
        self.executed_query = ""
        self.executed_params = ()

    def execute(self, query, params=None):
        self.executed_query = query
        self.executed_params = tuple(params or ())

    def fetchall(self):
        return self.rows


class _FakeConnection:
    def __init__(self, rows):
        self.cursor_obj = _FakeCursor(rows)

    def cursor(self):
        return self.cursor_obj

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.fixture
def analytics_client():
    app = FastAPI()
    app.include_router(analytics_routes.router, prefix="/analytics")
    return TestClient(app)


def _patch_connection(monkeypatch, rows, tracker):
    def _factory():
        conn = _FakeConnection(rows)
        tracker.append(conn)
        return conn

    monkeypatch.setattr(analytics_routes.db_service, "get_connection", _factory)
    return tracker


def test_get_analytics_summary_success(analytics_client, monkeypatch):
    summary = {"lookups": 10}
    monkeypatch.setattr(
        analytics_routes.db_service,
        "get_analytics_summary",
        AsyncMock(return_value=summary),
    )

    response = analytics_client.get("/analytics/summary?days=30&user_id=test")
    assert response.status_code == 200
    assert response.json() == summary


def test_get_analytics_summary_failure(analytics_client, monkeypatch):
    async def _raise(*_, **__):
        raise RuntimeError("boom")

    monkeypatch.setattr(
        analytics_routes.db_service,
        "get_analytics_summary",
        AsyncMock(side_effect=_raise),
    )

    response = analytics_client.get("/analytics/summary")
    assert response.status_code == 500
    assert "analytics data" in response.json()["detail"].lower()


def test_product_lookup_stats_filters(monkeypatch, analytics_client):
    rows = [
        {
            "barcode": "000",
            "product_name": "Test",
            "success": 1,
            "response_time_ms": 120,
            "source": "cache",
            "timestamp": "2025-12-12T00:00:00",
            "error_message": None,
        }
    ]
    tracker = []
    _patch_connection(monkeypatch, rows, tracker)
    response = analytics_client.get("/analytics/product-lookups?user_id=u1&limit=5")

    assert response.status_code == 200
    assert response.json()["total_returned"] == 1
    cursor = tracker[-1].cursor_obj
    assert "WHERE user_id = ?" in cursor.executed_query
    assert cursor.executed_params == ("u1", 5)


def test_product_lookup_stats_error(monkeypatch, analytics_client):
    monkeypatch.setattr(
        analytics_routes.db_service,
        "get_connection",
        lambda: (_ for _ in ()).throw(RuntimeError("db down")),
    )

    response = analytics_client.get("/analytics/product-lookups")
    assert response.status_code == 500
    assert "lookup statistics" in response.json()["detail"].lower()


def test_ocr_scan_stats_filters(monkeypatch, analytics_client):
    rows = [
        {
            "image_size": 512,
            "confidence_score": 0.8,
            "processing_time_ms": 200,
            "ocr_engine": "local",
            "nutrients_extracted": 5,
            "success": 1,
            "timestamp": "2025-12-12T01:00:00",
            "error_message": None,
        }
    ]
    tracker = []
    _patch_connection(monkeypatch, rows, tracker)
    response = analytics_client.get("/analytics/ocr-scans?user_id=u1&limit=2")

    assert response.status_code == 200
    assert response.json()["total_returned"] == 1
    cursor = tracker[-1].cursor_obj
    assert "WHERE user_id = ?" in cursor.executed_query
    assert cursor.executed_params == ("u1", 2)


def test_top_products_success(monkeypatch, analytics_client):
    rows = [
        {
            "barcode": "111",
            "name": "Nice",
            "brand": "Brand",
            "access_count": 10,
            "last_updated": "2025-12-11T12:00:00",
        }
    ]
    tracker = []
    _patch_connection(monkeypatch, rows, tracker)
    response = analytics_client.get("/analytics/top-products?limit=1")

    assert response.status_code == 200
    assert response.json()["total_returned"] == 1
    assert tracker[-1].cursor_obj.executed_params == (1,)


def test_user_interactions_filters(monkeypatch, analytics_client):
    rows = [
        {
            "barcode": "222",
            "action": "view",
            "context": "detail",
            "timestamp": "2025-12-12T03:00:00",
            "product_name": "Food",
            "brand": "Brand",
        }
    ]
    tracker = []
    _patch_connection(monkeypatch, rows, tracker)

    params = "user_id=u1&barcode=222&action=view&limit=3"
    response = analytics_client.get(f"/analytics/user-interactions?{params}")

    assert response.status_code == 200
    assert response.json()["total_returned"] == 1
    cursor = tracker[-1].cursor_obj
    assert "WHERE" in cursor.executed_query
    assert tuple(cursor.executed_params) == ("u1", "222", "view", 3)


def test_user_interactions_error(monkeypatch, analytics_client):
    monkeypatch.setattr(
        analytics_routes.db_service,
        "get_connection",
        lambda: (_ for _ in ()).throw(RuntimeError("broken")),
    )

    response = analytics_client.get("/analytics/user-interactions")
    assert response.status_code == 500
    assert "user interactions" in response.json()["detail"].lower()

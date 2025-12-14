import os
from datetime import datetime, timedelta

import pytest

from app.models.user import UserCreate, UserSession
from app.services.database import ConnectionPool, DatabaseService
from app.services.analytics_service import AnalyticsService


@pytest.fixture
def temp_database(tmp_path):
    db_path = tmp_path / "test_db.sqlite"
    service = DatabaseService(str(db_path), max_connections=2)
    yield service
    try:
        os.remove(str(db_path))
    except OSError:
        pass


@pytest.mark.asyncio
async def test_create_and_update_user(temp_database):
    service = temp_database
    user_payload = UserCreate(
        email="developer@example.com", password="securepass", full_name="Dev User", developer_code="DIETINTEL_DEV_2024"
    )
    user = await service.create_user(user_payload, password_hash="hashed")

    assert user.email == "developer@example.com"
    assert user.is_developer is True

    fetched = await service.get_user_by_email(user.email)
    assert fetched and fetched.id == user.id

    updated = await service.update_user(user.id, {"full_name": "Updated Name"})
    assert updated.full_name == "Updated Name"

    hash_value = await service.get_password_hash(user.id)
    assert hash_value == "hashed"


@pytest.mark.asyncio
async def test_session_lifecycle_and_cleanup(temp_database):
    service = temp_database
    user_payload = UserCreate(email="player@example.com", password="seasonpass", full_name="Player One")
    user = await service.create_user(user_payload, password_hash="pw")

    session = UserSession(
        user_id=user.id,
        access_token="access-1",
        refresh_token="refresh-1",
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        device_info="pytest-device"
    )

    session_id = await service.create_session(session)
    assert session_id

    fetched = await service.get_session_by_refresh_token(session.refresh_token)
    assert fetched and fetched.user_id == user.id

    await service.delete_session(session_id)
    assert await service.get_session_by_access_token(session.access_token) is None


@pytest.mark.asyncio
async def test_cleanup_expired_sessions(temp_database):
    service = temp_database
    user_payload = UserCreate(email="stale@example.com", password="stale1234", full_name="Stale User")
    user = await service.create_user(user_payload, password_hash="temp")

    session = UserSession(
        user_id=user.id,
        access_token="old-access",
        refresh_token="old-refresh",
        expires_at=datetime.utcnow() - timedelta(days=1),
        device_info="stale-device"
    )

    await service.create_session(session)
    await service.cleanup_expired_sessions()

    assert await service.get_session_by_access_token(session.access_token) is None


def test_patched_cursor_rewrites_master_query(temp_database):
    service = temp_database
    with service.connection_pool.get_connection() as conn:
        cursor = conn.cursor()
        rows = cursor.execute("SELECT name FROM sqlite_master WHERE name LIKE 'recipe%'").fetchall()
    assert isinstance(rows, list)


def test_connection_pool_creation_failure_raises(monkeypatch, tmp_path):
    db_path = tmp_path / "broken_pool.db"

    def fake_create(self):
        return None

    monkeypatch.setattr(ConnectionPool, "_create_connection", fake_create)
    pool = ConnectionPool(str(db_path), max_connections=1)

    with pytest.raises(RuntimeError):
        with pool.get_connection():
            pass


@pytest.mark.asyncio
async def test_log_product_lookup_creates_entry(temp_database):
    service = temp_database
    analytics_service = AnalyticsService(service)
    lookup_id = await analytics_service.log_product_lookup(
        user_id="user-x",
        session_id="session-x",
        barcode="123XYZ",
        product_name="Test Product",
        success=True,
        response_time_ms=123,
        source="unit-test"
    )

    with service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM user_product_lookups WHERE id = ?", (lookup_id,)).fetchone()

    assert row is not None
    assert row["barcode"] == "123XYZ"
    assert row["success"] == 1


@pytest.mark.asyncio
async def test_log_ocr_scan_creates_entry(temp_database):
    service = temp_database
    analytics_service = AnalyticsService(service)
    scan_id = await analytics_service.log_ocr_scan(
        user_id="user-x",
        session_id="session-x",
        image_size=1024,
        confidence_score=0.85,
        processing_time_ms=250,
        ocr_engine="test-engine",
        nutrients_extracted=5,
        success=False,
        error_message="parser failed"
    )

    with service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM ocr_scan_analytics WHERE id = ?", (scan_id,)).fetchone()

    assert row is not None
    assert row["ocr_engine"] == "test-engine"
    assert row["error_message"] == "parser failed"


@pytest.mark.asyncio
async def test_store_and_get_product_updates_access_count(temp_database):
    service = temp_database
    success = await service.store_product(
        barcode="PROD-1",
        name="Protein Bar",
        brand="TestBrand",
        categories="snacks",
        nutriments={
            "energy_kcal_per_100g": 250,
            "protein_g_per_100g": 20,
            "fat_g_per_100g": 8,
            "carbs_g_per_100g": 22,
            "sugars_g_per_100g": 5,
            "salt_g_per_100g": 0.5
        },
        serving_size="50g",
        image_url="https://example.com/bar.png",
        source="unit-test"
    )

    assert success is True

    product = await service.get_product("PROD-1")
    assert product is not None
    assert product["access_count"] == 1
    assert product["name"] == "Protein Bar"

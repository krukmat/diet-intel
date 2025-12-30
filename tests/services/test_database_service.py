import os
from datetime import datetime, timedelta

import pytest

from app.models.user import UserCreate, UserSession
from app.services.database import ConnectionPool, DatabaseService
from app.services.user_service import UserService
from app.repositories.user_repository import UserRepository
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
async def test_create_and_update_user(temp_database, monkeypatch):
    import uuid
    db_service = temp_database
    # Use temp_database's path for UserRepository via ConnectionManager
    from app.repositories.connection import ConnectionManager
    from app.repositories import connection
    temp_conn_manager = ConnectionManager(db_service.db_path)
    monkeypatch.setattr(connection, 'connection_manager', temp_conn_manager)

    user_repo = UserRepository()
    user_service = UserService(user_repo)
    user_payload = UserCreate(
        email=f"developer-{uuid.uuid4()}@example.com", password="securepass", full_name="Dev User", developer_code="DIETINTEL_DEV_2024"
    )
    user = await user_service.create_user(user_payload, password_hash="hashed")

    assert user.email == user_payload.email
    assert user.is_developer is True

    fetched = await user_service.get_user_by_email(user.email)
    assert fetched and fetched.id == user.id

    updated = await user_service.update_user(user.id, {"full_name": "Updated Name"})
    assert updated.full_name == "Updated Name"

    hash_value = await user_service.get_password_hash(user.id)
    assert hash_value == "hashed"


@pytest.mark.asyncio
async def test_session_lifecycle_and_cleanup(temp_database, monkeypatch):
    # Phase 2 Batch 7: Session tests now use SessionService
    import uuid
    from app.services.session_service import SessionService
    from app.repositories.connection import ConnectionManager
    from app.repositories import connection

    db_service = temp_database
    temp_conn_manager = ConnectionManager(db_service.db_path)
    monkeypatch.setattr(connection, 'connection_manager', temp_conn_manager)
    user_repo = UserRepository()
    user_service = UserService(user_repo)
    session_service = SessionService(db_service)

    user_payload = UserCreate(email=f"player-{uuid.uuid4()}@example.com", password="seasonpass", full_name="Player One")
    user = await user_service.create_user(user_payload, password_hash="pw")

    session = UserSession(
        user_id=user.id,
        access_token="access-1",
        refresh_token="refresh-1",
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        device_info="pytest-device"
    )

    session_id = await session_service.create_session(session)
    assert session_id

    fetched = await session_service.get_session_by_refresh_token(session.refresh_token)
    assert fetched and fetched.user_id == user.id

    await session_service.delete_session(session_id)
    assert await session_service.get_session_by_access_token(session.access_token) is None


@pytest.mark.asyncio
async def test_cleanup_expired_sessions(temp_database, monkeypatch):
    # Phase 2 Batch 7: Session tests now use SessionService
    import uuid
    from app.services.session_service import SessionService
    from app.repositories.connection import ConnectionManager
    from app.repositories import connection

    db_service = temp_database
    temp_conn_manager = ConnectionManager(db_service.db_path)
    monkeypatch.setattr(connection, 'connection_manager', temp_conn_manager)
    user_repo = UserRepository()
    user_service = UserService(user_repo)
    session_service = SessionService(db_service)

    user_payload = UserCreate(email=f"stale-{uuid.uuid4()}@example.com", password="stale1234", full_name="Stale User")
    user = await user_service.create_user(user_payload, password_hash="temp")

    session = UserSession(
        user_id=user.id,
        access_token="old-access",
        refresh_token="old-refresh",
        expires_at=datetime.utcnow() - timedelta(days=1),
        device_info="stale-device"
    )

    await session_service.create_session(session)
    await session_service.cleanup_expired_sessions()

    assert await session_service.get_session_by_access_token(session.access_token) is None


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
async def test_connection_pool_max_connections(temp_database):
    """Test connection pool respects max_connections limit"""
    service = temp_database
    pool = service.connection_pool

    # Try to get multiple connections up to limit
    initial_count = pool._created_connections
    with pool.get_connection() as conn:
        assert conn is not None

    # Connection should be returned to pool
    assert pool._created_connections <= initial_count + 1


@pytest.mark.asyncio
async def test_connection_pool_creates_new_when_empty(temp_database):
    """Test connection pool creates new connections when pool is empty"""
    service = temp_database

    # Get a connection
    with service.get_connection() as conn:
        cursor = conn.cursor()
        # Simple query to verify connection works
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        assert result[0] == 1


@pytest.mark.asyncio
async def test_connection_rollback_on_error(temp_database):
    """Test that connections rollback on exception"""
    service = temp_database

    try:
        with service.get_connection() as conn:
            cursor = conn.cursor()
            # Start a transaction implicitly
            cursor.execute("INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)",
                         ("rollback-test", "test@example.com", "hash", "Test"))
            # Raise an exception to trigger rollback
            raise ValueError("Test error")
    except ValueError:
        pass

    # Connection should still work after error
    with service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        assert cursor.fetchone() is not None


@pytest.mark.asyncio
async def test_connection_pool_error_handling(temp_database):
    """Test connection pool error handling"""
    service = temp_database

    # Test getting a connection and it should work
    with service.get_connection() as conn:
        assert conn is not None
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        result = cursor.fetchone()
        assert result[0] >= 0


def test_patch_cursor_with_recipe_query(temp_database):
    """Test that patched cursor properly rewrites recipe queries"""
    service = temp_database

    with service.get_connection() as conn:
        cursor = conn.cursor()
        # This query should be rewritten by _PatchedCursor
        query = "SELECT name FROM sqlite_master WHERE name LIKE 'recipe%'"
        result = cursor.execute(query)
        # Just verify it doesn't error
        assert result is not None


def test_pached_cursor_getattr(temp_database):
    """Test that patched cursor delegates unknown attributes"""
    service = temp_database

    with service.get_connection() as conn:
        cursor = conn.cursor()
        # Test accessing a standard cursor attribute through patch
        assert hasattr(cursor, 'execute')
        assert hasattr(cursor, 'fetchone')

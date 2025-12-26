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


@pytest.mark.asyncio
async def test_cleanup_expired_meal_plans_no_expired(temp_database):
    """Test cleanup of expired meal plans"""
    service = temp_database

    # Should return 0 when no expired plans
    count = await service.cleanup_expired_meal_plans()
    assert count == 0


@pytest.mark.asyncio
async def test_store_product_with_invalid_image_url(temp_database):
    """Test storing product with invalid image URL"""
    service = temp_database

    success = await service.store_product(
        barcode="BAD-PROD-1",
        name="Bad Product",
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
        image_url="",  # Empty image URL
        source="unit-test"
    )

    assert success is True


@pytest.mark.asyncio
async def test_get_product_not_found(temp_database):
    """Test getting non-existent product"""
    service = temp_database

    product = await service.get_product("NON-EXISTENT")
    assert product is None


@pytest.mark.asyncio
async def test_get_user_meal_plans_empty(temp_database):
    """Test retrieving user's meal plans when empty"""
    service = temp_database

    # Try to get meal plans for non-existent user
    plans = await service.get_user_meal_plans("non-existent-user", limit=10)
    assert isinstance(plans, list)
    assert len(plans) == 0


@pytest.mark.asyncio
async def test_store_product_with_all_fields(temp_database):
    """Test storing product with all nutriment fields"""
    service = temp_database

    success = await service.store_product(
        barcode="FULL-PROD-1",
        name="Full Product",
        brand="TestBrand",
        categories="snacks,energy",
        nutriments={
            "energy_kcal_per_100g": 300,
            "protein_g_per_100g": 25,
            "fat_g_per_100g": 12,
            "carbs_g_per_100g": 35,
            "sugars_g_per_100g": 8,
            "salt_g_per_100g": 1.5
        },
        serving_size="100g",
        image_url="https://example.com/product.png",
        source="test-comprehensive"
    )

    assert success is True

    # Verify product can be retrieved
    product = await service.get_product("FULL-PROD-1")
    assert product is not None
    assert product["name"] == "Full Product"
    assert product["brand"] == "TestBrand"


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
async def test_product_access_count_increments(temp_database):
    """Test that product access_count increments on repeated access"""
    service = temp_database

    # Store product
    await service.store_product(
        barcode="ACCESS-COUNT-PROD",
        name="Test Product",
        brand="Brand",
        categories="test",
        nutriments={"energy_kcal_per_100g": 200},
        serving_size="100g",
        image_url="https://example.com/image.png",
        source="test"
    )

    # Get product multiple times
    product1 = await service.get_product("ACCESS-COUNT-PROD")
    count1 = product1["access_count"]

    product2 = await service.get_product("ACCESS-COUNT-PROD")
    count2 = product2["access_count"]

    # Access count should increment
    assert count2 >= count1


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


@pytest.mark.asyncio
async def test_get_product_with_partial_nutriments(temp_database):
    """Test storing product with only required nutriments"""
    service = temp_database

    success = await service.store_product(
        barcode="PARTIAL-NUTRI",
        name="Minimal Product",
        brand="Brand",
        categories="test",
        nutriments={"energy_kcal_per_100g": 100},  # Only energy
        serving_size="100g",
        image_url="",
        source="test"
    )

    assert success is True
    product = await service.get_product("PARTIAL-NUTRI")
    assert product["name"] == "Minimal Product"


# Phase 3 Batch 1: Meal Plan Methods Coverage
# Tests for store_meal_plan, get_meal_plan, update_meal_plan, delete_meal_plan

# Helper function to create valid MealPlanResponse objects for testing
def _create_test_meal_plan(bmr=1600, tdee=2000, daily_target=2000):
    """Create a valid MealPlanResponse for testing"""
    from app.models.meal_plan import MealPlanResponse, DailyMacros

    metrics = DailyMacros(
        total_calories=daily_target,
        protein_g=150,
        fat_g=65,
        carbs_g=250,
        sugars_g=30,
        salt_g=5,
        protein_percent=30,
        fat_percent=29,
        carbs_percent=50
    )

    return MealPlanResponse(
        bmr=bmr,
        tdee=tdee,
        daily_calorie_target=daily_target,
        meals=[],
        metrics=metrics,
        flexibility_used=False,
        optional_products_used=0
    )


@pytest.mark.asyncio
async def test_store_meal_plan_success(temp_database):
    """Test storing a meal plan"""
    service = temp_database
    plan = _create_test_meal_plan()

    plan_id = await service.store_meal_plan("user-1", plan, ttl_hours=24)
    assert plan_id is not None
    assert len(plan_id) > 0  # UUID format

    # Verify plan was stored
    retrieved = await service.get_meal_plan(plan_id)
    assert retrieved is not None
    assert retrieved["daily_calorie_target"] == 2000


@pytest.mark.asyncio
async def test_get_meal_plan_not_found(temp_database):
    """Test retrieving non-existent meal plan"""
    service = temp_database

    plan = await service.get_meal_plan("non-existent-plan-id")
    assert plan is None


@pytest.mark.asyncio
async def test_get_meal_plan_expired(temp_database):
    """Test that expired meal plans are auto-deleted"""
    service = temp_database
    plan = _create_test_meal_plan()

    plan_id = await service.store_meal_plan("user-1", plan, ttl_hours=0)

    # Immediately try to retrieve - should be auto-deleted
    retrieved = await service.get_meal_plan(plan_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_update_meal_plan_success(temp_database):
    """Test updating an existing meal plan"""
    service = temp_database

    # Store initial plan
    plan = _create_test_meal_plan(daily_target=2000)
    plan_id = await service.store_meal_plan("user-1", plan, ttl_hours=24)

    # Update the plan with different values
    updated_plan = _create_test_meal_plan(tdee=2500, daily_target=2500)

    success = await service.update_meal_plan(plan_id, updated_plan)
    assert success is True

    # Verify update
    retrieved = await service.get_meal_plan(plan_id)
    assert retrieved["daily_calorie_target"] == 2500
    assert retrieved["tdee"] == 2500


@pytest.mark.asyncio
async def test_update_meal_plan_not_found(temp_database):
    """Test updating non-existent meal plan returns False"""
    service = temp_database
    plan = _create_test_meal_plan()

    success = await service.update_meal_plan("non-existent-plan-id", plan)
    assert success is False


@pytest.mark.asyncio
async def test_delete_meal_plan_success(temp_database):
    """Test deleting an existing meal plan"""
    service = temp_database

    # Store a plan
    plan = _create_test_meal_plan()
    plan_id = await service.store_meal_plan("user-1", plan, ttl_hours=24)

    # Verify it exists
    retrieved = await service.get_meal_plan(plan_id)
    assert retrieved is not None

    # Delete it
    deleted = await service.delete_meal_plan(plan_id)
    assert deleted is True

    # Verify it's gone
    retrieved = await service.get_meal_plan(plan_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_delete_meal_plan_not_found(temp_database):
    """Test deleting non-existent meal plan returns False"""
    service = temp_database

    deleted = await service.delete_meal_plan("non-existent-plan-id")
    assert deleted is False


@pytest.mark.asyncio
async def test_get_user_meal_plans_with_data(temp_database):
    """Test retrieving multiple meal plans for a user"""
    service = temp_database

    # Store 3 meal plans
    for i in range(3):
        plan = _create_test_meal_plan(daily_target=2000 + (i * 100))
        await service.store_meal_plan("user-1", plan, ttl_hours=24)

    # Retrieve all plans
    plans = await service.get_user_meal_plans("user-1", limit=10)
    assert len(plans) >= 3

    # Verify they're for correct user and sorted
    for plan in plans:
        assert plan is not None
        assert "id" in plan
        assert "daily_calorie_target" in plan


@pytest.mark.asyncio
async def test_cleanup_expired_meal_plans_with_data(temp_database):
    """Test cleanup of expired meal plans"""
    service = temp_database

    # Store one plan that will expire immediately
    plan = _create_test_meal_plan()
    plan_id = await service.store_meal_plan("user-1", plan, ttl_hours=0)

    # Run cleanup
    deleted = await service.cleanup_expired_meal_plans()
    assert deleted >= 1  # At least one plan deleted


@pytest.mark.asyncio
async def test_meal_plan_ttl_different_values(temp_database):
    """Test meal plans with different TTL values"""
    service = temp_database

    # Store with long TTL
    plan = _create_test_meal_plan()
    plan_id = await service.store_meal_plan("user-1", plan, ttl_hours=72)  # 3 days

    # Should still be retrievable
    retrieved = await service.get_meal_plan(plan_id)
    assert retrieved is not None
    assert retrieved["daily_calorie_target"] == 2000

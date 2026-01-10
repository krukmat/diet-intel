import pytest
import asyncio
import inspect
import uuid
import os
import tempfile
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient
import httpx

# Ensure a writable DB path is available before importing services that
# instantiate RecipeDatabaseService at import time.
_TEST_DB_FD, _TEST_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="dietintel_test_")
os.close(_TEST_DB_FD)
os.environ.setdefault("DIETINTEL_DB_PATH", _TEST_DB_PATH)

# Lazy import of FastAPI to avoid Pydantic v2 compatibility issues
try:
    from fastapi.testclient import TestClient
except (TypeError, ImportError):
    # Fallback if FastAPI import fails due to Pydantic incompatibility
    TestClient = None


# Compatibility patch: Starlette's TestClient still passes `app=` to httpx.Client,
# but newer httpx releases removed that argument. Re-introduce support so existing
# tests keep working without rewriting all fixtures.
if 'app' not in inspect.signature(httpx.Client.__init__).parameters:
    _httpx_client_init = httpx.Client.__init__

    def _patched_httpx_client_init(self, *args, app=None, **kwargs):
        if app is not None:
            kwargs.setdefault('transport', httpx.ASGITransport(app=app))
        return _httpx_client_init(self, *args, **kwargs)

    httpx.Client.__init__ = _patched_httpx_client_init

if 'app' not in inspect.signature(httpx.AsyncClient.__init__).parameters:
    _httpx_async_client_init = httpx.AsyncClient.__init__

    def _patched_httpx_async_client_init(self, *args, app=None, **kwargs):
        if app is not None:
            kwargs.setdefault('transport', httpx.ASGITransport(app=app))
        return _httpx_async_client_init(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = _patched_httpx_async_client_init

if not hasattr(httpx.AsyncClient, '__enter__'):
    async_client_aenter = httpx.AsyncClient.__aenter__
    async_client_aexit = httpx.AsyncClient.__aexit__

    class _SyncAsyncClientAdapter:
        def __init__(self, client, loop):
            self._client = client
            self._loop = loop

        def __getattr__(self, name):
            attr = getattr(self._client, name)
            if callable(attr):
                def _wrapped(*args, **kwargs):
                    result = attr(*args, **kwargs)
                    if asyncio.iscoroutine(result):
                        return self._loop.run_until_complete(result)
                    return result
                return _wrapped
            return attr

    def _async_client_enter(self):
        loop = asyncio.get_event_loop()
        self.__conftest_loop = loop
        loop.run_until_complete(async_client_aenter(self))
        return _SyncAsyncClientAdapter(self, loop)

    def _async_client_exit(self, exc_type, exc_val, exc_tb):
        loop = getattr(self, '__conftest_loop', asyncio.get_event_loop())
        return loop.run_until_complete(async_client_aexit(self, exc_type, exc_val, exc_tb))

    httpx.AsyncClient.__enter__ = _async_client_enter
    httpx.AsyncClient.__exit__ = _async_client_exit
import pytest

from app.services.cache import CacheService
from app.services.recommendation_engine import RecommendationEngine
from app.services.database import db_service, ConnectionPool
from app.repositories.connection import connection_manager
from app.services.user_service import UserService
from app.models.user import UserSession
from app.services import auth as auth_module


@pytest.fixture(scope="session", autouse=True)
def use_temp_database_for_tests():
    """Route db_service to a temporary SQLite database for the test session."""
    db_path = os.environ.get("DIETINTEL_DB_PATH", _TEST_DB_PATH)

    # Re-point the shared db_service to the temp DB while keeping references intact.
    db_service.db_path = db_path
    connection_manager.db_path = db_path
    max_connections = getattr(db_service.connection_pool, "max_connections", 10)
    db_service.connection_pool = ConnectionPool(db_path, max_connections)
    db_service._vision_tables_initialized = False
    db_service.init_database()

    yield db_path

    for suffix in ("", "-wal", "-shm"):
        try:
            os.unlink(db_path + suffix)
        except FileNotFoundError:
            pass


class InMemoryAsyncCacheService:
    """Simple async cache stub that never touches Redis."""

    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._last_error = None

    async def get(self, key: str) -> Optional[Any]:
        return self._store.get(key)

    async def set(self, key: str, value: Any, ttl: int = 86400, ttl_hours: Optional[int] = None) -> bool:
        if ttl_hours is not None:
            ttl = int(ttl_hours) * 3600
        self._store[key] = value
        return True

    async def delete(self, key: str) -> bool:
        self._store.pop(key, None)
        return True

    async def clear(self) -> bool:
        self._store.clear()
        return True

    async def ping(self) -> bool:
        return True

    def consume_last_error(self):
        return None


class FakeOpenFoodFactsService:
    """Async OpenFoodFacts stub with configurable responses."""

    def __init__(self):
        self.responses: Dict[str, Any] = {}
        self.calls: Dict[str, int] = {}

    async def get_product(self, barcode: str) -> Optional[Any]:
        self.calls[barcode] = self.calls.get(barcode, 0) + 1
        return self.responses.get(barcode)

    def set_product(self, barcode: str, value: Any) -> None:
        self.responses[barcode] = value

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def mock_cache_service():
    """Mock cache service for testing."""
    mock_cache = AsyncMock(spec=CacheService)
    mock_cache.get.return_value = None
    mock_cache.set.return_value = True
    mock_cache.delete.return_value = True
    mock_cache.clear.return_value = True
    return mock_cache


@pytest.fixture
def fake_cache_service():
    """In-memory async cache stub for tests that should avoid real Redis."""
    return InMemoryAsyncCacheService()


@pytest.fixture
def fake_openfoodfacts_service():
    """Configurable OpenFoodFacts stub for tests that run without network."""
    return FakeOpenFoodFactsService()


@pytest.fixture
def product_service_overrides(fake_cache_service, fake_openfoodfacts_service, monkeypatch):
    """Patch product route dependencies to use in-memory fakes.

    Patches both legacy locations and new modular route locations.
    """
    # Legacy paths
    monkeypatch.setattr('app.services.cache.cache_service', fake_cache_service, raising=False)
    monkeypatch.setattr('app.routes.product.cache_service', fake_cache_service, raising=False)
    monkeypatch.setattr('app.services.openfoodfacts.openfoodfacts_service', fake_openfoodfacts_service, raising=False)
    monkeypatch.setattr('app.routes.product.openfoodfacts_service', fake_openfoodfacts_service, raising=False)
    monkeypatch.setattr('app.services.openfoodfacts.OpenFoodFactsService.get_product', fake_openfoodfacts_service.get_product, raising=False)
    monkeypatch.setattr('app.routes.product.openfoodfacts_service.get_product', fake_openfoodfacts_service.get_product, raising=False)

    # New modular route locations (routes split into product_routes, scan_routes, ocr_routes)
    monkeypatch.setattr('app.routes.product.product_routes.cache_service', fake_cache_service, raising=False)
    monkeypatch.setattr('app.routes.product.product_routes.openfoodfacts_service', fake_openfoodfacts_service, raising=False)

    return fake_cache_service, fake_openfoodfacts_service

@pytest.fixture
def mock_recommendation_engine(mock_cache_service):
    """Mock recommendation engine for testing."""
    engine = RecommendationEngine()
    return engine

@pytest.fixture
def sample_user_profile():
    """Sample user profile for testing."""
    return {
        "user_id": "test_user_123",
        "age": 30,
        "sex": "male",
        "height": 175,
        "weight": 70,
        "activity_level": "moderate",
        "goal": "maintain",
        "dietary_preferences": ["vegetarian"],
        "allergies": ["nuts"],
        "medical_conditions": []
    }

@pytest.fixture
def test_database():
    """Create test database with recipe schema."""
    import sqlite3
    import tempfile
    import os

    # Create temporary database file
    db_fd, db_path = tempfile.mkstemp(suffix='.db')

    try:
        # Initialize database with recipe schema
        with sqlite3.connect(db_path) as conn:
            # Create users table first (required by recipe tables)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    hashed_password TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    role TEXT DEFAULT 'standard',
                    is_developer BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Create products table (required by recipe_ingredients)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS products (
                    barcode TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    brand TEXT,
                    category TEXT,
                    image_url TEXT,
                    product_url TEXT,
                    energy_100g REAL DEFAULT 0,
                    proteins_100g REAL DEFAULT 0,
                    fat_100g REAL DEFAULT 0,
                    carbohydrates_100g REAL DEFAULT 0,
                    sugars_100g REAL DEFAULT 0,
                    fiber_100g REAL DEFAULT 0,
                    salt_100g REAL DEFAULT 0,
                    sodium_100g REAL DEFAULT 0,
                    access_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Read and execute recipe schema
            schema_path = os.path.join(os.path.dirname(__file__), '..', 'database', 'init', '02_recipe_tables.sql')
            with open(schema_path, 'r') as f:
                schema_sql = f.read()
            conn.executescript(schema_sql)
            conn.commit()

        yield db_path
    finally:
        # Clean up
        os.close(db_fd)
        os.unlink(db_path)

@pytest.fixture
def sample_context_data():
    """Sample context data for different recommendation contexts."""
    return {
        "general": {
            "time_of_day": "morning",
            "meal_type": "breakfast",
            "preferences": {"high_protein": True}
        },
        "optimize": {
            "current_meal_plan_id": "demo_meal_plan_001",
            "target_calories": 2000,
            "macro_targets": {"protein": 25, "fat": 30, "carbs": 45}
        },
        "insights": {
            "recent_meals": [
                {"calories": 300, "protein": 15, "fat": 10, "carbs": 30},
                {"calories": 500, "protein": 25, "fat": 20, "carbs": 50}
            ],
            "daily_totals": {"calories": 800, "protein": 40, "fat": 30, "carbs": 80}
        }
    }

@pytest.fixture 
def sample_smart_suggestions():
    """Sample smart suggestion responses for testing."""
    return [
        {
            "id": "suggestion_001",
            "product_name": "Greek Yogurt",
            "product_id": "greek_yogurt_001",
            "confidence_score": 0.85,
            "calories": 100,
            "protein": 15,
            "fat": 0,
            "carbs": 6,
            "metadata": {
                "reasons": ["High protein content", "Low calories", "Fits breakfast profile"],
                "nutritional_benefits": ["Supports muscle building", "Good for weight management"]
            }
        },
        {
            "id": "suggestion_002", 
            "product_name": "Oatmeal",
            "product_id": "oatmeal_001",
            "confidence_score": 0.72,
            "calories": 150,
            "protein": 5,
            "fat": 3,
            "carbs": 27,
            "metadata": {
                "reasons": ["Complex carbohydrates", "Fiber rich", "Sustainable energy"],
                "nutritional_benefits": ["Heart healthy", "Digestive health"]
            }
        }
    ]

@pytest.fixture
def sample_nutritional_summary():
    """Sample nutritional summary for testing."""
    return {
        "total_calories": 968,
        "macro_distribution": {
            "protein_percent": 16.6,
            "fat_percent": 27.4,
            "carbs_percent": 52.4
        },
        "daily_progress": {
            "calories_remaining": 1032,
            "protein_remaining": 84,
            "fat_remaining": 45
        },
        "health_benefits": [
            "Improved protein intake",
            "Better micronutrient profile"
        ]
    }


# ===== VISION TESTS AUTH FIXTURES (Option D: Sync seeding) =====

def seed_test_user():
    """Sync seeding of test user/session using direct DB operations."""
    from app.models.user import User, UserRole, UserCreate
    from datetime import datetime, timezone, timedelta
    import asyncio

    user_id = "vision_test_user_123"

    # Clean up any existing data
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
    except Exception:
        pass  # Ignore cleanup errors

    # Create user data
    password = "testpassword123"
    hashed_password = auth_module.auth_service.hash_password(password)
    user_data = UserCreate(
        email="vision_test@example.com",
        password=password,
        full_name="Vision Test User",
        developer_code="DIETINTEL_DEV_2024"
    )

    # Create user using user_service (Phase 2 Batch 9 + Phase 3 Repository Pattern)
    from app.repositories.user_repository import UserRepository
    user_repo = UserRepository()
    user_service = UserService(user_repo)
    user = asyncio.run(user_service.create_user(user_data, hashed_password))
    user_id = user.id

    # Create tokens using auth service
    access_token = auth_module.auth_service.create_access_token(user)
    refresh_token = auth_module.auth_service.create_refresh_token(user)

    # Create session directly
    now = datetime.utcnow().isoformat()
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_sessions (id, user_id, access_token, refresh_token, expires_at, device_info, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), user_id, access_token, refresh_token,
              expires_at.isoformat(), "VisionTestDevice", now))
        conn.commit()

    return {
        "user": user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "created_at": now
    }


@pytest.fixture(scope="function")
def test_auth_data():
    """Synchronous fixture providing seeded user/session data."""
    auth_data = seed_test_user()
    yield auth_data

    # Cleanup after test
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE user_id = ?", (auth_data["user"].id,))
            cursor.execute("DELETE FROM users WHERE id = ?", (auth_data["user"].id,))
            conn.commit()
    except Exception:
        pass  # Ignore cleanup errors in tests


# ===== PHASE 1: In-Memory Database Utilities for Critical Test Fixes =====
# Date: 2025-12-13
# Purpose: Support refactoring of 3 critical test files to use real DB instead of mocks

import sqlite3
from contextlib import contextmanager


class _InMemoryCtx:
    """Context manager for in-memory SQLite database connections.

    Used with monkeypatch to replace db_service.get_connection() in tests.
    Allows tests to use real SQLite operations without mocking.

    Pattern (from test_feed_service.py):
        monkeypatch.setattr(db_service, "get_connection", lambda: _InMemoryCtx(conn))
    """

    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass  # Don't close, fixture handles cleanup


# ===== test_post_service.py Fixtures =====

@pytest.fixture
def post_service_db(monkeypatch):
    """In-memory SQLite database for PostService tests.

    Creates all required tables for post operations:
    - users: User profiles
    - posts: Post content
    - post_media: Media attachments
    - post_reactions: Likes/reactions
    - comments: Post comments

    Usage:
        def test_create_post(post_service_db):
            # Insert test data
            post_service_db.cursor().execute(
                "INSERT INTO users VALUES (?, ?, ?)",
                ("user123", "testuser", "test@example.com")
            )
            # Test code uses real PostService with real db_service
            result = PostService.create_post(...)
            # Verify data persisted
            cursor = post_service_db.cursor()
            cursor.execute("SELECT * FROM posts")
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create user_profiles table (PostService updates this)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id TEXT PRIMARY KEY,
            posts_count INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Create posts table (PHASE 2: Updated to match PostService schema - 2025-12-13)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            author_id TEXT NOT NULL,
            text TEXT NOT NULL,
            visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers_only')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP,
            FOREIGN KEY (author_id) REFERENCES users(id)
        )
    """)

    # Create post_media table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_media (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            type TEXT DEFAULT 'image',
            url TEXT NOT NULL,
            order_position INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    """)

    # Create post_reactions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_reactions (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            reaction_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Create post_comments table (PHASE 2: Renamed from 'comments' to match PostService - 2025-12-13)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (author_id) REFERENCES users(id)
        )
    """)

    # Create post_activity_log table for rate limiting
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_activity_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            activity_type TEXT NOT NULL,
            activity_date TEXT NOT NULL,
            count INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, activity_type, activity_date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    conn.commit()

    # Monkeypatch db_service to use this in-memory database (PHASE 2: Patch at import location - 2025-12-13)
    mock_db_service = type('obj', (object,), {
        'get_connection': lambda self: _InMemoryCtx(conn)
    })()
    # Patch where it's USED in post_service, not just where it's defined
    monkeypatch.setattr('app.services.social.post_service.db_service', mock_db_service)
    monkeypatch.setattr('app.services.database.db_service', mock_db_service)

    yield conn

    # Cleanup: Delete all data from tables to isolate tests (PHASE 2: Added for test isolation - 2025-12-13)
    # Note: Cleanup happens AFTER test, next test gets fresh in-memory DB from new fixture
    try:
        cleanup_cursor = conn.cursor()
        cleanup_cursor.execute("DELETE FROM post_activity_log")
        cleanup_cursor.execute("DELETE FROM post_comments")
        cleanup_cursor.execute("DELETE FROM post_reactions")
        cleanup_cursor.execute("DELETE FROM post_media")
        cleanup_cursor.execute("DELETE FROM posts")
        cleanup_cursor.execute("DELETE FROM user_profiles")
        cleanup_cursor.execute("DELETE FROM users")
        conn.commit()
    except Exception:
        pass  # Cleanup failed, but connection will be closed anyway

    conn.close()


# ===== test_moderation_routes.py Fixtures =====

@pytest.fixture
def moderation_db(monkeypatch):
    """In-memory SQLite database for ReportService/moderation tests.

    Creates all required tables for report operations:
    - users: User profiles (reporters)
    - posts: Posts that can be reported
    - comments: Comments that can be reported
    - content_reports: Report records (PHASE 3: Updated schema to match ReportService - 2025-12-13)

    Usage:
        def test_create_report(client, moderation_db, db_helpers):
            reporter_id = "user_reporter"
            target_id = "post_123"
            db_helpers.insert_test_user(moderation_db, reporter_id, "reporter", "r@test.com")
            db_helpers.insert_test_post(moderation_db, target_id, reporter_id, "test content")

            # Test endpoint
            response = client.post("/reports", json={
                "target_type": "post",
                "target_id": target_id,
                "reason": "spam"
            })

            # Verify report in database
            cursor = moderation_db.cursor()
            cursor.execute("SELECT * FROM content_reports WHERE target_id = ?", (target_id,))
    """
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create posts table (PHASE 3: Added for ReportService._verify_target_exists - 2025-12-13)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            author_id TEXT NOT NULL,
            text TEXT NOT NULL,
            visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers_only')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP,
            FOREIGN KEY (author_id) REFERENCES users(id)
        )
    """)

    # Create comments table (PHASE 3: Added for ReportService._verify_target_exists - 2025-12-13)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id),
            FOREIGN KEY (author_id) REFERENCES users(id)
        )
    """)

    # Create content_reports table (PHASE 3: Renamed from 'reports', updated schema - 2025-12-13)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS content_reports (
            id TEXT PRIMARY KEY,
            reporter_id TEXT NOT NULL,
            target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment', 'user')),
            target_id TEXT NOT NULL,
            reason TEXT NOT NULL CHECK(reason IN ('spam', 'abuse', 'nsfw', 'misinformation', 'other')),
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'moderated_approved', 'moderated_dismissed', 'moderated_escalated')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP,
            reviewed_by TEXT,
            FOREIGN KEY (reporter_id) REFERENCES users(id)
        )
    """)

    conn.commit()

    # Monkeypatch db_service to use this in-memory database (PHASE 3: Patch at import location - 2025-12-13)
    mock_db_service = type('obj', (object,), {
        'get_connection': lambda self: _InMemoryCtx(conn)
    })()
    # Patch where it's USED in report_service, not just where it's defined
    monkeypatch.setattr('app.services.social.report_service.db_service', mock_db_service)
    monkeypatch.setattr('app.services.database.db_service', mock_db_service)

    yield conn

    # Cleanup: Delete all data from tables to isolate tests (PHASE 3: Added for test isolation - 2025-12-13)
    try:
        cleanup_cursor = conn.cursor()
        cleanup_cursor.execute("DELETE FROM content_reports")
        cleanup_cursor.execute("DELETE FROM post_comments")
        cleanup_cursor.execute("DELETE FROM posts")
        cleanup_cursor.execute("DELETE FROM users")
        conn.commit()
    except Exception:
        pass  # Cleanup failed, but connection will be closed anyway

    conn.close()


# ===== test_recipe_ai_routes_extra.py Fixtures =====

@pytest.fixture
def recipe_ai_db(monkeypatch):
    """In-memory SQLite database for RecipeAI service tests.

    Creates all required tables for recipe operations:
    - users: User profiles
    - user_preferences: User dietary preferences
    - recipes: Generated recipes
    - recipe_generations: Tracks recipe generation requests

    Usage:
        @pytest.mark.asyncio
        async def test_generate_recipe(client, recipe_ai_db, test_user):
            user_id = test_user['id']
            # Insert user preferences
            cursor = recipe_ai_db.cursor()
            cursor.execute(
                "INSERT INTO user_preferences VALUES (?, ?)",
                (user_id, '{"dietary_restrictions": [], "cuisine_preferences": ["Italian"]}')
            )
            # Test recipe generation
            response = await client.post(
                "/recipes/generate",
                json={"meal_type": "dinner"}
            )
            # Verify recipe in database
            cursor.execute("SELECT * FROM recipes WHERE user_id = ?", (user_id,))
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create user_preferences table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id TEXT PRIMARY KEY,
            dietary_restrictions TEXT,
            cuisine_preferences TEXT,
            allergies TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Create recipes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            ingredients TEXT,
            instructions TEXT,
            nutrition_info TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Create recipe_generations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipe_generations (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            recipe_id TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (recipe_id) REFERENCES recipes(id)
        )
    """)

    conn.commit()

    # Monkeypatch db_service to use this in-memory database
    monkeypatch.setattr(
        'app.services.database.db_service',
        type('obj', (object,), {
            'get_connection': lambda: _InMemoryCtx(conn)
        })()
    )

    yield conn
    conn.close()


# ===== Helper Functions for Test Data Insertion =====

def insert_test_user(db_conn, user_id, username, email):
    """Insert a test user into database.

    Args:
        db_conn: SQLite connection
        user_id: Unique user ID
        username: Username
        email: Email address
    """
    cursor = db_conn.cursor()
    cursor.execute(
        "INSERT INTO users (id, username, email) VALUES (?, ?, ?)",
        (user_id, username, email)
    )
    # Also create user profile (PostService updates this)
    cursor.execute(
        "INSERT INTO user_profiles (user_id, posts_count) VALUES (?, ?)",
        (user_id, 0)
    )
    db_conn.commit()


def insert_test_post(db_conn, post_id, user_id, text):
    """Insert a test post into database.

    Args:
        db_conn: SQLite connection
        post_id: Unique post ID
        user_id: User who created post (author_id)
        text: Post content
    """
    from datetime import datetime
    cursor = db_conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        "INSERT INTO posts (id, author_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (post_id, user_id, text, now, now)
    )
    db_conn.commit()


def insert_test_reaction(db_conn, reaction_id, post_id, user_id, reaction_type):
    """Insert a test reaction (like/emoji) into database.

    Args:
        db_conn: SQLite connection
        reaction_id: Unique reaction ID
        post_id: Post being reacted to
        user_id: User making reaction
        reaction_type: Type of reaction (like, love, etc.)
    """
    cursor = db_conn.cursor()
    cursor.execute(
        "INSERT INTO post_reactions (id, post_id, user_id, reaction_type) VALUES (?, ?, ?, ?)",
        (reaction_id, post_id, user_id, reaction_type)
    )
    db_conn.commit()


# Make helper functions available to tests via fixture
class DbHelpers:
    """Helper class for database operations in tests"""
    def __init__(self):
        self.insert_test_user = insert_test_user
        self.insert_test_post = insert_test_post
        self.insert_test_reaction = insert_test_reaction


@pytest.fixture
def db_helpers():
    """Provide database helper functions to tests.

    Usage:
        def test_something(post_service_db, db_helpers):
            db_helpers.insert_test_user(post_service_db, "user123", "testuser", "test@example.com")
            db_helpers.insert_test_post(post_service_db, "post123", "user123", "Hello!")
    """
    return DbHelpers()

import pytest
import asyncio
import inspect
import uuid
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from httpx import AsyncClient
import httpx


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
from app.services.database import db_service
from app.models.user import UserSession
from app.services import auth as auth_module


class InMemoryAsyncCacheService:
    """Simple async cache stub that never touches Redis."""

    def __init__(self):
        self._store: Dict[str, Any] = {}

    async def get(self, key: str) -> Optional[Any]:
        return self._store.get(key)

    async def set(self, key: str, value: Any, ttl: int = 86400) -> bool:
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
    """Patch product route dependencies to use in-memory fakes."""
    monkeypatch.setattr('app.services.cache.cache_service', fake_cache_service, raising=False)
    monkeypatch.setattr('app.routes.product.cache_service', fake_cache_service, raising=False)
    monkeypatch.setattr('app.services.openfoodfacts.openfoodfacts_service', fake_openfoodfacts_service, raising=False)
    monkeypatch.setattr('app.routes.product.openfoodfacts_service', fake_openfoodfacts_service, raising=False)
    monkeypatch.setattr('app.services.openfoodfacts.OpenFoodFactsService.get_product', fake_openfoodfacts_service.get_product, raising=False)
    monkeypatch.setattr('app.routes.product.openfoodfacts_service.get_product', fake_openfoodfacts_service.get_product, raising=False)
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
    from app.models.user import User, UserRole
    from datetime import datetime, timezone, timedelta

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
    role = UserRole.DEVELOPER
    now = datetime.utcnow().isoformat()

    # Insert user directly
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, email, password_hash, full_name, is_developer, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, "vision_test@example.com", hashed_password, "Vision Test User",
              1 if role == UserRole.DEVELOPER else 0, role.value, now, now))
        conn.commit()

    # Get user object from database
    from app.models.user import User
    user = User(
        id=user_id,
        email="vision_test@example.com",
        full_name="Vision Test User",
        is_developer=True,
        role=UserRole.DEVELOPER,
        is_active=True,
        email_verified=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        avatar_url=None
    )

    # Create tokens using auth service
    access_token = auth_module.auth_service.create_access_token(user)
    refresh_token = auth_module.auth_service.create_refresh_token(user)

    # Create session directly
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

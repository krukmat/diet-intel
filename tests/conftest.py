import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from httpx import AsyncClient
from app.services.cache import CacheService
from app.services.recommendation_engine import SmartRecommendationEngine

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
def mock_recommendation_engine(mock_cache_service):
    """Mock recommendation engine for testing."""
    engine = SmartRecommendationEngine()
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
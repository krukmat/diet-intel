import json
import sqlite3
import time

import pytest

from app.models.smart_diet import SmartDietContext, SmartDietResponse, SmartDietRequest
from app.services.database import db_service
from app.services.redis_cache import redis_cache_service
from app.services.smart_diet_optimized import OptimizedCacheManager, OptimizedDatabaseService
from app.services.smart_diet_optimized import SmartDietEngineOptimized


@pytest.fixture
def sqlite_connection(tmp_path):
    path = tmp_path / "smart_diet.db"
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE products (
            id TEXT PRIMARY KEY,
            name TEXT,
            barcode TEXT,
            categories TEXT,
            nutriments TEXT,
            access_count INTEGER,
            calories INTEGER
        )
    """)
    nutriments = json.dumps({
        "energy_kcal_per_100g": 120,
        "protein_g_per_100g": 10,
        "fat_g_per_100g": 2
    })
    cursor.execute(
        "INSERT INTO products (id, name, barcode, categories, nutriments, access_count, calories) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("p1", "Test Product", "123", "category-test", nutriments, 10, 200),
    )
    conn.commit()
    yield conn
    conn.close()


class _ConnectionCtx:
    def __init__(self, connection):
        self._connection = connection

    def __enter__(self):
        return self._connection

    def __exit__(self, exc_type, exc, tb):
        pass


@pytest.mark.asyncio
async def test_find_healthier_alternatives_returns_results(monkeypatch, sqlite_connection):
    service = OptimizedDatabaseService()
    monkeypatch.setattr(db_service, "get_connection", lambda: _ConnectionCtx(sqlite_connection))

    current_nutrition = {'calories': 200, 'protein': 5, 'fat': 5}
    alternatives = await service.find_healthier_alternatives_optimized(["test"], current_nutrition, limit=2)

    assert isinstance(alternatives, list)
    assert alternatives[0]['name'] == "Test Product"
    assert alternatives[0]['score'] > 0


@pytest.mark.asyncio
async def test_find_healthier_alternatives_handles_db_error(monkeypatch):
    service = OptimizedDatabaseService()

    class BrokenConn:
        def __enter__(self):
            raise sqlite3.OperationalError("boom")

        def __exit__(self, exc_type, exc, tb):
            pass

    monkeypatch.setattr(db_service, "get_connection", lambda: BrokenConn())

    result = await service.find_healthier_alternatives_optimized(["missing"], {}, limit=1)
    assert result == []


@pytest.mark.asyncio
async def test_find_healthier_alternatives_empty_when_no_matches(monkeypatch, sqlite_connection):
    service = OptimizedDatabaseService()
    cursor = sqlite_connection.cursor()
    cursor.execute("DELETE FROM products")
    sqlite_connection.commit()
    monkeypatch.setattr(db_service, "get_connection", lambda: _ConnectionCtx(sqlite_connection))

    result = await service.find_healthier_alternatives_optimized(["missing"], {}, limit=1)
    assert result == []


@pytest.mark.asyncio
async def test_cache_manager_memory_hit():
    cache = OptimizedCacheManager()
    user_id = "user-mem"
    context = SmartDietContext.TODAY
    request_hash = "hash-mem"
    cache_key = f"smart_diet:{user_id}:{context.value}:{request_hash}"
    response = SmartDietResponse(user_id=user_id, context_type=context)
    cache.memory_cache[cache_key] = (response, time.time())

    result = await cache.get_suggestions_cache(user_id, context, request_hash)

    assert result is response
    assert cache.memory_cache[cache_key][0] is response


@pytest.mark.asyncio
async def test_cache_manager_populates_from_redis(monkeypatch):
    cache = OptimizedCacheManager()
    user_id = "user-redis"
    context = SmartDietContext.TODAY
    request_hash = "hash-redis"
    cache_key = f"smart_diet:{user_id}:{context.value}:{request_hash}"
    response = SmartDietResponse(user_id=user_id, context_type=context)

    async def fake_get(key):
        assert key == cache_key
        return response.json()

    monkeypatch.setattr(redis_cache_service, "get", fake_get)

    result = await cache.get_suggestions_cache(user_id, context, request_hash)

    assert result is not None
    assert cache.memory_cache[cache_key][0].user_id == user_id


@pytest.mark.asyncio
async def test_cache_manager_handles_redis_errors(monkeypatch):
    cache = OptimizedCacheManager()
    user_id = "user-error"
    context = SmartDietContext.TODAY
    request_hash = "hash-error"

    async def raise_error(*args, **kwargs):
        raise RuntimeError("redis failure")

    monkeypatch.setattr(redis_cache_service, "get", raise_error)

    result = await cache.get_suggestions_cache(user_id, context, request_hash)

    assert result is None
    assert cache.memory_cache == {}


def _build_response(user_id: str, context: SmartDietContext) -> SmartDietResponse:
    return SmartDietResponse(user_id=user_id, context_type=context)


@pytest.mark.asyncio
async def test_cache_manager_sets_memory_and_redis(monkeypatch):
    cache = OptimizedCacheManager()
    user_id = "cache-write"
    context = SmartDietContext.TODAY
    request_hash = "hash-write"
    response = _build_response(user_id, context)
    captured = {}

    async def fake_set(key, value, ttl):
        captured['args'] = (key, value, ttl)

    monkeypatch.setattr(redis_cache_service, "set", fake_set)
    monkeypatch.setattr("app.services.smart_diet_optimized.json.dumps", lambda data: "{}", raising=False)

    await cache.set_suggestions_cache(user_id, context, request_hash, response)

    cache_key = f"smart_diet:{user_id}:{context.value}:{request_hash}"
    assert cache_key in cache.memory_cache
    assert captured['args'][0] == cache_key
    assert isinstance(captured['args'][1], str)
    assert captured['args'][2] == cache.cache_ttl[context]


@pytest.mark.asyncio
async def test_cache_manager_ignores_redis_errors(monkeypatch):
    cache = OptimizedCacheManager()
    user_id = "cache-error"
    context = SmartDietContext.TODAY
    request_hash = "hash-error"
    response = _build_response(user_id, context)

    async def raise_error(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(redis_cache_service, "set", raise_error)
    monkeypatch.setattr("app.services.smart_diet_optimized.json.dumps", lambda data: "{}", raising=False)

    await cache.set_suggestions_cache(user_id, context, request_hash, response)

    cache_key = f"smart_diet:{user_id}:{context.value}:{request_hash}"
    assert cache_key in cache.memory_cache


@pytest.mark.asyncio
async def test_get_smart_suggestions_uses_cache(monkeypatch):
    engine = SmartDietEngineOptimized()
    response = _build_response("cached-user", SmartDietContext.TODAY)

    async def fake_get(*args, **kwargs):
        return response

    engine.optimized_cache.get_suggestions_cache = fake_get

    request = SmartDietRequest(user_id="cached-user", context_type=SmartDietContext.TODAY)
    result = await engine.get_smart_suggestions_optimized("cached-user", request)

    assert result is response
    assert engine.performance_monitor.metrics['cache_hits'] == 1

import asyncio
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


# BATCH 2 PHASE 2: Extended tests for parallel execution paths (2025-12-14)
@pytest.mark.asyncio
async def test_parallel_task_execution_cache_miss_generates_response(monkeypatch):
    """Test parallel task paths execute on cache miss and generate response"""
    engine = SmartDietEngineOptimized()

    # Mock cache miss
    async def fake_cache_get(*args, **kwargs):
        return None

    # Mock generator methods to return empty lists (to ensure timeout doesn't trigger)
    async def fake_recommendations(*args, **kwargs):
        return []

    async def fake_optimizations(*args, **kwargs):
        return []

    async def fake_insights(*args, **kwargs):
        return []

    monkeypatch.setattr(engine.optimized_cache, "get_suggestions_cache", fake_cache_get)
    monkeypatch.setattr(engine, "_generate_recommendations_optimized", fake_recommendations)
    monkeypatch.setattr(engine, "_generate_optimizations_optimized", fake_optimizations)
    monkeypatch.setattr(engine, "_generate_insights_optimized", fake_insights)

    request = SmartDietRequest(
        user_id="test-parallel",
        context_type=SmartDietContext.TODAY,
        include_recommendations=True,
        include_optimizations=True
    )

    result = await engine.get_smart_suggestions_optimized("test-parallel", request)

    assert result.user_id == "test-parallel"
    assert isinstance(result.suggestions, list)
    assert engine.performance_monitor.metrics['cache_misses'] >= 1


@pytest.mark.asyncio
async def test_parallel_tasks_timeout_handling(monkeypatch):
    """Test timeout handling in parallel task execution"""
    engine = SmartDietEngineOptimized()
    engine.query_timeout = 0.001  # Very short timeout to force TimeoutError

    async def fake_cache_get(*args, **kwargs):
        return None

    async def slow_task(*args, **kwargs):
        await asyncio.sleep(1)  # Longer than timeout
        return []

    monkeypatch.setattr(engine.optimized_cache, "get_suggestions_cache", fake_cache_get)
    monkeypatch.setattr(engine, "_generate_recommendations_optimized", slow_task)
    monkeypatch.setattr(engine, "_generate_optimizations_optimized", slow_task)
    monkeypatch.setattr(engine, "_generate_insights_optimized", slow_task)

    request = SmartDietRequest(
        user_id="test-timeout",
        context_type=SmartDietContext.TODAY,
        include_recommendations=True,
        include_optimizations=True
    )

    result = await engine.get_smart_suggestions_optimized("test-timeout", request)

    assert result.user_id == "test-timeout"
    assert result.total_suggestions == 0  # Empty due to timeout
    assert result.suggestions == []


@pytest.mark.asyncio
async def test_parallel_task_exception_handling(monkeypatch):
    """Test exception handling in individual parallel tasks"""
    engine = SmartDietEngineOptimized()

    async def fake_cache_get(*args, **kwargs):
        return None

    async def failing_task(*args, **kwargs):
        raise RuntimeError("Task failed")

    async def working_task(*args, **kwargs):
        return []

    monkeypatch.setattr(engine.optimized_cache, "get_suggestions_cache", fake_cache_get)
    monkeypatch.setattr(engine, "_generate_recommendations_optimized", failing_task)
    monkeypatch.setattr(engine, "_generate_optimizations_optimized", working_task)
    monkeypatch.setattr(engine, "_generate_insights_optimized", failing_task)

    request = SmartDietRequest(
        user_id="test-mixed",
        context_type=SmartDietContext.TODAY,
        include_recommendations=True,
        include_optimizations=True
    )

    result = await engine.get_smart_suggestions_optimized("test-mixed", request)

    assert result.user_id == "test-mixed"
    # Should complete successfully with graceful failure handling
    assert result is not None


@pytest.mark.asyncio
async def test_performance_metrics_recorded(monkeypatch):
    """Test that performance metrics are recorded correctly"""
    engine = SmartDietEngineOptimized()

    async def fake_cache_get(*args, **kwargs):
        return None

    async def quick_task(*args, **kwargs):
        return []

    monkeypatch.setattr(engine.optimized_cache, "get_suggestions_cache", fake_cache_get)
    monkeypatch.setattr(engine, "_generate_recommendations_optimized", quick_task)
    monkeypatch.setattr(engine, "_generate_optimizations_optimized", quick_task)
    monkeypatch.setattr(engine, "_generate_insights_optimized", quick_task)

    initial_calls = engine.performance_monitor.metrics['api_calls']

    request = SmartDietRequest(
        user_id="test-metrics",
        context_type=SmartDietContext.TODAY
    )

    result = await engine.get_smart_suggestions_optimized("test-metrics", request)

    assert engine.performance_monitor.metrics['api_calls'] == initial_calls + 1
    assert engine.performance_monitor.metrics['cache_misses'] == 1
    assert len(engine.performance_monitor.metrics['response_times']) > 0


@pytest.mark.asyncio
async def test_batch_items_splits_correctly():
    """Test _batch_items splits items into correct batch sizes"""
    engine = SmartDietEngineOptimized()

    items = list(range(10))
    batches = engine._batch_items(items, batch_size=3)

    assert len(batches) == 4  # 10 items / 3 per batch = 4 batches
    assert batches[0] == [0, 1, 2]
    assert batches[1] == [3, 4, 5]
    assert batches[2] == [6, 7, 8]
    assert batches[3] == [9]


@pytest.mark.asyncio
async def test_process_optimization_batch_handles_empty_items():
    """Test batch processing with empty items"""
    engine = SmartDietEngineOptimized()

    suggestions = await engine._process_optimization_batch([])

    assert suggestions == []


@pytest.mark.asyncio
async def test_process_optimization_batch_db_error_handling(monkeypatch):
    """Test batch processing handles database errors gracefully"""
    engine = SmartDietEngineOptimized()

    async def failing_db(*args, **kwargs):
        raise RuntimeError("Database error")

    monkeypatch.setattr(
        engine.optimized_db,
        "find_healthier_alternatives_optimized",
        failing_db
    )

    items = [{"name": "Test Item", "nutrition": {"calories": 100}}]
    suggestions = await engine._process_optimization_batch(items)

    assert suggestions == []


@pytest.mark.asyncio
async def test_generate_insights_optimized_handles_errors():
    """Test insights generation error handling"""
    engine = SmartDietEngineOptimized()

    # Call with no mocking - should return empty list on error since _generate_quick_insights
    # is not implemented, triggering the exception handler
    request = SmartDietRequest(user_id="test", context_type=SmartDietContext.TODAY)
    result = await engine._generate_insights_optimized("test", request)

    # Should gracefully return empty list on error
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_generate_optimizations_limits_on_no_meal_plan(monkeypatch):
    """Test optimizations returns empty when no meal plan provided"""
    engine = SmartDietEngineOptimized()

    request = SmartDietRequest(
        user_id="test",
        context_type=SmartDietContext.TODAY,
        current_meal_plan_id=None,  # No meal plan
        max_suggestions=5
    )

    result = await engine._generate_optimizations_optimized("test", request)

    assert result == []


@pytest.mark.asyncio
async def test_get_performance_metrics_returns_summary():
    """Test getting performance metrics summary"""
    engine = SmartDietEngineOptimized()

    engine.performance_monitor.record_api_call(100)
    engine.performance_monitor.record_cache_hit()
    engine.performance_monitor.record_cache_miss()

    metrics = engine.get_performance_metrics()

    assert metrics['api_calls'] >= 1
    assert metrics['cache_hits'] >= 1
    assert metrics['cache_misses'] >= 1
    assert 'cache_hit_rate_percent' in metrics
    assert 'total_cache_requests' in metrics

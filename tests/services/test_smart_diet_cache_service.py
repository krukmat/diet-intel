import pytest

from app.services.smart_diet_cache import SmartDietCacheManager
from app.models.smart_diet import SmartDietContext, SmartDietResponse, SmartDietInsights


class DummyAsyncCache:
    def __init__(self):
        self.store = {}
        self.ttl = {}
        self.deleted_keys = []
        self.set_calls = []

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ttl):
        self.store[key] = value
        self.ttl[key] = ttl
        self.set_calls.append((key, ttl))
        return True

    async def delete(self, key):
        existed = key in self.store
        if existed:
            del self.store[key]
        self.deleted_keys.append(key)
        return existed


@pytest.fixture
def cache_manager(monkeypatch):
    cache = DummyAsyncCache()
    monkeypatch.setattr("app.services.smart_diet_cache.get_cache_service", lambda: cache)
    return SmartDietCacheManager(), cache


@pytest.mark.asyncio
async def test_set_and_get_suggestions_cache(cache_manager):
    manager, cache = cache_manager
    response = SmartDietResponse(context_type=SmartDietContext.TODAY, total_suggestions=2, avg_confidence=0.8)
    assert await manager.set_suggestions_cache("user-1", SmartDietContext.TODAY, "hash-1", response)

    ttl = cache.ttl[cache.set_calls[0][0]]
    assert ttl == manager.CACHE_TTL_STRATEGY[SmartDietContext.TODAY]

    cached = await manager.get_suggestions_cache("user-1", SmartDietContext.TODAY, "hash-1")
    assert cached.user_id == response.user_id
    assert cached.total_suggestions == response.total_suggestions


@pytest.mark.asyncio
async def test_insights_cache_round_trip(cache_manager):
    manager, cache = cache_manager
    insights = SmartDietInsights(period="day", user_id="user-2")
    assert await manager.set_insights_cache("user-2", "day", insights)

    cached = await manager.get_insights_cache("user-2", "day")
    assert cached.user_id == "user-2"

    assert cache.ttl[next(iter(cache.ttl))] == manager.CACHE_TTL_STRATEGY[SmartDietContext.INSIGHTS]


@pytest.mark.asyncio
async def test_invalidate_user_cache_removes_keys(cache_manager):
    manager, cache = cache_manager
    # Pre-populate values that should be deleted
    cache.store[manager._generate_cache_key('user_preferences', user_id='user-x')] = {}
    cache.store[manager._generate_cache_key('feedback_analytics', user_id='user-x')] = {}
    for period in ['day', 'week', 'month']:
        cache.store[manager._generate_cache_key('insights', user_id='user-x', period=period)] = {}

    assert await manager.invalidate_user_cache('user-x')
    assert len(cache.deleted_keys) >= 5
    assert not any(key.startswith('smart_diet') for key in cache.store)

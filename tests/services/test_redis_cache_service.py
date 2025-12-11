import pytest

from app.services.redis_cache import redis_cache_service


class DummyRedisClient:
    def __init__(self):
        self.data = {}
        self.last_set = None

    def get(self, key):
        return self.data.get(key)

    def setex(self, key, ttl, value):
        self.last_set = (key, ttl, value)
        self.data[key] = value
        return True

    def delete(self, *keys):
        deleted = 0
        for key in keys:
            if key in self.data:
                deleted += 1
                del self.data[key]
        return deleted

    def keys(self, pattern):
        if pattern.endswith('*'):
            prefix = pattern[:-1]
            return [k for k in self.data if k.startswith(prefix)]
        return [k for k in self.data if pattern == k]

    def exists(self, key):
        return 1 if key in self.data else 0


@pytest.fixture(autouse=True)
def reset_redis_service():
    original_client = redis_cache_service.redis_client
    original_is_connected = redis_cache_service.is_connected
    original_metrics = redis_cache_service.metrics
    original_ttl = redis_cache_service.default_ttl
    original_threshold = redis_cache_service.compression_threshold

    redis_cache_service.redis_client = DummyRedisClient()
    redis_cache_service.is_connected = True
    redis_cache_service.metrics = {
        'hits': 0,
        'misses': 0,
        'sets': 0,
        'errors': 0,
        'total_requests': 0
    }
    redis_cache_service.default_ttl = 60
    redis_cache_service.compression_threshold = 1024
    yield

    redis_cache_service.redis_client = original_client
    redis_cache_service.is_connected = original_is_connected
    redis_cache_service.metrics = original_metrics
    redis_cache_service.default_ttl = original_ttl
    redis_cache_service.compression_threshold = original_threshold


@pytest.mark.asyncio
async def test_get_decompresses_and_tracks_hits():
    service = redis_cache_service
    key = 'favorite-plan'
    normalized = service._normalize_key(key)
    compressed = service._compress_value('salad')
    service.redis_client.data[normalized] = f"COMPRESSED:{compressed}"

    result = await service.get(key)

    assert result == 'salad'
    assert service.metrics['hits'] == 1
    assert service.metrics['total_requests'] == 1


@pytest.mark.asyncio
async def test_get_returns_none_when_disconnected():
    service = redis_cache_service
    service.is_connected = False

    assert await service.get('missing-key') is None


@pytest.mark.asyncio
async def test_set_compresses_large_values_and_updates_metrics():
    service = redis_cache_service
    service.compression_threshold = 1

    success = await service.set('user-profile', 'details')

    assert success
    assert service.redis_client.last_set is not None
    key, ttl, value = service.redis_client.last_set
    assert value.startswith('COMPRESSED:')
    assert service.metrics['sets'] == 1


@pytest.mark.asyncio
async def test_delete_requires_connection_and_returns_bool():
    service = redis_cache_service
    service.redis_client.data[service._normalize_key('wipe-me')] = 'value'
    assert await service.delete('wipe-me') is True

    service.is_connected = False
    assert await service.delete('nothing') is False


@pytest.mark.asyncio
async def test_set_handles_errors_and_counts():
    service = redis_cache_service

    def _raise(*args, **kwargs):
        raise RuntimeError('boom')

    service.redis_client.setex = lambda *a, **k: _raise()

    result = await service.set('key', 'value')

    assert result is False
    assert service.metrics['errors'] == 1

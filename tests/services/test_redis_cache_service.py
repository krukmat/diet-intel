import pytest

from app.services.redis_cache import redis_cache_service


class DummyRedisPipeline:
    def __init__(self, client):
        self.client = client
        self.commands = []

    def get(self, key):
        self.commands.append(('get', key))
        return self

    def setex(self, key, ttl, value):
        self.commands.append(('setex', key, ttl, value))
        return self

    def delete(self, *keys):
        self.commands.append(('delete',) + keys)
        return self

    def execute(self):
        results = []
        for cmd in self.commands:
            action = cmd[0]
            if action == 'get':
                results.append(self.client.get(cmd[1]))
            elif action == 'setex':
                results.append(self.client.setex(cmd[1], cmd[2], cmd[3]))
            elif action == 'delete':
                results.append(self.client.delete(*cmd[1:]))
        self.commands.clear()
        return results


class DummyRedisClient:
    def __init__(self):
        self.data = {}
        self.last_set = None


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

    def pipeline(self):
        return DummyRedisPipeline(self)

    def execute(self):
        results = []
        for cmd in self._pipeline_cmds:
            action = cmd[0]
            if action == 'get':
                results.append(self.get(cmd[1]))
            elif action == 'setex':
                results.append(self.setex(cmd[1], cmd[2], cmd[3]))
            elif action == 'delete':
                results.append(self.delete(*cmd[1:]))
        return results

    def get(self, key):
        return self.data.get(key)


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


@pytest.mark.asyncio
async def test_get_multiple_reports_misses_and_hits():
    service = redis_cache_service
    service.redis_client.data[service._normalize_key('one')] = '1'

    result = await service.get_multiple(['one', 'missing'])

    assert result['one'] == '1'
    assert result['missing'] is None
    assert service.metrics['hits'] == 1
    assert service.metrics['misses'] == 1
    assert service.metrics['total_requests'] == 2


@pytest.mark.asyncio
async def test_set_multiple_stores_all_entries():
    service = redis_cache_service
    pairs = {'first': 'value1', 'second': 'value2'}

    success = await service.set_multiple(pairs)

    assert success
    assert service.metrics['sets'] == len(pairs)
    assert all(service._normalize_key(key) in service.redis_client.data for key in pairs)


@pytest.mark.asyncio
async def test_invalidate_pattern_deletes_all_matches():
    service = redis_cache_service
    service.redis_client.data[service._normalize_key('invalidate-me')] = 'x'
    service.redis_client.data[service._normalize_key('invalidate-other')] = 'y'
    # pattern normalized internally
    count = await service.invalidate_pattern('invalidate*')

    assert count >= 2
    assert not any(key.startswith(service._normalize_key('invalidate')) for key in service.redis_client.data)


@pytest.mark.asyncio
async def test_health_check_returns_success():
    service = redis_cache_service
    response = await service.health_check()

    assert response['healthy'] is True
    assert response['connected'] is True

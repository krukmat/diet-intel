import json
from unittest.mock import AsyncMock, Mock

import pytest

from app.services import cache as cache_module


class _RedisStub:
    def __init__(self):
        self.ping = AsyncMock(return_value=True)
        self.get = AsyncMock(return_value=None)
        self.setex = AsyncMock(return_value=True)
        self.delete = AsyncMock(return_value=1)
        self.close = AsyncMock()


@pytest.mark.asyncio
async def test_get_redis_initializes(monkeypatch):
    redis_stub = _RedisStub()
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    client = await service.get_redis()

    assert client is redis_stub


@pytest.mark.asyncio
async def test_get_redis_reconnects_on_ping_failure(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.ping = AsyncMock(side_effect=RuntimeError("fail"))
    redis_new = _RedisStub()
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_new))

    service = cache_module.CacheService("redis://fake")
    service._redis = redis_stub
    client = await service.get_redis()

    assert client is redis_new


@pytest.mark.asyncio
async def test_ping_success(monkeypatch):
    redis_stub = _RedisStub()
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.ping() is True


@pytest.mark.asyncio
async def test_ping_failure(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.ping = AsyncMock(side_effect=RuntimeError("fail"))
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.ping() is False


@pytest.mark.asyncio
async def test_get_returns_json(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.get = AsyncMock(return_value=json.dumps({"a": 1}))
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.get("key") == {"a": 1}


@pytest.mark.asyncio
async def test_get_returns_raw_string(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.get = AsyncMock(return_value="not-json")
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.get("key") == "not-json"


@pytest.mark.asyncio
async def test_get_cache_miss(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.get = AsyncMock(return_value=None)
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.get("key") is None


@pytest.mark.asyncio
async def test_get_handles_error(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.get = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.get("key") is None
    assert service.consume_last_error() is not None


@pytest.mark.asyncio
async def test_set_with_dict_and_ttl_hours(monkeypatch):
    redis_stub = _RedisStub()
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    result = await service.set("key", {"a": 1}, ttl_hours=1)

    assert result is True
    redis_stub.setex.assert_awaited_once()


@pytest.mark.asyncio
async def test_set_handles_error(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.setex = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.set("key", "value") is False
    assert service.consume_last_error() is not None


@pytest.mark.asyncio
async def test_delete_success(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.delete = AsyncMock(return_value=1)
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.delete("key") is True


@pytest.mark.asyncio
async def test_delete_failure(monkeypatch):
    redis_stub = _RedisStub()
    redis_stub.delete = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    assert await service.delete("key") is False


@pytest.mark.asyncio
async def test_close(monkeypatch):
    redis_stub = _RedisStub()
    monkeypatch.setattr(cache_module.redis, "from_url", Mock(return_value=redis_stub))

    service = cache_module.CacheService("redis://fake")
    await service.get_redis()
    await service.close()
    redis_stub.close.assert_awaited_once()


def test_get_cache_service_singleton(monkeypatch):
    cache_module._cache_service = None
    monkeypatch.setattr(cache_module, "CacheService", Mock())
    cache_module.get_cache_service()
    cache_module.get_cache_service()
    cache_module.CacheService.assert_called_once()

import asyncio

import pytest
from deep_translator.exceptions import TranslationNotFound
from unittest.mock import AsyncMock

from app.services.translation_service import (
    TranslationService,
    get_translation_service,
    _translation_service,
)


class _MemoryCache:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ttl=None, ttl_hours=None):
        self.store[key] = value
        return True


class _FakeLoop:
    async def run_in_executor(self, executor, func, provider_class, text, source_lang, target_lang):
        return func(provider_class, text, source_lang, target_lang)


@pytest.mark.asyncio
async def test_translate_text_returns_input_for_same_language():
    service = TranslationService(_MemoryCache())
    assert await service.translate_text("hola", "es", "es") == "hola"


@pytest.mark.asyncio
async def test_translate_text_returns_none_for_unsupported_language():
    service = TranslationService(_MemoryCache())
    assert await service.translate_text("hello", "xx", "es") is None
    assert await service.translate_text("hello", "en", "yy") is None


@pytest.mark.asyncio
async def test_translate_text_uses_cache(monkeypatch):
    cache = _MemoryCache()
    key = "translation:en:es:hello"
    cache.store[key] = "cache-hit"
    service = TranslationService(cache)
    service._translate_with_libretranslate = AsyncMock()
    service._translate_with_providers = AsyncMock()
    result = await service.translate_text("Hello", "en", "es")
    assert result == "cache-hit"
    service._translate_with_libretranslate.assert_not_awaited()
    service._translate_with_providers.assert_not_awaited()


@pytest.mark.asyncio
async def test_translate_text_calls_providers_and_caches(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    service._translate_with_libretranslate = AsyncMock(return_value=None)
    service._translate_with_providers = AsyncMock(return_value="translated")

    result = await service.translate_text("Hello", "en", "es")
    assert result == "translated"
    cache_key = "translation:en:es:hello"
    assert cache.store[cache_key] == "translated"
    service._translate_with_providers.assert_awaited_once()


@pytest.mark.asyncio
async def test_translate_with_libretranslate_returns_text(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    service.libretranslate_url = "http://fake"

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"translatedText": "hola"}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            return FakeResponse()

    monkeypatch.setattr(
        "app.services.translation_service.httpx.AsyncClient", FakeClient
    )

    assert await service._translate_with_libretranslate("hello", "en", "es") == "hola"


@pytest.mark.asyncio
async def test_translate_with_libretranslate_handles_plain_string(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    service.libretranslate_url = "http://fake"

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return "hola-text"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            return FakeResponse()

    monkeypatch.setattr(
        "app.services.translation_service.httpx.AsyncClient", FakeClient
    )

    assert await service._translate_with_libretranslate("hello", "en", "es") == "hola-text"


@pytest.mark.asyncio
async def test_translate_with_libretranslate_handles_errors(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    service.libretranslate_url = "http://fake"

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def post(self, url, json):
            raise RuntimeError("network")

    monkeypatch.setattr(
        "app.services.translation_service.httpx.AsyncClient", FakeClient
    )

    assert await service._translate_with_libretranslate("hello", "en", "es") is None


def test_supported_languages_and_singleton(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    languages = service.get_supported_languages()
    assert "en" in languages
    monkeypatch.setattr(
        "app.services.translation_service._translation_service", None
    )
    inst_a = get_translation_service(cache)
    inst_b = get_translation_service(cache)
    assert inst_a is inst_b
    assert inst_a.get_supported_languages() == languages


@pytest.mark.asyncio
async def test_translate_with_providers_handles_translate_sync_errors(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    service.TRANSLATION_PROVIDERS = [type("ProviderA", (), {}), type("ProviderB", (), {})]
    monkeypatch.setattr(asyncio, "get_event_loop", lambda: _FakeLoop())

    call_count = {"value": 0}

    def fake_translate_sync(provider_class, text, source_lang, target_lang):
        call_count["value"] += 1
        if call_count["value"] == 1:
            raise TranslationNotFound("missing")
        return "provider-result"

    service._translate_sync = fake_translate_sync

    result = await service._translate_with_providers("hola", "en", "es")
    assert result == "provider-result"


@pytest.mark.asyncio
async def test_translate_food_name_applies_pre_and_post_processing(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    service.translate_text = AsyncMock(return_value="hola")
    translated = await service.translate_food_name("Organic (Fresh) Apple", "en", "es")
    assert translated == "Hola"
    assert service.translate_text.await_count == 1


@pytest.mark.asyncio
async def test_translate_food_names_handles_failures(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    async def _translate(name, source, target):
        if name == "Bad":
            raise ValueError("boom")
        return name + "_es"

    service.translate_food_name = AsyncMock(side_effect=_translate)
    results = await service.translate_food_names(["Good", "Bad"], "en", "es")
    assert results["Good"] == "Good_es"
    assert results["Bad"] is None


@pytest.mark.asyncio
async def test_libretranslate_health_reports_status(monkeypatch):
    cache = _MemoryCache()
    service = TranslationService(cache)
    service.libretranslate_url = None
    assert await service.libretranslate_health() == "disabled"

    service.libretranslate_url = "http://fake"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

        async def get(self, url):
            class Response:
                def raise_for_status(self):
                    pass

            return Response()

    monkeypatch.setattr(
        "app.services.translation_service.httpx.AsyncClient", FakeClient
    )
    assert await service.libretranslate_health() == "available"

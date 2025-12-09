import pytest
from unittest.mock import AsyncMock, patch

from app.services.recipe_translation_service import RecipeTranslationService
from app.services.translation_service import TranslationService


class FakeCache:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ttl=86400):
        self.store[key] = value
        return True


@pytest.mark.asyncio
async def test_translate_recipe_name_fallback(monkeypatch):
    cache = FakeCache()
    translation_service = TranslationService(cache)
    recipe_translation_service = RecipeTranslationService(translation_service=translation_service, cache_service=cache)

    async def _mock_translate_text(*args, **kwargs):
        return None

    with patch.object(translation_service, 'translate_text', new=AsyncMock(side_effect=_mock_translate_text)):
        result = await recipe_translation_service.translate_recipe_name('Healthy Chicken Dinner Bowl')

    assert result != 'Healthy Chicken Dinner Bowl'
    assert 'pollo' in result.lower()  # chicken -> pollo from terminology
    assert 'cena' in result.lower()   # dinner -> cena from fallback dictionary


@pytest.mark.asyncio
async def test_translate_description_fallback(monkeypatch):
    cache = FakeCache()
    translation_service = TranslationService(cache)
    recipe_translation_service = RecipeTranslationService(translation_service=translation_service, cache_service=cache)

    description = 'A quick and delicious dinner with rice and vegetables ready in 20 minutes.'

    with patch.object(translation_service, 'translate_text', new=AsyncMock(return_value=None)):
        translated = await recipe_translation_service.translate_recipe_description(description)

    lower = translated.lower()
    assert 'rápido' in lower or 'rapido' in lower  # quick -> rápido fallback
    assert 'cena' in lower  # dinner -> cena
    assert 'arroz' in lower  # rice -> arroz
    assert 'minutos' in lower  # minutes -> minutos


@pytest.mark.asyncio
async def test_translate_text_uses_libretranslate(monkeypatch):
    cache = FakeCache()
    translation_service = TranslationService(cache)
    translation_service.libretranslate_url = "http://localhost:5000"

    with patch.object(translation_service, '_translate_with_libretranslate', new=AsyncMock(return_value="pollo asado")) as mock_libre:
        result = await translation_service.translate_text('roasted chicken', 'en', 'es')

    assert result == 'pollo asado'
    mock_libre.assert_awaited()
    cache_key = translation_service._get_cache_key('roasted chicken', 'en', 'es')
    assert cache.store.get(cache_key) == 'pollo asado'


@pytest.mark.asyncio
async def test_translate_text_libretranslate_failure_falls_back(monkeypatch):
    cache = FakeCache()
    translation_service = TranslationService(cache)
    translation_service.libretranslate_url = "http://localhost:5000"

    with patch.object(translation_service, '_translate_with_libretranslate', new=AsyncMock(return_value=None)), \
         patch.object(translation_service, '_translate_with_providers', new=AsyncMock(return_value='pollo a la parrilla')) as mock_provider:
        result = await translation_service.translate_text('grilled chicken', 'en', 'es')

    assert result == 'pollo a la parrilla'
    mock_provider.assert_awaited()

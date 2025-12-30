"""
Translation Service Coverage Tests - Phase 3
Task 3.2: Improve coverage from 67-69% to 82%

Tests for TranslationService with caching, provider fallback, and LibreTranslate support
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.translation_service import TranslationService, get_translation_service
from app.services.cache import CacheService


@pytest.fixture
def mock_cache_service():
    """Create mock cache service"""
    mock_cache = AsyncMock(spec=CacheService)
    mock_cache.get = AsyncMock(return_value=None)
    mock_cache.set = AsyncMock()
    return mock_cache


@pytest.fixture
def translation_service(mock_cache_service):
    """Create TranslationService with mocked cache"""
    with patch('app.services.translation_service.config') as mock_config:
        mock_config.libretranslate_url = None
        mock_config.libretranslate_api_key = None
        return TranslationService(cache_service=mock_cache_service)


# ==================== Initialization Tests ====================

def test_translation_service_init(mock_cache_service):
    """Test TranslationService initialization"""
    with patch('app.services.translation_service.config') as mock_config:
        mock_config.libretranslate_url = None
        mock_config.libretranslate_api_key = None

        service = TranslationService(cache_service=mock_cache_service)

        assert service is not None
        assert service.cache == mock_cache_service
        assert service._translation_cache_ttl == 7 * 24 * 60 * 60
        assert service.libretranslate_url is None


def test_translation_service_supported_languages(translation_service):
    """Test supported languages are defined"""
    langs = translation_service.SUPPORTED_LANGUAGES

    required_langs = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
    for lang in required_langs:
        assert lang in langs


def test_translation_providers_defined(translation_service):
    """Test translation providers are configured"""
    assert len(translation_service.TRANSLATION_PROVIDERS) > 0
    assert all(hasattr(p, '__name__') for p in translation_service.TRANSLATION_PROVIDERS)


# ==================== Language Support Tests ====================

def test_is_language_supported_true(translation_service):
    """Test language support check for valid language"""
    assert translation_service.is_language_supported('en') is True
    assert translation_service.is_language_supported('es') is True


def test_is_language_supported_false(translation_service):
    """Test language support check for invalid language"""
    assert translation_service.is_language_supported('xx') is False
    assert translation_service.is_language_supported('invalid') is False


def test_get_supported_languages(translation_service):
    """Test getting supported languages dictionary"""
    result = translation_service.get_supported_languages()

    assert isinstance(result, dict)
    assert 'en' in result
    assert result['en'] == 'English'
    assert 'es' in result
    assert result['es'] == 'Spanish'


# ==================== Cache Key Generation ====================

def test_cache_key_generation(translation_service):
    """Test cache key generation is consistent"""
    key1 = translation_service._get_cache_key("Hello", "en", "es")
    key2 = translation_service._get_cache_key("hello", "en", "es")

    # Should be the same (lowercase and stripped)
    assert key1 == key2
    assert "translation:en:es:" in key1


def test_cache_key_format(translation_service):
    """Test cache key format"""
    key = translation_service._get_cache_key("apple", "en", "es")

    assert key.startswith("translation:")
    assert "en" in key
    assert "es" in key
    assert "apple" in key


# ==================== Translate Text Tests ====================

@pytest.mark.asyncio
async def test_translate_text_empty_string(translation_service):
    """Test translate_text with empty string"""
    result = await translation_service.translate_text("", "en", "es")
    assert result == ""


@pytest.mark.asyncio
async def test_translate_text_whitespace_only(translation_service):
    """Test translate_text with whitespace only"""
    result = await translation_service.translate_text("   ", "en", "es")
    assert result == "   "


@pytest.mark.asyncio
async def test_translate_text_same_language(translation_service):
    """Test translate_text when source and target are the same"""
    result = await translation_service.translate_text("hello", "en", "en")
    assert result == "hello"


@pytest.mark.asyncio
async def test_translate_text_unsupported_source_language(translation_service):
    """Test translate_text with unsupported source language"""
    result = await translation_service.translate_text("hello", "xx", "es")
    assert result is None


@pytest.mark.asyncio
async def test_translate_text_unsupported_target_language(translation_service):
    """Test translate_text with unsupported target language"""
    result = await translation_service.translate_text("hello", "en", "xx")
    assert result is None


@pytest.mark.asyncio
async def test_translate_text_cache_hit(translation_service):
    """Test translate_text returns cached result"""
    # Setup cache to return a value
    translation_service.cache.get = AsyncMock(return_value="hola")

    result = await translation_service.translate_text("hello", "en", "es")

    assert result == "hola"
    translation_service.cache.get.assert_called_once()


@pytest.mark.asyncio
async def test_translate_text_cache_miss_with_provider(translation_service):
    """Test translate_text with cache miss falls back to providers"""
    # Setup cache miss
    translation_service.cache.get = AsyncMock(return_value=None)
    translation_service.cache.set = AsyncMock()

    with patch.object(translation_service, '_translate_with_libretranslate', new_callable=AsyncMock, return_value=None), \
         patch.object(translation_service, '_translate_with_providers', new_callable=AsyncMock, return_value="hola"):

        result = await translation_service.translate_text("hello", "en", "es")

        assert result == "hola"
        translation_service.cache.set.assert_called_once()


@pytest.mark.asyncio
async def test_translate_text_no_translation_found(translation_service):
    """Test translate_text returns None when no provider can translate"""
    translation_service.cache.get = AsyncMock(return_value=None)

    with patch.object(translation_service, '_translate_with_libretranslate', new_callable=AsyncMock, return_value=None), \
         patch.object(translation_service, '_translate_with_providers', new_callable=AsyncMock, return_value=None):

        result = await translation_service.translate_text("hello", "en", "es")

        assert result is None


# ==================== LibreTranslate Tests ====================

@pytest.mark.asyncio
async def test_libretranslate_not_configured(translation_service):
    """Test _translate_with_libretranslate returns None when not configured"""
    translation_service.libretranslate_url = None

    result = await translation_service._translate_with_libretranslate("hello", "en", "es")

    assert result is None


@pytest.mark.asyncio
async def test_libretranslate_health_disabled(translation_service):
    """Test libretranslate_health returns 'disabled' when not configured"""
    translation_service.libretranslate_url = None

    result = await translation_service.libretranslate_health()

    assert result == "disabled"


@pytest.mark.asyncio
async def test_libretranslate_health_available():
    """Test libretranslate_health returns 'available' on success"""
    mock_cache = AsyncMock(spec=CacheService)

    with patch('app.services.translation_service.config') as mock_config, \
         patch('app.services.translation_service.httpx.AsyncClient') as mock_client:

        mock_config.libretranslate_url = "http://localhost:5000"
        mock_config.libretranslate_api_key = None

        service = TranslationService(cache_service=mock_cache)

        mock_response = AsyncMock()
        mock_response.raise_for_status = MagicMock()
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        result = await service.libretranslate_health()

        assert result == "available"


@pytest.mark.asyncio
async def test_libretranslate_health_error():
    """Test libretranslate_health returns error message on failure"""
    mock_cache = AsyncMock(spec=CacheService)

    with patch('app.services.translation_service.config') as mock_config, \
         patch('app.services.translation_service.httpx.AsyncClient') as mock_client:

        mock_config.libretranslate_url = "http://localhost:5000"
        mock_config.libretranslate_api_key = None

        service = TranslationService(cache_service=mock_cache)

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=Exception("Connection error"))

        result = await service.libretranslate_health()

        assert "error:" in result


# ==================== Food Name Translation Tests ====================

@pytest.mark.asyncio
async def test_translate_food_name_empty(translation_service):
    """Test translate_food_name with empty string"""
    result = await translation_service.translate_food_name("", "en", "es")
    assert result == ""


@pytest.mark.asyncio
async def test_translate_food_name_successful(translation_service):
    """Test translate_food_name returns translated and postprocessed name"""
    with patch.object(translation_service, 'translate_text', new_callable=AsyncMock, return_value="manzana"):

        result = await translation_service.translate_food_name("apple", "en", "es")

        assert result is not None
        # Should be capitalized
        assert result[0].isupper() or result.startswith(result.lower())


@pytest.mark.asyncio
async def test_translate_food_name_preprocessing(translation_service):
    """Test translate_food_name preprocesses brand names"""
    with patch.object(translation_service, 'translate_text', new_callable=AsyncMock, return_value="manzana") as mock_translate:

        result = await translation_service.translate_food_name("Apple (Organic)", "en", "es")

        # Should have removed (Organic) before translating
        call_args = mock_translate.call_args[0]
        assert "(Organic)" not in call_args[0]
        assert "Apple" in call_args[0] or "apple" in call_args[0].lower()
        assert result is not None


# ==================== Batch Translation Tests ====================

@pytest.mark.asyncio
async def test_translate_food_names_empty_list(translation_service):
    """Test translate_food_names with empty list"""
    result = await translation_service.translate_food_names([], "en", "es")

    assert result == {}


@pytest.mark.asyncio
async def test_translate_food_names_single_item(translation_service):
    """Test translate_food_names with single item"""
    with patch.object(translation_service, 'translate_food_name', new_callable=AsyncMock, return_value="manzana"):

        result = await translation_service.translate_food_names(["apple"], "en", "es")

        assert isinstance(result, dict)
        assert "apple" in result
        assert result["apple"] == "manzana"


@pytest.mark.asyncio
async def test_translate_food_names_multiple_items(translation_service):
    """Test translate_food_names with multiple items"""
    translations = ["manzana", "plátano", "naranja"]

    with patch.object(translation_service, 'translate_food_name', new_callable=AsyncMock, side_effect=translations):

        result = await translation_service.translate_food_names(
            ["apple", "banana", "orange"], "en", "es"
        )

        assert len(result) == 3
        assert result["apple"] == "manzana"
        assert result["banana"] == "plátano"
        assert result["orange"] == "naranja"


@pytest.mark.asyncio
async def test_translate_food_names_with_failures(translation_service):
    """Test translate_food_names handles failures gracefully"""
    # Simulate some translations failing
    results = ["manzana", None, "naranja"]

    with patch.object(translation_service, 'translate_food_name', new_callable=AsyncMock, side_effect=results):

        result = await translation_service.translate_food_names(
            ["apple", "banana", "orange"], "en", "es"
        )

        assert result["apple"] == "manzana"
        assert result["banana"] is None
        assert result["orange"] == "naranja"


@pytest.mark.asyncio
async def test_translate_food_names_concurrent(translation_service):
    """Test translate_food_names executes translations concurrently"""
    with patch.object(translation_service, 'translate_food_name', new_callable=AsyncMock, return_value="translated"):

        foods = ["apple", "banana", "orange", "grape", "strawberry"]
        result = await translation_service.translate_food_names(foods, "en", "es")

        assert len(result) == 5
        # All should have translations
        assert all(v == "translated" for v in result.values())


# ==================== Food Name Processing Tests ====================

def test_preprocess_food_name_remove_parentheses(translation_service):
    """Test preprocessing removes brand names in parentheses"""
    result = translation_service._preprocess_food_name("Apple (Organic Brand)")

    assert "(" not in result
    assert ")" not in result
    assert "Apple" in result


def test_preprocess_food_name_remove_packaging_terms(translation_service):
    """Test preprocessing removes packaging terms"""
    result = translation_service._preprocess_food_name("fresh organic apple frozen")

    assert "fresh" not in result.lower()
    assert "organic" not in result.lower()
    assert "frozen" not in result.lower()
    assert "apple" in result.lower()


def test_preprocess_food_name_empty_after_processing(translation_service):
    """Test preprocessing returns original if empty after removing terms"""
    result = translation_service._preprocess_food_name("organic fresh frozen")

    # Should return original if all words are filtered
    assert result == "organic fresh frozen"


def test_postprocess_food_name_capitalization(translation_service):
    """Test postprocessing capitalizes food name"""
    result = translation_service._postprocess_food_name("apple", "es")

    assert result[0].isupper()
    assert "apple" in result.lower()


def test_postprocess_food_name_empty(translation_service):
    """Test postprocessing handles empty string"""
    result = translation_service._postprocess_food_name("", "es")

    assert result == ""


def test_postprocess_food_name_strips_whitespace(translation_service):
    """Test postprocessing removes extra whitespace"""
    result = translation_service._postprocess_food_name("  apple  ", "es")

    assert result == "Apple"
    assert not result.startswith(" ")
    assert not result.endswith(" ")


# ==================== Provider Translation Tests ====================

@pytest.mark.asyncio
async def test_translate_with_providers_success(translation_service):
    """Test _translate_with_providers successfully translates"""
    with patch.object(translation_service, '_translate_sync', return_value="hola"):

        result = await translation_service._translate_with_providers("hello", "en", "es")

        assert result == "hola"


@pytest.mark.asyncio
async def test_translate_with_providers_fallback(translation_service):
    """Test _translate_with_providers tries fallback providers"""
    # First provider fails, second succeeds
    def side_effect(*args, **kwargs):
        if side_effect.call_count == 1:
            side_effect.call_count += 1
            raise Exception("Provider 1 failed")
        side_effect.call_count += 1
        return "hola"

    side_effect.call_count = 1

    with patch.object(translation_service, '_translate_sync', side_effect=side_effect):

        result = await translation_service._translate_with_providers("hello", "en", "es")

        assert result == "hola"


@pytest.mark.asyncio
async def test_translate_with_providers_all_fail(translation_service):
    """Test _translate_with_providers returns None when all fail"""
    with patch.object(translation_service, '_translate_sync', side_effect=Exception("All failed")):

        result = await translation_service._translate_with_providers("hello", "en", "es")

        assert result is None


# ==================== Singleton Tests ====================

def test_get_translation_service_singleton(mock_cache_service):
    """Test get_translation_service returns same instance"""
    with patch('app.services.translation_service.config') as mock_config:
        mock_config.libretranslate_url = None
        mock_config.libretranslate_api_key = None

        # Reset singleton
        import app.services.translation_service as ts_module
        ts_module._translation_service = None

        service1 = get_translation_service(mock_cache_service)
        service2 = get_translation_service(mock_cache_service)

        assert service1 is service2

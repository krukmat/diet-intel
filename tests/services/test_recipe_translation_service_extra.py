import httpx
import pytest

from deep_translator.exceptions import TranslationNotFound

from app.models.recipe import (
    CreatedBy,
    DifficultyLevel,
    GeneratedRecipeResponse,
    RecipeIngredientResponse,
    RecipeInstructionResponse,
    RecipeNutritionResponse,
)
from app.services import translation_service as translation_mod
from app.services.recipe_translation_service import RecipeTranslationService
from app.services.translation_service import TranslationService


class DummyCache:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ttl=None, **kwargs):
        self.store[key] = value
        return True


class DummyTranslator:
    def __init__(self, source, target):
        self.source = source
        self.target = target

    def translate(self, text):
        return f"{text}-translated"


class FailingTranslator(DummyTranslator):
    def translate(self, text):
        raise TranslationNotFound("not found")


@pytest.mark.asyncio
async def test_translate_text_returns_input_for_same_language():
    service = TranslationService(DummyCache())

    result = await service.translate_text("hola", "es", "es")
    assert result == "hola"


@pytest.mark.asyncio
async def test_translate_text_returns_none_for_unsupported_language():
    service = TranslationService(DummyCache())

    result = await service.translate_text("hola", "zz", "en")
    assert result is None


@pytest.mark.asyncio
async def test_translate_text_uses_cache(monkeypatch):
    service = TranslationService(DummyCache())
    service.libretranslate_url = None

    cache_key = service._get_cache_key("hello", "en", "es")
    await service.cache.set(cache_key, "cached", ttl=10)

    result = await service.translate_text("hello", "en", "es")
    assert result == "cached"


@pytest.mark.asyncio
async def test_translate_text_falls_back_to_providers(monkeypatch):
    service = TranslationService(DummyCache())
    service.libretranslate_url = None

    service.TRANSLATION_PROVIDERS = [FailingTranslator, DummyTranslator]

    async def fake_libre(*args, **kwargs):
        return None

    monkeypatch.setattr(service, "_translate_with_libretranslate", fake_libre)

    result = await service.translate_text("hola", "es", "en")
    assert result == "hola-translated"


@pytest.mark.asyncio
async def test_translate_with_libretranslate_handles_http_errors(monkeypatch):
    service = TranslationService(DummyCache())
    service.libretranslate_url = "http://libre.test"

    class DummyClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            raise httpx.RequestError("timeout")

    monkeypatch.setattr(translation_mod.httpx, "AsyncClient", DummyClient)

    result = await service._translate_with_libretranslate("test", "en", "es")
    assert result is None


def test_get_translation_service_returns_same_instance(monkeypatch):
    monkeypatch.setattr(translation_mod, "_translation_service", None)
    cache = DummyCache()

    first = translation_mod.get_translation_service(cache)
    second = translation_mod.get_translation_service(cache)

    assert first is second


class DummyRecipeTranslationService:
    def __init__(self, response=None, raise_exc=False):
        self.response = response
        self.raise_exc = raise_exc

    async def translate_text(self, *args, **kwargs):
        if self.raise_exc:
            raise RuntimeError("translation failed")
        return self.response


def _make_sample_recipe_response():
    ingredient = RecipeIngredientResponse(name="tomato", quantity=1, unit="pcs")
    instruction = RecipeInstructionResponse(step_number=1, instruction="Cook it", cooking_method="bake")
    nutrition = RecipeNutritionResponse(calories_per_serving=200, protein_g_per_serving=10)
    return GeneratedRecipeResponse(
        id="trans-1",
        name="Sample",
        description="Sample recipe",
        cuisine_type="test",
        difficulty_level=DifficultyLevel.EASY,
        prep_time_minutes=10,
        cook_time_minutes=20,
        servings=2,
        ingredients=[ingredient],
        instructions=[instruction],
        nutrition=nutrition,
        created_by=CreatedBy.AI_GENERATED,
        confidence_score=0.5,
        generation_time_ms=10.0,
        tags=["test"],
        created_at=None,
        updated_at=None
    )


@pytest.mark.asyncio
async def test_translate_recipe_name_uses_translation():
    service = RecipeTranslationService(
        translation_service=DummyRecipeTranslationService(response="hola"),
        cache_service=DummyCache()
    )

    translated = await service.translate_recipe_name("hello")
    assert translated == "hola"


@pytest.mark.asyncio
async def test_translate_recipe_name_falls_back_to_dictionary():
    service = RecipeTranslationService(
        translation_service=DummyRecipeTranslationService(response=None),
        cache_service=DummyCache()
    )

    translated = await service.translate_recipe_name("bake chicken")
    assert "hornear" in translated.lower()


def test_replace_case_insensitive_preserves_case():
    service = RecipeTranslationService(
        translation_service=DummyRecipeTranslationService(response="hola"),
        cache_service=DummyCache()
    )

    result = service._replace_case_insensitive("Bake and BAKE", "bake", "hornear")
    assert "hornear" in result.lower()


@pytest.mark.asyncio
async def test_translate_complete_recipe_handles_translation_exception(monkeypatch):
    service = RecipeTranslationService(
        translation_service=DummyRecipeTranslationService(response="hola"),
        cache_service=DummyCache()
    )
    recipe = _make_sample_recipe_response()

    async def fail_translate(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(service, "translate_recipe_name", fail_translate)

    with pytest.raises(Exception) as excinfo:
        await service.translate_complete_recipe(recipe)

    assert "translation failed" in str(excinfo.value)

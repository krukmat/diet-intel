import pytest

from app.models.recipe import (
    RecipeIngredientResponse,
    RecipeInstructionResponse,
    RecipeNutritionResponse,
    DifficultyLevel,
    CreatedBy,
    GeneratedRecipeResponse
)
from app.services.recipe_translation_service import RecipeTranslationService


class DummyTranslationService:
    def __init__(self, response="translated", raise_exc=False):
        self.response = response
        self.raise_exc = raise_exc
        self.calls = 0

    async def translate_text(self, **kwargs):
        self.calls += 1
        if self.raise_exc:
            raise RuntimeError("failure")
        return self.response


class DummyCacheService:
    def __init__(self):
        self.store = {}
        self.get_calls = 0
        self.set_calls = 0

    async def get(self, key):
        self.get_calls += 1
        return self.store.get(key)

    async def set(self, key, value, ttl):
        self.set_calls += 1
        self.store[key] = value


@pytest.mark.asyncio
async def test_translate_recipe_name_uses_cache():
    translation_service = DummyTranslationService(response="cached-value")
    cache = DummyCacheService()
    service = RecipeTranslationService(translation_service=translation_service, cache_service=cache)

    cache_key = service._get_cache_key("tomato", "recipe_name")
    cache.store[cache_key] = "cached-value"

    result = await service.translate_recipe_name("tomato")
    assert result == "cached-value"
    assert translation_service.calls == 0
    assert cache.get_calls >= 1


@pytest.mark.asyncio
async def test_translate_description_fallback_on_error():
    translation_service = DummyTranslationService(raise_exc=True)
    cache = DummyCacheService()
    service = RecipeTranslationService(translation_service=translation_service, cache_service=cache)

    result = await service.translate_recipe_description("olive oil and salt")
    assert "aceite de oliva" in result
    assert "sal" in result
    assert translation_service.calls == 1


def _build_recipe(name="Soup", description="Hot soup"):
    ingredient = RecipeIngredientResponse(name="tomato", quantity=1.0, unit="pcs")
    instruction = RecipeInstructionResponse(step_number=1, instruction="Chop tomatoes")

    return GeneratedRecipeResponse(
        id="r1",
        name=name,
        description=description,
        cuisine_type="american",
        difficulty_level=DifficultyLevel.EASY,
        prep_time_minutes=10,
        cook_time_minutes=5,
        servings=2,
        ingredients=[ingredient],
        instructions=[instruction],
        nutrition=RecipeNutritionResponse(),
        created_by=CreatedBy.AI_GENERATED,
        confidence_score=0.9,
        generation_time_ms=100.0,
        tags=["comfort"]
    )


def test_calculate_translation_quality_score():
    service = RecipeTranslationService(
        translation_service=DummyTranslationService(),
        cache_service=DummyCacheService()
    )

    original = _build_recipe()
    translated = _build_recipe(name="Soup", description="Hot soup")
    translated.ingredients[0].name = "sopa"

    score = service.calculate_translation_quality_score(original, translated)
    assert pytest.approx(0.6, rel=1e-2) == score

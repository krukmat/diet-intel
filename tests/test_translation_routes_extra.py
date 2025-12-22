import pytest

from fastapi import HTTPException

from app.models.translation import TranslationRequest, FoodTranslationRequest, BatchTranslationRequest
from app.routes.translation import translate_text, translate_food_name, batch_translate_texts


class DummyTranslationService:
    def __init__(self, supported=None, text_map=None, food_map=None):
        self.supported_languages = supported or {"en", "es"}
        self.text_map = text_map or {}
        self.food_map = food_map or {}

    def is_language_supported(self, lang: str) -> bool:
        return lang in self.supported_languages

    async def translate_text(self, text: str, source_lang: str, target_lang: str):
        return self.text_map.get(text)

    async def translate_food_name(self, food_name: str, source_lang: str, target_lang: str):
        return self.food_map.get(food_name)


@pytest.mark.asyncio
async def test_translate_text_declines_unsupported_language():
    service = DummyTranslationService(supported={"en"})
    request = TranslationRequest(text="hola", source_lang="es", target_lang="de")

    with pytest.raises(HTTPException) as excinfo:
        await translate_text(request, service)

    assert excinfo.value.status_code == 400


@pytest.mark.asyncio
async def test_translate_food_name_returns_translation():
    service = DummyTranslationService(
        supported={"en", "es"},
        food_map={"taco": "taco"},
    )
    request = FoodTranslationRequest(text="taco", source_lang="es", target_lang="en")

    response = await translate_food_name(request, service)

    assert response.translated_text == "taco"
    assert response.success is True


@pytest.mark.asyncio
async def test_batch_translation_counts_successes_and_failures():
    service = DummyTranslationService(
        supported={"en", "es"},
        text_map={"uno": "one", "dos": None}
    )
    request = BatchTranslationRequest(texts=["uno", "dos"], source_lang="es", target_lang="en")

    response = await batch_translate_texts(request, service)

    assert response.successful_count == 1
    assert response.failed_count == 1
    assert response.translations["dos"] is None

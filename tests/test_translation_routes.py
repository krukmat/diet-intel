from typing import Dict

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routes import translation as translation_routes


class _FakeCache:
    async def ping(self):
        return True


class _FakeProvider:
    def __init__(self, source: str, target: str):
        self.source = source
        self.target = target


class _FakeTranslationService:
    TRANSLATION_PROVIDERS = [_FakeProvider]

    def __init__(self):
        self.cache = _FakeCache()
        self._supported = {"en": "English", "es": "Spanish"}
        self._text_map = {"Hello": "Hola", "Bye": None}

    def is_language_supported(self, lang: str) -> bool:
        return lang in self._supported

    async def translate_text(self, text: str, source_lang: str, target_lang: str):
        return self._text_map.get(text, f"{text}-{target_lang}")

    async def translate_food_name(self, food_name: str, source_lang: str, target_lang: str):
        return f"{food_name}-food-{target_lang}"

    async def translate_food_names(self, food_names, source_lang: str, target_lang: str) -> Dict[str, str]:
        return {name: f"{name}-food-{target_lang}" for name in food_names}

    def get_supported_languages(self):
        return self._supported

    async def libretranslate_health(self) -> str:
        return "available"


@pytest.fixture
def translation_client():
    app.dependency_overrides[
        translation_routes.get_translation_service_dependency
    ] = lambda: _FakeTranslationService()
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(translation_routes.get_translation_service_dependency, None)


def test_translate_text_success(translation_client):
    response = translation_client.post(
        "/translate/text",
        json={"text": "Hello", "source_lang": "en", "target_lang": "es"},
    )
    data = response.json()
    assert response.status_code == 200
    assert data["translated_text"] == "Hola"
    assert data["success"] is True


def test_translate_text_unsupported_language(translation_client):
    response = translation_client.post(
        "/translate/text",
        json={"text": "Hello", "source_lang": "xx", "target_lang": "es"},
    )
    assert response.status_code == 400
    assert "not supported" in response.json()["detail"]


def test_translate_food_name_success(translation_client):
    response = translation_client.post(
        "/translate/food",
        json={"text": "Apple", "source_lang": "en", "target_lang": "es"},
    )
    assert response.status_code == 200
    assert response.json()["translated_text"].endswith("-food-es")


def test_batch_translate_text_counts(translation_client):
    response = translation_client.post(
        "/translate/batch",
        json={
            "texts": ["Hello", "Bye"],
            "source_lang": "en",
            "target_lang": "es",
        },
    )
    data = response.json()
    assert response.status_code == 200
    assert data["successful_count"] == 1
    assert data["failed_count"] == 1
    assert data["translations"]["Bye"] is None


def test_batch_translate_food_names(translation_client):
    response = translation_client.post(
        "/translate/batch/foods",
        json={
            "food_names": ["Apple", "Orange"],
            "source_lang": "en",
            "target_lang": "es",
        },
    )
    data = response.json()
    assert response.status_code == 200
    assert data["successful_count"] == 2
    assert data["translations"]["Apple"].endswith("-food-es")


def test_translation_languages_endpoint(translation_client):
    response = translation_client.get("/translate/languages")
    data = response.json()
    assert response.status_code == 200
    assert data["count"] == 2
    assert "en" in data["languages"]


def test_translation_health_endpoint(translation_client):
    response = translation_client.get("/translate/health")
    data = response.json()
    assert response.status_code == 200
    assert data["cache_available"] is True
    assert data["status"] in {"healthy", "degraded"}

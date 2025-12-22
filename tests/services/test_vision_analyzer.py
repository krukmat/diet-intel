from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from app.services.vision_analyzer import VisionAnalyzer
from app.models.food_vision import IdentifiedIngredient


def _make_image_bytes(color=(255, 0, 0)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (12, 12), color).save(buf, format="PNG")
    return buf.getvalue()


def _solid_color_array(color=(0, 200, 0)) -> np.ndarray:
    return np.full((12, 12, 3), color, dtype=np.uint8)


def test_decode_image_returns_array():
    analyzer = VisionAnalyzer()
    img_bytes = _make_image_bytes()
    array = analyzer._decode_image(img_bytes)
    assert array is not None
    assert array.shape[2] == 3


@pytest.mark.asyncio
async def test_analyze_image_handles_decode_failure(monkeypatch):
    analyzer = VisionAnalyzer()

    def _decode_fail(data):
        return None

    monkeypatch.setattr(analyzer, "_decode_image", _decode_fail)
    result = await analyzer.analyze_image(b"bad")

    assert result["identified_ingredients"] == []
    assert result["confidence_score"] == 0.0
    assert result["processing_metadata"]["identified_count"] == 0


def test_fallback_identification_triggers_on_protein():
    analyzer = VisionAnalyzer()
    fallback = analyzer._fallback_identification({"edge_density": 0.15, "brightness": 150})
    assert fallback
    assert fallback[0].name == "Pollo"


def test_estimate_portions_and_overall_confidence():
    analyzer = VisionAnalyzer()
    ingredients = [
        IdentifiedIngredient(name="Pollo", category="Proteína", estimated_grams=100, confidence_score=0.6, visual_markers=[], nutrition_per_100g={"calories": 165, "protein_g": 31, "fat_g": 3.6, "carbs_g": 0}),
        IdentifiedIngredient(name="Brócoli", category="Vegetal", estimated_grams=50, confidence_score=0.8, visual_markers=[], nutrition_per_100g={"calories": 34, "protein_g": 3.7, "fat_g": 0.4, "carbs_g": 7})
    ]
    portions = analyzer._estimate_portions(ingredients, (120, 160, 3))
    assert portions["total_calories"] > 0
    assert analyzer._calculate_overall_confidence(ingredients) > 0


def test_analyze_colors_returns_dominant_color():
    analyzer = VisionAnalyzer()
    image = _solid_color_array()
    colors = analyzer._analyze_colors(image)
    assert "color_coverage" in colors
    assert "dominant_food_color" in colors


@pytest.mark.asyncio
async def test_analyze_image_builds_result(monkeypatch):
    analyzer = VisionAnalyzer()
    monkeypatch.setattr(analyzer, "_decode_image", lambda data: _solid_color_array())
    monkeypatch.setattr(analyzer, "_analyze_colors", lambda image: {"dominant_food_color": "chicken", "max_color_coverage": 0.5, "color_coverage": {}})
    ingredient = IdentifiedIngredient(
        name="Pollo", category="Proteína", estimated_grams=120, confidence_score=0.7,
        visual_markers=["test"], nutrition_per_100g={"calories": 165, "protein_g": 31, "fat_g": 3.6, "carbs_g": 0}
    )
    monkeypatch.setattr(analyzer, "_identify_ingredients", lambda colors, features: [ingredient])
    monkeypatch.setattr(analyzer, "_estimate_portions", lambda ing, shape: {"total_calories": 300})
    monkeypatch.setattr(analyzer, "_calculate_overall_confidence", lambda ing: 0.65)

    result = await analyzer.analyze_image(b"data")

    assert result["identified_ingredients"][0].name == "Pollo"
    assert result["portion_estimate"]["total_calories"] == 300
    assert result["confidence_score"] == 0.65

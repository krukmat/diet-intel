import pytest

from app.services import ocr


@pytest.mark.asyncio
async def test_preprocess_falls_back_without_cv2(monkeypatch, tmp_path):
    monkeypatch.setattr(ocr, "cv2", None)
    processor = ocr.ImageProcessor()
    test_image = tmp_path / "image.jpg"
    test_image.write_bytes(b"NOT_AN_IMAGE")

    result = await processor.preprocess_image(str(test_image))
    assert result == str(test_image)


@pytest.mark.asyncio
async def test_extract_text_no_dependencies(monkeypatch, tmp_path):
    monkeypatch.setattr(ocr, "cv2", None)
    monkeypatch.setattr(ocr, "Image", None)
    monkeypatch.setattr(ocr, "pytesseract", None)

    processor = ocr.ImageProcessor()
    test_image = tmp_path / "image.jpg"
    test_image.write_bytes(b"image")

    text = await processor.extract_text(str(test_image))
    assert text == ""


def test_nutrition_parser_parses_values():
    parser = ocr.NutritionParser()
    text = (
        "Energy 250kcal\n"
        "Protein 20g\n"
        "Fat 10g\n"
        "Carbs 30g\n"
        "Sugar 5g\n"
        "Salt 1g\n"
        "Serving size 100g"
    )
    result = parser.parse_nutrition_text(text)
    assert result["nutrition_data"]["energy_kcal"] == 250
    assert result["nutrition_data"]["protein_g"] == 20
    assert result["serving_size"] == "100g"
    assert 0.0 < result["confidence"] <= 1.0


def test_extract_nutrition_value_range():
    parser = ocr.NutritionParser()
    value = parser._extract_nutrition_value("protein 80g", ["protein"])
    assert value == 80
    assert parser._extract_nutrition_value("bad data", ["fat"]) is None


def test_extract_serving_size_variants():
    parser = ocr.NutritionParser()
    assert parser._extract_serving_size("serving size 2 cups") == "2 cups"
    assert parser._extract_serving_size("per 150g serving") == "150g"
    assert parser._extract_serving_size("nothing") is None


@pytest.mark.asyncio
async def test_call_external_ocr_stub():
    result = await ocr.call_external_ocr("path")
    assert result is None

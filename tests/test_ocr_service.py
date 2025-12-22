import builtins
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


@pytest.mark.asyncio
async def test_easyocr_reader_failure_disables_use_easyocr(monkeypatch):
    class BrokenReader:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("init failed")

    class FakeEasyOCRModule:
        Reader = BrokenReader

    monkeypatch.setattr(ocr, "easyocr", FakeEasyOCRModule)
    processor = ocr.ImageProcessor(use_easyocr=True)

    assert processor.use_easyocr is False


@pytest.mark.asyncio
async def test_extract_text_uses_easyocr_reader(monkeypatch, tmp_path):
    class DummyReader:
        def __init__(self, *args, **kwargs):
            pass

        def readtext(self, path):
            return [((0, 0, 0, 0), "hello"), ((1, 1, 1, 1), "world")]

    class FakeEasyOCRModule:
        Reader = DummyReader

    async def fake_preprocess(path):
        return path

    monkeypatch.setattr(ocr, "easyocr", FakeEasyOCRModule)
    processor = ocr.ImageProcessor(use_easyocr=True)
    processor.preprocess_image = fake_preprocess

    test_image = tmp_path / "dummy.jpg"
    test_image.write_bytes(b"fake-image-bytes")

    result = await processor.extract_text(str(test_image))
    assert result == "hello world"


@pytest.mark.asyncio
async def test_extract_nutrients_handles_missing_module(monkeypatch):
    real_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "app.services.nutrition_ocr":
            raise ImportError("missing")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    processor = ocr.ImageProcessor()

    result = await processor.extract_nutrients("dummy-path")
    assert result["confidence"] == 0.0

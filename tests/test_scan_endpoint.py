"""
Tests for scan-label endpoints using the refactored OCRFactory-based routes.
Updated to patch OCRFactory in the correct modules (scan_routes.py, ocr_routes.py).
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from main import app
from app.services.ocr.ocr_service import OCRResult


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_nutrition_image():
    """Create a mock nutrition label image for testing"""
    img = Image.new('RGB', (400, 300), color='white')
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except (OSError, IOError):
        font = ImageFont.load_default()

    nutrition_text = [
        "Nutrition Facts",
        "Per 100g",
        "Energy: 250 kcal",
        "Protein: 12.5g",
        "Fat: 8.0g",
        "Carbohydrates: 35.2g",
        "Sugars: 5.1g",
        "Salt: 1.2g"
    ]

    y_position = 20
    for line in nutrition_text:
        draw.text((20, y_position), line, fill='black', font=font)
        y_position += 25

    img_bytes = BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)

    return img_bytes


def create_high_confidence_ocr_result():
    """Create an OCRResult with high confidence (>=0.7)"""
    return OCRResult(
        raw_text="Energy: 250 kcal Protein: 12.5g Fat: 8.0g Carbohydrates: 35.2g Sugars: 5.1g Salt: 1.2g",
        confidence=1.0,
        parsed_nutriments={
            'energy_kcal': 250.0,
            'protein_g': 12.5,
            'fat_g': 8.0,
            'carbs_g': 35.2,
            'sugars_g': 5.1,
            'salt_g': 1.2
        },
        serving_info={'detected': '100g'},
        processing_details={'ocr_engine': 'mock'},
        found_nutrients=['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g'],
        missing_required=[]
    )


def create_low_confidence_ocr_result():
    """Create an OCRResult with low confidence (<0.7)"""
    return OCRResult(
        raw_text="Energy: 250 kcal Protein: 12.5g",
        confidence=0.33,
        parsed_nutriments={
            'energy_kcal': 250.0,
            'protein_g': 12.5,
            'fat_g': None,
            'carbs_g': None,
            'sugars_g': None,
            'salt_g': None
        },
        serving_info={'detected': None},
        processing_details={'ocr_engine': 'mock'},
        found_nutrients=['energy_kcal', 'protein_g'],
        missing_required=['fat_g', 'carbs_g', 'sugars_g', 'salt_g']
    )


def create_empty_ocr_result():
    """Create an OCRResult with no text extracted"""
    return OCRResult(
        raw_text='',
        confidence=0.0,
        parsed_nutriments={},
        serving_info={'detected': None},
        processing_details={'ocr_engine': 'mock'},
        found_nutrients=[],
        missing_required=['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g']
    )


@pytest.mark.asyncio
async def test_scan_label_high_confidence(client, mock_nutrition_image):
    """Test successful OCR scan with high confidence (>=0.7)"""
    mock_ocr_service = AsyncMock()
    mock_ocr_service.extract_nutrients = AsyncMock(return_value=create_high_confidence_ocr_result())

    with patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:
        mock_factory.create_local.return_value = mock_ocr_service

        response = client.post(
            "/product/scan-label",
            files={"file": ("nutrition_label.png", mock_nutrition_image, "image/png")}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify high confidence response structure
        assert data["source"] == "Local OCR"
        assert data["confidence"] == 1.0
        assert "raw_text" in data
        assert data["serving_size"] == "100g"
        assert "scanned_at" in data

        # Verify nutriments structure
        nutriments = data["nutriments"]
        assert nutriments["energy_kcal_per_100g"] == 250.0
        assert nutriments["protein_g_per_100g"] == 12.5
        assert nutriments["fat_g_per_100g"] == 8.0
        assert nutriments["carbs_g_per_100g"] == 35.2
        assert nutriments["sugars_g_per_100g"] == 5.1
        assert nutriments["salt_g_per_100g"] == 1.2

        # Should not have low_confidence field
        assert "low_confidence" not in data


@pytest.mark.asyncio
async def test_scan_label_low_confidence(client, mock_nutrition_image):
    """Test OCR scan with low confidence (<0.7)"""
    mock_ocr_service = AsyncMock()
    mock_ocr_service.extract_nutrients = AsyncMock(return_value=create_low_confidence_ocr_result())

    with patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:
        mock_factory.create_local.return_value = mock_ocr_service

        response = client.post(
            "/product/scan-label",
            files={"file": ("nutrition_label.png", mock_nutrition_image, "image/png")}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify low confidence response structure
        assert data["low_confidence"] is True
        assert data["confidence"] == 0.33
        assert "raw_text" in data
        assert data["suggest_external_ocr"] is True
        assert "scanned_at" in data

        # Verify partial parsed data
        partial_parsed = data["partial_parsed"]
        assert partial_parsed["energy_kcal"] == 250.0
        assert partial_parsed["protein_g"] == 12.5
        assert partial_parsed["fat_g"] is None


@pytest.mark.asyncio
async def test_scan_label_invalid_file_type(client):
    """Test upload of non-image file"""
    text_content = BytesIO(b"This is not an image")

    response = client.post(
        "/product/scan-label",
        files={"file": ("document.txt", text_content, "text/plain")}
    )

    assert response.status_code == 400
    data = response.json()
    assert "image" in data["detail"].lower()


@pytest.mark.asyncio
async def test_scan_label_no_text_extracted(client, mock_nutrition_image):
    """Test when OCR cannot extract any text"""
    mock_ocr_service = AsyncMock()
    mock_ocr_service.extract_nutrients = AsyncMock(return_value=create_empty_ocr_result())

    with patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:
        mock_factory.create_local.return_value = mock_ocr_service

        response = client.post(
            "/product/scan-label",
            files={"file": ("nutrition_label.png", mock_nutrition_image, "image/png")}
        )

        assert response.status_code == 400
        data = response.json()
        assert "no text" in data["detail"].lower()


@pytest.mark.asyncio
async def test_scan_label_processing_error(client, mock_nutrition_image):
    """Test error handling during image processing"""
    mock_ocr_service = AsyncMock()
    mock_ocr_service.extract_nutrients = AsyncMock(side_effect=Exception("OCR processing failed"))

    with patch('app.routes.product.scan_routes.OCRFactory') as mock_factory:
        mock_factory.create_local.return_value = mock_ocr_service

        response = client.post(
            "/product/scan-label",
            files={"file": ("nutrition_label.png", mock_nutrition_image, "image/png")}
        )

        assert response.status_code == 500
        data = response.json()
        assert "error processing image" in data["detail"].lower()


@pytest.mark.asyncio
async def test_scan_label_external_ocr_success(client, mock_nutrition_image):
    """Test external OCR endpoint with successful external service"""
    external_ocr_text = "NUTRITION FACTS Energy: 250 kcal Protein: 12.5g Fat: 8.0g Carbohydrates: 35.2g Sugars: 5.1g Salt: 1.2g"

    mock_external_result = OCRResult(
        raw_text=external_ocr_text,
        confidence=1.0,
        parsed_nutriments={
            'energy_kcal': 250.0,
            'protein_g': 12.5,
            'fat_g': 8.0,
            'carbs_g': 35.2,
            'sugars_g': 5.1,
            'salt_g': 1.2
        },
        serving_info={'detected': '100g'},
        processing_details={'ocr_engine': 'google'},
        found_nutrients=['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g'],
        missing_required=[]
    )

    mock_ocr_service = AsyncMock()
    mock_ocr_service.extract_nutrients = AsyncMock(return_value=mock_external_result)

    with patch('app.routes.product.ocr_routes.OCRFactory') as mock_factory:
        mock_factory.create_external.return_value = mock_ocr_service

        response = client.post(
            "/product/scan-label-external",
            files={"file": ("nutrition_label.png", mock_nutrition_image, "image/png")}
        )

        assert response.status_code == 200
        data = response.json()

        assert "External OCR" in data["source"]
        assert data["confidence"] == 1.0
        assert data["raw_text"] == external_ocr_text


@pytest.mark.asyncio
async def test_scan_label_external_ocr_low_confidence(client, mock_nutrition_image):
    """Test external OCR with low confidence result"""
    mock_external_result = OCRResult(
        raw_text="Energy: 250 kcal",
        confidence=0.3,
        parsed_nutriments={'energy_kcal': 250.0},
        serving_info={'detected': None},
        processing_details={'ocr_engine': 'google'},
        found_nutrients=['energy_kcal'],
        missing_required=['protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g']
    )

    mock_ocr_service = AsyncMock()
    mock_ocr_service.extract_nutrients = AsyncMock(return_value=mock_external_result)

    with patch('app.routes.product.ocr_routes.OCRFactory') as mock_factory:
        mock_factory.create_external.return_value = mock_ocr_service

        response = client.post(
            "/product/scan-label-external",
            files={"file": ("nutrition_label.png", mock_nutrition_image, "image/png")}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["low_confidence"] is True
        assert data["confidence"] == 0.3
        assert data["suggest_external_ocr"] is False  # Already used external


@pytest.mark.asyncio
async def test_scan_label_external_service_unavailable(client, mock_nutrition_image):
    """Test external OCR when service returns None"""
    mock_ocr_service = AsyncMock()
    mock_ocr_service.extract_nutrients = AsyncMock(return_value=None)

    with patch('app.routes.product.ocr_routes.OCRFactory') as mock_factory:
        mock_factory.create_external.return_value = mock_ocr_service

        response = client.post(
            "/product/scan-label-external",
            files={"file": ("nutrition_label.png", mock_nutrition_image, "image/png")}
        )

        assert response.status_code == 503
        data = response.json()
        assert "unavailable" in data["detail"].lower()


def test_nutrition_parser_unit():
    """Test the nutrition parser directly with various text formats"""
    # Import from legacy ocr.py file (shadowed by ocr/ directory)
    import importlib.util
    import os

    spec = importlib.util.spec_from_file_location(
        "ocr_legacy",
        os.path.join(os.path.dirname(__file__), "..", "app", "services", "ocr.py")
    )
    ocr_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ocr_module)
    NutritionParser = ocr_module.NutritionParser

    parser = NutritionParser()

    # Test well-formatted nutrition text
    text1 = "Energy: 250 kcal Protein: 12.5g Fat: 8.0g Carbohydrates: 35.2g Sugars: 5.1g Salt: 1.2g Per 100g"
    result1 = parser.parse_nutrition_text(text1)

    assert result1['confidence'] == 1.0  # All 6 fields found
    assert result1['nutrition_data']['energy_kcal'] == 250.0
    assert result1['nutrition_data']['protein_g'] == 12.5
    assert result1['serving_size'] == "100g"

    # Test poorly formatted text with missing fields
    text2 = "Energy 250 calories something protein 10"
    result2 = parser.parse_nutrition_text(text2)

    assert result2['confidence'] < 0.7  # Should be low confidence
    assert result2['nutrition_data']['energy_kcal'] == 250.0  # Should still find energy

    # Test empty text
    result3 = parser.parse_nutrition_text("")
    assert result3['confidence'] == 0.0

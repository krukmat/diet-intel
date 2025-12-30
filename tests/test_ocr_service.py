"""
OCR Service Coverage Tests - Phase 3
Task 3.1: Complete OCR.py async implementation (49% → 85%)

Properly handles async methods with correct AsyncMock usage
"""

import pytest
import tempfile
import os
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock, call
from PIL import Image

# Load legacy ocr.py module directly (since it's shadowed by ocr/ package)
import importlib.util
import sys
spec = importlib.util.spec_from_file_location(
    "ocr_legacy",
    "/Users/matiasleandrokruk/Documents/DietIntel/app/services/ocr.py"
)
ocr_legacy = importlib.util.module_from_spec(spec)
sys.modules['ocr_legacy'] = ocr_legacy  # Add to sys.modules so patch() can find it
spec.loader.exec_module(ocr_legacy)

ImageProcessor = ocr_legacy.ImageProcessor
NutritionParser = ocr_legacy.NutritionParser
call_external_ocr = ocr_legacy.call_external_ocr


# ==================== Fixtures ====================

@pytest.fixture
def temp_image():
    """Create temporary test image"""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        img = Image.new('RGB', (400, 300), color='white')
        img.save(f.name)
        yield f.name
        try:
            os.remove(f.name)
        except:
            pass


@pytest.fixture
def nutrition_text():
    """Sample nutrition text"""
    return """
    Nutrition Facts
    Energy: 250 kcal
    Protein: 10g
    Fat: 8g
    Carbohydrates: 35g
    """


# ==================== ImageProcessor Tests ====================

def test_imageprocessor_init_default():
    """Test ImageProcessor default initialization"""
    processor = ImageProcessor(use_easyocr=False)
    assert processor is not None
    assert processor.use_easyocr is False
    assert processor.easyocr_reader is None


def test_imageprocessor_init_attributes():
    """Test ImageProcessor has required attributes"""
    processor = ImageProcessor()
    assert hasattr(processor, 'use_easyocr')
    assert hasattr(processor, 'easyocr_reader')


@pytest.mark.asyncio
async def test_preprocess_image_returns_path(temp_image):
    """Test preprocess_image returns a string path"""
    processor = ImageProcessor(use_easyocr=False)

    with patch('ocr_legacy.cv2') as mock_cv2:
        # Setup mock returns
        mock_image = MagicMock()
        mock_grayscale = MagicMock()
        mock_resized = MagicMock()
        mock_denoised = MagicMock()
        mock_threshold = MagicMock()

        mock_cv2.imread.return_value = mock_image
        mock_cv2.cvtColor.return_value = mock_grayscale
        mock_grayscale.shape = (300, 400)  # height, width
        mock_cv2.resize.return_value = mock_resized
        mock_cv2.fastNlMeansDenoising.return_value = mock_denoised
        mock_cv2.adaptiveThreshold.return_value = mock_threshold
        mock_cv2.imwrite.return_value = True
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_cv2.INTER_AREA = 1
        mock_cv2.ADAPTIVE_THRESH_GAUSSIAN_C = 1
        mock_cv2.THRESH_BINARY = 0

        result = await processor.preprocess_image(temp_image)

        assert isinstance(result, str)
        assert mock_cv2.imread.called
        assert mock_cv2.cvtColor.called


@pytest.mark.asyncio
async def test_preprocess_image_cv2_missing(temp_image):
    """Test preprocess_image when cv2 is unavailable"""
    processor = ImageProcessor(use_easyocr=False)

    with patch('ocr_legacy.cv2', None):
        result = await processor.preprocess_image(temp_image)
        assert result == temp_image  # Returns original


@pytest.mark.asyncio
async def test_preprocess_image_read_error(temp_image):
    """Test preprocess_image handles read errors"""
    processor = ImageProcessor(use_easyocr=False)

    with patch('ocr_legacy.cv2') as mock_cv2:
        mock_cv2.imread.return_value = None  # Simulate read failure
        mock_cv2.COLOR_BGR2GRAY = 6

        result = await processor.preprocess_image(temp_image)
        assert result == temp_image


@pytest.mark.asyncio
async def test_preprocess_image_large_image(temp_image):
    """Test preprocess_image resizes large images"""
    processor = ImageProcessor(use_easyocr=False)

    with patch('ocr_legacy.cv2') as mock_cv2:
        mock_image = MagicMock()
        mock_grayscale = MagicMock()
        mock_resized = MagicMock()

        mock_cv2.imread.return_value = mock_image
        mock_cv2.cvtColor.return_value = mock_grayscale
        mock_grayscale.shape = (2000, 3000)  # Large image
        mock_cv2.resize.return_value = mock_resized
        mock_cv2.fastNlMeansDenoising.return_value = MagicMock()
        mock_cv2.adaptiveThreshold.return_value = MagicMock()
        mock_cv2.imwrite.return_value = True
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_cv2.INTER_AREA = 1
        mock_cv2.ADAPTIVE_THRESH_GAUSSIAN_C = 1
        mock_cv2.THRESH_BINARY = 0

        result = await processor.preprocess_image(temp_image)

        # Should have called resize for large image
        assert mock_cv2.resize.called


@pytest.mark.asyncio
async def test_extract_text_with_tesseract(temp_image):
    """Test extract_text uses Tesseract"""
    processor = ImageProcessor(use_easyocr=False)

    with patch('ocr_legacy.cv2') as mock_cv2, \
         patch('ocr_legacy.Image') as mock_image_lib, \
         patch('ocr_legacy.pytesseract') as mock_pytesseract:

        # Setup mocks
        mock_cv2.imread.return_value = MagicMock()
        mock_cv2.cvtColor.return_value = MagicMock()
        mock_cv2.fastNlMeansDenoising.return_value = MagicMock()
        mock_cv2.adaptiveThreshold.return_value = MagicMock()
        mock_cv2.imwrite.return_value = True
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_cv2.INTER_AREA = 1
        mock_cv2.ADAPTIVE_THRESH_GAUSSIAN_C = 1
        mock_cv2.THRESH_BINARY = 0

        mock_image_lib.open.return_value = MagicMock()
        mock_pytesseract.image_to_string.return_value = "Extracted text"

        result = await processor.extract_text(temp_image)

        assert isinstance(result, str)
        assert mock_pytesseract.image_to_string.called


@pytest.mark.asyncio
async def test_extract_text_missing_dependencies(temp_image):
    """Test extract_text handles missing dependencies"""
    processor = ImageProcessor(use_easyocr=False)

    with patch('ocr_legacy.cv2') as mock_cv2, \
         patch('ocr_legacy.Image', None), \
         patch('ocr_legacy.pytesseract'):

        mock_cv2.imread.return_value = MagicMock()
        mock_cv2.cvtColor.return_value = MagicMock()
        mock_cv2.fastNlMeansDenoising.return_value = MagicMock()
        mock_cv2.adaptiveThreshold.return_value = MagicMock()
        mock_cv2.imwrite.return_value = True
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_cv2.INTER_AREA = 1
        mock_cv2.ADAPTIVE_THRESH_GAUSSIAN_C = 1
        mock_cv2.THRESH_BINARY = 0

        result = await processor.extract_text(temp_image)
        assert result == ""  # Returns empty on missing PIL


@pytest.mark.asyncio
async def test_extract_text_returns_stripped(temp_image):
    """Test extract_text strips whitespace"""
    processor = ImageProcessor(use_easyocr=False)

    with patch('ocr_legacy.cv2') as mock_cv2, \
         patch('ocr_legacy.Image') as mock_image_lib, \
         patch('ocr_legacy.pytesseract') as mock_pytesseract:

        mock_cv2.imread.return_value = MagicMock()
        mock_cv2.cvtColor.return_value = MagicMock()
        mock_cv2.fastNlMeansDenoising.return_value = MagicMock()
        mock_cv2.adaptiveThreshold.return_value = MagicMock()
        mock_cv2.imwrite.return_value = True
        mock_cv2.COLOR_BGR2GRAY = 6
        mock_cv2.INTER_AREA = 1
        mock_cv2.ADAPTIVE_THRESH_GAUSSIAN_C = 1
        mock_cv2.THRESH_BINARY = 0

        mock_image_lib.open.return_value = MagicMock()
        mock_pytesseract.image_to_string.return_value = "  Text  \n"

        result = await processor.extract_text(temp_image)
        assert result == "Text"


@pytest.mark.asyncio
async def test_extract_nutrients(temp_image):
    """Test extract_nutrients delegates properly"""
    processor = ImageProcessor(use_easyocr=False)

    # This should return a dict with nutrition data
    result = await processor.extract_nutrients(temp_image)

    assert isinstance(result, dict)
    assert 'confidence' in result or 'processing_details' in result


# ==================== NutritionParser Tests ====================

def test_nutrition_parser_init():
    """Test NutritionParser initialization"""
    parser = NutritionParser()
    assert parser is not None
    assert parser.required_fields == 6
    assert isinstance(parser.NUTRITION_FIELDS, dict)


def test_nutrition_parser_fields_defined():
    """Test all nutrition fields are defined"""
    parser = NutritionParser()

    required = ['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g']
    for field in required:
        assert field in parser.NUTRITION_FIELDS


def test_parse_nutrition_text_complete(nutrition_text):
    """Test parsing complete nutrition text"""
    parser = NutritionParser()
    result = parser.parse_nutrition_text(nutrition_text)

    assert 'nutrition_data' in result
    assert 'serving_size' in result
    assert 'confidence' in result
    assert result['confidence'] > 0


def test_parse_nutrition_text_empty():
    """Test parsing empty text"""
    parser = NutritionParser()
    result = parser.parse_nutrition_text("")

    assert result['confidence'] == 0
    assert len(result['nutrition_data']) == 0


def test_parse_nutrition_text_partial():
    """Test parsing partial nutrition text"""
    parser = NutritionParser()
    text = "Energy: 100 kcal, Protein: 5g"
    result = parser.parse_nutrition_text(text)

    assert result['confidence'] < 1.0
    assert 'energy_kcal' in result['nutrition_data']
    assert 'protein_g' in result['nutrition_data']


def test_extract_nutrition_value_patterns():
    """Test nutrition value extraction patterns"""
    parser = NutritionParser()

    # Pattern 1: "keyword value g"
    val1 = parser._extract_nutrition_value("protein 10g", ['protein'])
    assert val1 == 10.0

    # Pattern 2: "keyword: value g"
    val2 = parser._extract_nutrition_value("fat: 8.5g", ['fat'])
    assert val2 == 8.5

    # Pattern 3: "value g keyword"
    val3 = parser._extract_nutrition_value("15g carbs", ['carbs', 'carbohydrate'])
    assert val3 == 15.0


def test_extract_nutrition_value_sanity_checks():
    """Test nutrition values are within reasonable ranges"""
    parser = NutritionParser()

    # Should reject unrealistic values
    high_val = parser._extract_nutrition_value("protein 5000g", ['protein'])
    assert high_val is None

    negative_val = parser._extract_nutrition_value("protein -10g", ['protein'])
    assert negative_val is None


def test_extract_serving_size_patterns():
    """Test serving size extraction patterns"""
    parser = NutritionParser()

    # Pattern 1: "serving size: value"
    s1 = parser._extract_serving_size("serving size: 100g")
    assert s1 == "100g"

    # Pattern 2: "per value"
    s2 = parser._extract_serving_size("per 200ml")
    assert s2 == "200ml"

    # Pattern 3: "value g serving"
    s3 = parser._extract_serving_size("150g serving")
    assert s3 == "150g"


def test_extract_serving_size_not_found():
    """Test serving size not found returns None"""
    parser = NutritionParser()

    result = parser._extract_serving_size("no serving info here")
    assert result is None


# ==================== External OCR Tests ====================

@pytest.mark.asyncio
async def test_call_external_ocr_returns_none():
    """Test call_external_ocr returns None (stub)"""
    result = await call_external_ocr("/path/to/image.png")
    assert result is None


@pytest.mark.asyncio
async def test_call_external_ocr_logs():
    """Test call_external_ocr logs appropriately"""
    # Should not raise error
    try:
        result = await call_external_ocr("/test.png")
        assert result is None
    except:
        assert False, "Should not raise error"


# ==================== Module-Level Instances ====================

def test_ocr_service_instance():
    """Test module-level ocr_service instance exists"""
    assert ocr_legacy.ocr_service is not None
    assert isinstance(ocr_legacy.ocr_service, ImageProcessor)


def test_nutrition_parser_instance():
    """Test module-level nutrition_parser instance exists"""
    assert ocr_legacy.nutrition_parser is not None
    assert isinstance(ocr_legacy.nutrition_parser, NutritionParser)

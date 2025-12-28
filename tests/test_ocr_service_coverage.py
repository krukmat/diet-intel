"""
Test coverage for app/services/ocr module - OCRService, LocalOCRService, ExternalOCRService, OCRFactory
Tests the factory pattern, service initialization, and OCR processing pipeline
"""
import pytest
import os
import tempfile
from unittest.mock import patch, MagicMock, AsyncMock
from PIL import Image

from app.services.ocr.ocr_service import OCRService, OCRResult
from app.services.ocr.local_ocr_service import LocalOCRService
from app.services.ocr.external_ocr_service import ExternalOCRService
from app.services.ocr.ocr_factory import OCRFactory


@pytest.fixture
def temp_image():
    """Create a temporary test image"""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        img = Image.new('RGB', (100, 100), color='white')
        img.save(f.name)
        yield f.name
        try:
            os.remove(f.name)
        except OSError:
            pass


@pytest.fixture
def sample_nutrition_result():
    """Sample nutrition OCR result dictionary"""
    return {
        'raw_text': 'Nutrition Facts\nCalories: 250\nProtein: 10g',
        'parsed_nutriments': {
            'energy_100g': 250,
            'proteins_100g': 10.0,
            'fat_100g': 5.0,
            'carbohydrates_100g': 35.0
        },
        'confidence': 0.85,
        'serving_info': {
            'serving_size': '100g',
            'servings_per_container': 4
        },
        'processing_details': {
            'preprocessing_applied': True,
            'bounding_boxes_detected': 5
        },
        'found_nutrients': ['energy_100g', 'proteins_100g', 'fat_100g', 'carbohydrates_100g'],
        'missing_required': []
    }


# ===== OCRResult Tests =====


def test_ocr_result_creation():
    """Test OCRResult dataclass creation with all required fields"""
    result = OCRResult(
        raw_text="Nutrition Facts\nCalories: 250",
        parsed_nutriments={'energy_100g': 250},
        confidence=0.95,
        serving_info={'serving_size': '100g'},
        processing_details={'engine': 'tesseract'},
        found_nutrients=['energy_100g'],
        missing_required=[]
    )

    assert result.raw_text == "Nutrition Facts\nCalories: 250"
    assert result.confidence == 0.95
    assert result.parsed_nutriments['energy_100g'] == 250
    assert result.serving_info['serving_size'] == '100g'


def test_ocr_result_with_all_metadata(sample_nutrition_result):
    """Test OCRResult with complete nutrition data"""
    result = OCRResult(
        raw_text=sample_nutrition_result['raw_text'],
        parsed_nutriments=sample_nutrition_result['parsed_nutriments'],
        confidence=sample_nutrition_result['confidence'],
        serving_info=sample_nutrition_result['serving_info'],
        processing_details=sample_nutrition_result['processing_details'],
        found_nutrients=sample_nutrition_result['found_nutrients'],
        missing_required=sample_nutrition_result['missing_required']
    )

    assert result.raw_text == sample_nutrition_result['raw_text']
    assert len(result.found_nutrients) == 4
    assert len(result.missing_required) == 0


def test_ocr_result_is_high_confidence():
    """Test OCRResult confidence threshold checking"""
    high_conf_result = OCRResult(
        raw_text="Text",
        parsed_nutriments={},
        confidence=0.75,
        serving_info={},
        processing_details={},
        found_nutrients=[],
        missing_required=[]
    )
    assert high_conf_result.is_high_confidence(0.7) is True
    assert high_conf_result.is_high_confidence(0.8) is False

    low_conf_result = OCRResult(
        raw_text="Text",
        parsed_nutriments={},
        confidence=0.65,
        serving_info={},
        processing_details={},
        found_nutrients=[],
        missing_required=[]
    )
    assert low_conf_result.is_high_confidence() is False  # Default 0.7 threshold


# ===== OCRFactory Tests =====


def test_ocr_factory_create_local_service():
    """Test OCRFactory.create_local() creates LocalOCRService"""
    service = OCRFactory.create_local()

    assert service is not None
    assert isinstance(service, LocalOCRService)
    assert isinstance(service, OCRService)


def test_ocr_factory_create_local_service_with_debug():
    """Test OCRFactory.create_local() with debug flag"""
    service = OCRFactory.create_local(debug=True)

    assert service is not None
    assert isinstance(service, LocalOCRService)
    assert service.debug is True


def test_ocr_factory_create_external_service():
    """Test OCRFactory.create_external() creates ExternalOCRService"""
    service = OCRFactory.create_external(provider="google")

    assert service is not None
    assert isinstance(service, ExternalOCRService)
    assert isinstance(service, OCRService)
    assert service.provider == "google"


def test_ocr_factory_create_external_service_with_api_key():
    """Test OCRFactory.create_external() with API key"""
    service = OCRFactory.create_external(provider="aws", api_key="test_key_123")

    assert service is not None
    assert isinstance(service, ExternalOCRService)
    assert service.provider == "aws"
    assert service.api_key == "test_key_123"


def test_ocr_factory_create_default_service():
    """Test OCRFactory.create_default() creates appropriate default service"""
    service = OCRFactory.create_default()

    assert service is not None
    assert isinstance(service, OCRService)


# ===== LocalOCRService Tests =====


def test_local_ocr_service_initialization():
    """Test LocalOCRService initialization without debug"""
    service = LocalOCRService()

    assert service is not None
    assert isinstance(service, OCRService)
    assert service.debug is False


def test_local_ocr_service_initialization_with_debug():
    """Test LocalOCRService initialization with debug enabled"""
    service = LocalOCRService(debug=True)

    assert service is not None
    assert service.debug is True


def test_local_ocr_service_get_engine_name():
    """Test LocalOCRService returns correct engine identifier"""
    service = LocalOCRService()
    engine_name = service.get_engine_name()

    assert engine_name == "tesseract_local"


@pytest.mark.asyncio
async def test_local_ocr_service_extract_nutrients_with_mock(temp_image):
    """Test LocalOCRService.extract_nutrients() with mocked nutrition_ocr module"""
    service = LocalOCRService()

    # Mock the nutrition_ocr.extract_nutrients_from_image call
    with patch('app.services.nutrition_ocr.extract_nutrients_from_image', new_callable=AsyncMock) as mock_extract:
        mock_result = {
            'raw_text': 'Nutrition Facts',
            'parsed_nutriments': {'energy_100g': 200},
            'confidence': 0.8,
            'serving_info': {},
            'processing_details': {},
            'found_nutrients': ['energy_100g'],
            'missing_required': []
        }
        mock_extract.return_value = mock_result

        result = await service.extract_nutrients(temp_image)

        assert result is not None
        assert isinstance(result, OCRResult)
        assert result.raw_text == 'Nutrition Facts'
        assert result.confidence == 0.8
        assert result.processing_details['ocr_engine'] == 'tesseract_local'
        mock_extract.assert_called_once_with(temp_image, debug=False)


@pytest.mark.asyncio
async def test_local_ocr_service_extract_nutrients_no_result(temp_image):
    """Test LocalOCRService when nutrition extraction returns None"""
    service = LocalOCRService()

    with patch('app.services.nutrition_ocr.extract_nutrients_from_image', new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = None

        result = await service.extract_nutrients(temp_image)

        assert result is None


@pytest.mark.asyncio
async def test_local_ocr_service_extract_nutrients_exception_handling(temp_image):
    """Test LocalOCRService error handling on extraction failure"""
    service = LocalOCRService()

    with patch('app.services.nutrition_ocr.extract_nutrients_from_image', new_callable=AsyncMock) as mock_extract:
        mock_extract.side_effect = Exception("OCR processing failed")

        result = await service.extract_nutrients(temp_image)

        assert result is None


# ===== ExternalOCRService Tests =====


def test_external_ocr_service_initialization():
    """Test ExternalOCRService initialization"""
    service = ExternalOCRService()

    assert service is not None
    assert isinstance(service, OCRService)
    assert service.provider == "google"  # Default provider


def test_external_ocr_service_initialization_with_config():
    """Test ExternalOCRService initialization with custom provider and API key"""
    service = ExternalOCRService(api_key="test_api_key", provider="aws")

    assert service is not None
    assert service.api_key == "test_api_key"
    assert service.provider == "aws"


def test_external_ocr_service_get_engine_name():
    """Test ExternalOCRService returns correct engine identifier"""
    service = ExternalOCRService(provider="azure")
    engine_name = service.get_engine_name()

    assert engine_name == "external_azure"


@pytest.mark.asyncio
async def test_external_ocr_service_extract_nutrients_with_mock(temp_image):
    """Test ExternalOCRService.extract_nutrients() with mocked external API"""
    service = ExternalOCRService(api_key="test_key", provider="google")

    # Patch the call_external_ocr import in the ocr service module
    with patch('app.services.ocr.external_ocr_service.call_external_ocr', new_callable=AsyncMock) as mock_external:
        mock_result = {
            'raw_text': 'Nutrition Information',
            'parsed_nutriments': {'energy_100g': 300, 'proteins_100g': 15},
            'confidence': 0.9,
            'serving_info': {'serving_size': '100g'},
            'processing_details': {},
            'found_nutrients': ['energy_100g', 'proteins_100g'],
            'missing_required': []
        }
        mock_external.return_value = mock_result

        result = await service.extract_nutrients(temp_image)

        assert result is not None
        assert isinstance(result, OCRResult)
        assert result.confidence == 0.9
        assert result.processing_details['ocr_engine'] == 'external_google'


@pytest.mark.asyncio
async def test_external_ocr_service_extract_nutrients_no_result(temp_image):
    """Test ExternalOCRService when external API returns no data"""
    service = ExternalOCRService(provider="aws")

    with patch('app.services.nutrition_ocr.call_external_ocr', new_callable=AsyncMock) as mock_external:
        mock_external.return_value = None

        result = await service.extract_nutrients(temp_image)

        assert result is None


@pytest.mark.asyncio
async def test_external_ocr_service_extract_nutrients_exception_handling(temp_image):
    """Test ExternalOCRService error handling on API failure"""
    service = ExternalOCRService(provider="azure")

    with patch('app.services.nutrition_ocr.call_external_ocr', new_callable=AsyncMock) as mock_external:
        mock_external.side_effect = Exception("External API error")

        result = await service.extract_nutrients(temp_image)

        assert result is None


# ===== Integration Tests =====


@pytest.mark.asyncio
async def test_ocr_service_factory_pattern_local(temp_image):
    """Test factory pattern creates working local service"""
    service = OCRFactory.create_local(debug=False)

    with patch('app.services.nutrition_ocr.extract_nutrients_from_image', new_callable=AsyncMock) as mock_extract:
        mock_extract.return_value = {
            'raw_text': 'Test',
            'parsed_nutriments': {},
            'confidence': 0.7,
            'serving_info': {},
            'processing_details': {},
            'found_nutrients': [],
            'missing_required': []
        }

        result = await service.extract_nutrients(temp_image)

        assert result is not None
        assert isinstance(result, OCRResult)


def test_ocr_service_implementations():
    """Test that both OCR service implementations are available"""
    local_service = OCRFactory.create_local()
    external_service = OCRFactory.create_external()

    assert isinstance(local_service, LocalOCRService)
    assert isinstance(external_service, ExternalOCRService)
    assert local_service.get_engine_name() == "tesseract_local"
    assert external_service.get_engine_name() == "external_google"


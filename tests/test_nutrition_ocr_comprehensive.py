import pytest
import os
import tempfile
import cv2
import numpy as np
from unittest.mock import patch, MagicMock, mock_open
from PIL import Image, ImageDraw, ImageFont
from app.services.nutrition_ocr import (
    ImagePreprocessor, 
    NutritionTextParser, 
    LocalOCREngine, 
    extract_nutrients_from_image,
    call_external_ocr
)


@pytest.fixture
def sample_nutrition_text():
    """Sample nutrition facts text for testing parsing"""
    return """
    Nutrition Facts
    Per 100g
    Energy: 250 kcal
    Protein: 12.5g
    Fat: 8.2g
    Carbohydrates: 35.0g
    - of which sugars: 5.8g
    Salt: 1.2g
    Fiber: 3.5g
    """


@pytest.fixture
def test_image_path():
    """Create a temporary test image"""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        # Create a simple test image
        img = np.ones((200, 300, 3), dtype=np.uint8) * 255
        cv2.putText(img, 'Energy: 250 kcal', (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
        cv2.putText(img, 'Protein: 12.5g', (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
        cv2.imwrite(tmp.name, img)
        yield tmp.name
    os.unlink(tmp.name)


@pytest.fixture
def corrupted_image_path():
    """Create a corrupted image file for error testing"""
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp.write(b"corrupted image data")
        yield tmp.name
    os.unlink(tmp.name)


class TestImagePreprocessor:
    """Test the ImagePreprocessor class"""
    
    def test_preprocess_image_success(self, test_image_path):
        """Test successful image preprocessing"""
        result_path = ImagePreprocessor.preprocess_image(test_image_path)
        
        assert result_path is not None
        assert os.path.exists(result_path)
        assert result_path.endswith('_processed.png')
        
        # Clean up
        if os.path.exists(result_path):
            os.unlink(result_path)
    
    def test_preprocess_image_with_debug(self, test_image_path):
        """Test preprocessing with debug mode enabled"""
        result_path = ImagePreprocessor.preprocess_image(test_image_path, save_debug=True)
        
        assert result_path is not None
        assert os.path.exists(result_path)
        
        # Check debug directory was created
        base_name = os.path.splitext(test_image_path)[0]
        debug_dir = f"{base_name}_debug"
        assert os.path.exists(debug_dir)
        
        # Check debug images exist
        debug_files = [
            '01_gray.png', '02_enhanced.png', '03_denoised.png',
            '04_sharpened.png', '05_thresh.png', '06_final.png'
        ]
        for debug_file in debug_files:
            assert os.path.exists(os.path.join(debug_dir, debug_file))
        
        # Clean up
        import shutil
        if os.path.exists(result_path):
            os.unlink(result_path)
        if os.path.exists(debug_dir):
            shutil.rmtree(debug_dir)
    
    def test_preprocess_invalid_image(self, corrupted_image_path):
        """Test preprocessing with invalid image file"""
        result_path = ImagePreprocessor.preprocess_image(corrupted_image_path)
        
        # Should return original path as fallback
        assert result_path == corrupted_image_path
    
    def test_preprocess_nonexistent_image(self):
        """Test preprocessing with nonexistent image file"""
        nonexistent_path = "/nonexistent/image.png"
        result_path = ImagePreprocessor.preprocess_image(nonexistent_path)
        
        # Should return original path as fallback
        assert result_path == nonexistent_path
    
    def test_preprocess_small_image_upscaling(self):
        """Test that small images are upscaled correctly"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Create small image (less than 1000px width)
            small_img = np.ones((100, 200, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, small_img)
            
            result_path = ImagePreprocessor.preprocess_image(tmp.name)
            
            # Check that processed image is larger
            if os.path.exists(result_path):
                processed_img = cv2.imread(result_path)
                assert processed_img.shape[1] >= 1000  # Width should be at least 1000px
                os.unlink(result_path)
            
            os.unlink(tmp.name)


class TestNutritionTextParser:
    """Test the NutritionTextParser class"""
    
    def test_parser_initialization(self):
        """Test parser creates successfully"""
        parser = NutritionTextParser()
        assert parser is not None
        assert hasattr(parser, 'NUTRIENT_KEYWORDS')
    
    def test_parse_nutrition_text_success(self, sample_nutrition_text):
        """Test successful parsing of nutrition text"""
        parser = NutritionTextParser()
        result = parser.parse_nutrition_text(sample_nutrition_text)
        
        assert 'nutrients' in result
        assert 'confidence' in result
        assert 'raw_text' in result
        assert 'serving_info' in result
        
        nutrients = result['nutrients']
        assert 'energy_kcal_per_100g' in nutrients
        assert nutrients['energy_kcal_per_100g'] == 250.0
        assert nutrients['protein_g_per_100g'] == 12.5
        assert nutrients['fat_g_per_100g'] == 8.2
        assert nutrients['carbs_g_per_100g'] == 35.0
        assert nutrients['sugars_g_per_100g'] == 5.8
        assert nutrients['salt_g_per_100g'] == 1.2
    
    def test_parse_empty_text(self):
        """Test parsing empty text"""
        parser = NutritionTextParser()
        result = parser.parse_nutrition_text("")
        
        assert result['confidence'] == 0.0
        assert len(result['nutrients']) == 0
    
    def test_parse_multilingual_text(self):
        """Test parsing Spanish nutrition text"""
        spanish_text = """
        Información Nutricional
        Por 100g
        Energía: 300 kcal
        Proteínas: 15.0g
        Grasas: 10.5g
        Carbohidratos: 40.0g
        - de los cuales azúcares: 8.2g
        Sal: 0.8g
        """
        
        parser = NutritionTextParser()
        result = parser.parse_nutrition_text(spanish_text)
        
        nutrients = result['nutrients']
        assert nutrients['energy_kcal_per_100g'] == 300.0
        assert nutrients['protein_g_per_100g'] == 15.0
        assert nutrients['fat_g_per_100g'] == 10.5
        assert nutrients['carbs_g_per_100g'] == 40.0
        assert nutrients['sugars_g_per_100g'] == 8.2
        assert nutrients['salt_g_per_100g'] == 0.8
    
    def test_normalize_text(self):
        """Test text normalization"""
        parser = NutritionTextParser()
        
        messy_text = "  ENERGY:  250,5  KCAL  "
        normalized = parser._normalize_text(messy_text)
        assert normalized == "energy: 250.5 kcal"
    
    def test_extract_nutrient_value(self):
        """Test nutrient value extraction"""
        parser = NutritionTextParser()
        text = "energy: 250 kcal protein: 12.5g"
        patterns = [r'energ[yi].*?(\d+[.,]\d+|\d+)\s*k?cal']
        
        value, confidence, match_text = parser._extract_nutrient_value(
            text, patterns, 'energy_kcal'
        )
        
        assert value == 250.0
        assert confidence > 0.0
        assert 'energy' in match_text.lower()
    
    def test_is_reasonable_value(self):
        """Test reasonable value validation"""
        parser = NutritionTextParser()
        
        # Valid values
        assert parser._is_reasonable_value(250.0, 'energy_kcal')
        assert parser._is_reasonable_value(12.5, 'protein_g')
        assert parser._is_reasonable_value(8.2, 'fat_g')
        
        # Invalid values
        assert not parser._is_reasonable_value(-10.0, 'energy_kcal')
        assert not parser._is_reasonable_value(10000.0, 'energy_kcal')
        assert not parser._is_reasonable_value(150.0, 'protein_g')
    
    def test_calculate_confidence(self):
        """Test confidence calculation"""
        parser = NutritionTextParser()
        
        # High confidence - many nutrients found
        high_nutrients = {
            'energy_kcal_per_100g': 250.0,
            'protein_g_per_100g': 12.5,
            'fat_g_per_100g': 8.2,
            'carbs_g_per_100g': 35.0,
            'salt_g_per_100g': 1.2
        }
        high_conf = parser._calculate_confidence(high_nutrients, [], "test")
        assert high_conf > 0.7
        
        # Low confidence - few nutrients found
        low_nutrients = {'energy_kcal_per_100g': 250.0}
        low_conf = parser._calculate_confidence(low_nutrients, [], "test")
        assert low_conf < 0.5


class TestLocalOCREngine:
    """Test the LocalOCREngine class"""
    
    @patch('pytesseract.image_to_string')
    def test_extract_with_tesseract_success(self, mock_tesseract, test_image_path):
        """Test successful Tesseract OCR extraction"""
        mock_tesseract.return_value = "Energy: 250 kcal\nProtein: 12.5g"
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine._extract_with_tesseract(test_image_path)
        
        assert text == "Energy: 250 kcal\nProtein: 12.5g"
        assert confidence > 0.0
        mock_tesseract.assert_called_once()
    
    @patch('pytesseract.image_to_string')
    def test_extract_with_tesseract_exception(self, mock_tesseract, test_image_path):
        """Test Tesseract OCR with exception"""
        mock_tesseract.side_effect = Exception("Tesseract error")
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine._extract_with_tesseract(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('easyocr.Reader')
    def test_extract_with_easyocr_success(self, mock_reader_class, test_image_path):
        """Test successful EasyOCR extraction"""
        mock_reader = MagicMock()
        mock_reader.readtext.return_value = [
            ([0, 0, 100, 30], 'Energy: 250 kcal', 0.9),
            ([0, 30, 100, 60], 'Protein: 12.5g', 0.85)
        ]
        mock_reader_class.return_value = mock_reader
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine._extract_with_easyocr(test_image_path)
        
        assert 'Energy: 250 kcal' in text
        assert 'Protein: 12.5g' in text
        assert confidence > 0.8
    
    @patch('easyocr.Reader')
    def test_extract_with_easyocr_exception(self, mock_reader_class, test_image_path):
        """Test EasyOCR with exception"""
        mock_reader_class.side_effect = Exception("EasyOCR error")
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine._extract_with_easyocr(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('easyocr.Reader')
    @patch('pytesseract.image_to_string')
    def test_extract_text_auto_method(self, mock_tesseract, mock_reader_class, test_image_path):
        """Test auto method selection for OCR"""
        # Mock EasyOCR
        mock_reader = MagicMock()
        mock_reader.readtext.return_value = [([0, 0, 100, 30], 'Energy: 250 kcal', 0.9)]
        mock_reader_class.return_value = mock_reader
        
        # Mock Tesseract
        mock_tesseract.return_value = "Energy: 250 kcal"
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine.extract_text(test_image_path, method='auto')
        
        assert text is not None
        assert confidence >= 0.0
    
    @patch('pytesseract.image_to_string')
    def test_extract_text_tesseract_only(self, mock_tesseract, test_image_path):
        """Test Tesseract-only extraction"""
        mock_tesseract.return_value = "Energy: 250 kcal"
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine.extract_text(test_image_path, method='tesseract')
        
        assert text == "Energy: 250 kcal"
        assert confidence > 0.0


class TestOCRIntegration:
    """Test the main OCR integration functions"""
    
    @patch('app.services.nutrition_ocr.LocalOCREngine')
    @patch('app.services.nutrition_ocr.ImagePreprocessor')
    def test_extract_nutrients_from_image_success(self, mock_preprocessor, mock_engine_class, test_image_path):
        """Test successful nutrient extraction from image"""
        # Mock preprocessing
        mock_preprocessor.preprocess_image.return_value = test_image_path
        
        # Mock OCR engine
        mock_engine = MagicMock()
        mock_engine.extract_text.return_value = ("Energy: 250 kcal\nProtein: 12.5g", 0.8)
        mock_engine_class.return_value = mock_engine
        
        result = extract_nutrients_from_image(test_image_path, debug=False)
        
        assert 'source' in result
        assert result['source'] == 'Local OCR'
        assert 'confidence' in result
        assert 'nutrients' in result
        assert result['confidence'] > 0.0
    
    @patch('app.services.nutrition_ocr.LocalOCREngine')
    def test_extract_nutrients_with_debug(self, mock_engine_class, test_image_path):
        """Test nutrient extraction with debug mode"""
        mock_engine = MagicMock()
        mock_engine.extract_text.return_value = ("Energy: 250 kcal", 0.5)
        mock_engine_class.return_value = mock_engine
        
        result = extract_nutrients_from_image(test_image_path, debug=True)
        
        assert 'debug_info' in result
        assert 'preprocessing_time' in result['debug_info']
        assert 'ocr_time' in result['debug_info']
        assert 'parsing_time' in result['debug_info']
    
    def test_call_external_ocr_mock(self, test_image_path):
        """Test external OCR mock functionality"""
        result = call_external_ocr(test_image_path, provider='mock')
        
        assert 'source' in result
        assert result['source'] == 'External OCR (Mock)'
        assert 'confidence' in result
        assert result['confidence'] == 0.95
        assert 'nutrients' in result
    
    def test_call_external_ocr_unsupported_provider(self, test_image_path):
        """Test external OCR with unsupported provider"""
        result = call_external_ocr(test_image_path, provider='unsupported')
        
        assert 'error' in result
        assert 'unsupported provider' in result['error'].lower()


class TestOCRErrorHandling:
    """Test OCR error handling scenarios"""
    
    def test_extract_nutrients_missing_file(self):
        """Test extraction with missing image file"""
        result = extract_nutrients_from_image("/nonexistent/file.png")
        
        assert 'error' in result
        assert result['confidence'] == 0.0
    
    @patch('cv2.imread')
    def test_extract_nutrients_corrupted_image(self, mock_imread, test_image_path):
        """Test extraction with corrupted image"""
        mock_imread.return_value = None
        
        result = extract_nutrients_from_image(test_image_path)
        
        # Should handle gracefully and return low confidence result
        assert 'confidence' in result
        assert result['confidence'] >= 0.0
    
    @patch('app.services.nutrition_ocr.LocalOCREngine')
    def test_extract_nutrients_ocr_timeout(self, mock_engine_class, test_image_path):
        """Test OCR timeout handling"""
        mock_engine = MagicMock()
        mock_engine.extract_text.side_effect = TimeoutError("OCR timeout")
        mock_engine_class.return_value = mock_engine
        
        result = extract_nutrients_from_image(test_image_path)
        
        assert 'error' in result or result['confidence'] == 0.0
    
    @patch('app.services.nutrition_ocr.LocalOCREngine')
    def test_extract_nutrients_memory_error(self, mock_engine_class, test_image_path):
        """Test memory exhaustion handling"""
        mock_engine = MagicMock()
        mock_engine.extract_text.side_effect = MemoryError("Out of memory")
        mock_engine_class.return_value = mock_engine
        
        result = extract_nutrients_from_image(test_image_path)
        
        assert 'error' in result or result['confidence'] == 0.0


class TestOCRPerformance:
    """Test OCR performance characteristics"""
    
    @patch('app.services.nutrition_ocr.LocalOCREngine')
    def test_ocr_processing_time_tracking(self, mock_engine_class, test_image_path):
        """Test that processing times are tracked"""
        mock_engine = MagicMock()
        mock_engine.extract_text.return_value = ("Energy: 250 kcal", 0.8)
        mock_engine_class.return_value = mock_engine
        
        result = extract_nutrients_from_image(test_image_path, debug=True)
        
        assert 'debug_info' in result
        debug_info = result['debug_info']
        assert 'total_time' in debug_info
        assert 'preprocessing_time' in debug_info
        assert 'ocr_time' in debug_info
        assert 'parsing_time' in debug_info
        assert debug_info['total_time'] > 0
    
    @patch('app.services.nutrition_ocr.LocalOCREngine')
    def test_large_image_handling(self, mock_engine_class):
        """Test handling of large images"""
        # Create large test image
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            large_img = np.ones((3000, 4000, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, large_img)
            
            mock_engine = MagicMock()
            mock_engine.extract_text.return_value = ("Energy: 250 kcal", 0.8)
            mock_engine_class.return_value = mock_engine
            
            result = extract_nutrients_from_image(tmp.name)
            
            assert 'confidence' in result
            assert result['confidence'] >= 0.0
            
            os.unlink(tmp.name)
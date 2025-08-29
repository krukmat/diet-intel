import pytest
import os
import tempfile
from unittest.mock import patch, MagicMock, mock_open
import numpy as np
from PIL import Image

from app.services.nutrition_ocr import (
    ImagePreprocessor,
    NutritionTextParser,
    LocalOCREngine,
    extract_nutrients_from_image,
    call_external_ocr
)


@pytest.fixture
def sample_nutrition_text_english():
    """Sample English nutrition text with various formats"""
    return '''
    NUTRITION FACTS
    Serving Size: 100g
    
    Energy: 350 kcal
    Protein: 12.5g
    Fat: 8.2g
    Carbohydrates: 65.3g
    Sugars: 15.2g
    Salt: 1.1g
    Fiber: 4.2g
    '''


@pytest.fixture
def sample_nutrition_text_spanish():
    """Sample Spanish nutrition text"""
    return '''
    INFORMACIÓN NUTRICIONAL
    Por 100g
    
    Energía: 1465 kJ / 350 kcal
    Proteínas: 12,5g
    Grasas: 8,2g
    Carbohidratos: 65,3g
    Azúcares: 15,2g
    Sal: 1,1g
    '''


@pytest.fixture
def sample_nutrition_text_mixed_quality():
    """Sample text with OCR errors and formatting issues"""
    return '''
    NUTRlTlON FACTS  // OCR errors: I instead of I
    5erving 5ize l00g  // OCR errors: 5 instead of S, l instead of 1
    
    Energy 35O kcal   // O instead of 0
    Protern 12.5 g    // Missing i
    Fat 8,2g          // Comma instead of dot
    Carbs 65.3        // Missing unit
    5ugars l5.2g      // OCR errors
    '''


@pytest.fixture
def sample_image_path():
    """Create a temporary image file for testing"""
    # Create a simple test image
    img = Image.new('RGB', (400, 300), color='white')
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        img.save(f.name)
        yield f.name
    
    # Cleanup
    try:
        os.unlink(f.name)
    except OSError:
        pass


class TestImagePreprocessor:
    """Test image preprocessing pipeline"""
    
    def test_preprocess_image_success(self, sample_image_path):
        """Test successful image preprocessing"""
        preprocessor = ImagePreprocessor()
        
        with patch('cv2.imread') as mock_imread, \
             patch('cv2.imwrite') as mock_imwrite, \
             patch('cv2.cvtColor') as mock_cvtColor, \
             patch('cv2.resize') as mock_resize:
            
            # Mock image data
            mock_image = np.ones((300, 400, 3), dtype=np.uint8) * 255
            mock_imread.return_value = mock_image
            mock_cvtColor.return_value = np.ones((300, 400), dtype=np.uint8) * 255
            mock_resize.return_value = np.ones((750, 1000), dtype=np.uint8) * 255
            
            result_path = preprocessor.preprocess_image(sample_image_path)
            
            assert result_path.endswith('_processed.png')
            mock_imread.assert_called_once_with(sample_image_path)
            mock_imwrite.assert_called_once()
    
    def test_preprocess_image_invalid_path(self):
        """Test preprocessing with invalid image path"""
        preprocessor = ImagePreprocessor()
        
        with patch('cv2.imread', return_value=None):
            # Should return original path as fallback
            result_path = preprocessor.preprocess_image("invalid_path.jpg")
            assert result_path == "invalid_path.jpg"
    
    def test_preprocess_image_with_debug(self, sample_image_path):
        """Test preprocessing with debug mode enabled"""
        preprocessor = ImagePreprocessor()
        
        with patch('cv2.imread') as mock_imread, \
             patch('cv2.imwrite') as mock_imwrite, \
             patch('os.makedirs') as mock_makedirs:
            
            mock_image = np.ones((300, 400, 3), dtype=np.uint8) * 255
            mock_imread.return_value = mock_image
            
            result_path = preprocessor.preprocess_image(sample_image_path, save_debug=True)
            
            # Should create debug directory
            mock_makedirs.assert_called_once()
            # Should save multiple debug images
            assert mock_imwrite.call_count > 5


class TestNutritionTextParser:
    """Test nutrition text parsing with various formats"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_parse_english_nutrition_text(self, parser, sample_nutrition_text_english):
        """Test parsing clean English nutrition text"""
        result = parser.parse_nutrition_text(sample_nutrition_text_english)
        
        assert result['confidence'] > 0.7
        
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 350.0
        assert nutrients['protein_g'] == 12.5
        assert nutrients['fat_g'] == 8.2
        assert nutrients['carbs_g'] == 65.3
        assert nutrients['sugars_g'] == 15.2
        assert nutrients['salt_g'] == 1.1
        
        assert len(result['missing_required']) == 0  # All required nutrients found
    
    def test_parse_spanish_nutrition_text(self, parser, sample_nutrition_text_spanish):
        """Test parsing Spanish nutrition text with kJ conversion"""
        result = parser.parse_nutrition_text(sample_nutrition_text_spanish)
        
        assert result['confidence'] > 0.6
        
        nutrients = result['parsed_nutriments']
        assert nutrients['energy_kcal'] == 350.0  # Should use kcal, not convert from kJ
        assert nutrients['protein_g'] == 12.5
        assert nutrients['fat_g'] == 8.2
        assert nutrients['carbs_g'] == 65.3
        
        # Check for Spanish-specific extraction
        assert 'energia' in result['normalized_text']  # Should normalize Spanish
    
    def test_parse_mixed_quality_text(self, parser, sample_nutrition_text_mixed_quality):
        """Test parsing text with OCR errors"""
        result = parser.parse_nutrition_text(sample_nutrition_text_mixed_quality)
        
        # Should still extract some nutrients despite errors
        nutrients = result['parsed_nutriments']
        
        # Energy should be parsed (35O -> 350)
        assert 'energy_kcal' in nutrients
        
        # Some nutrients might be missing due to OCR errors, but confidence should reflect this
        assert 0.0 <= result['confidence'] <= 1.0
        assert isinstance(result['missing_required'], list)
    
    def test_parse_empty_text(self, parser):
        """Test parsing empty or invalid text"""
        result = parser.parse_nutrition_text("")
        
        assert result['confidence'] == 0.0
        assert len(result['parsed_nutriments']) == 0
        assert len(result['missing_required']) == len(parser.required_nutrients)
    
    def test_parse_kj_to_kcal_conversion(self, parser):
        """Test conversion from kJ to kcal"""
        text = "Energy: 1465 kJ"
        result = parser.parse_nutrition_text(text)
        
        if 'energy_kcal' in result['parsed_nutriments']:
            # 1465 kJ ≈ 350 kcal
            expected_kcal = round(1465 / 4.184, 1)
            assert abs(result['parsed_nutriments']['energy_kcal'] - expected_kcal) < 1.0
    
    def test_normalize_text(self, parser):
        """Test text normalization function"""
        messy_text = "Proteína: 12,5g  Energy  350  Kcal"
        normalized = parser._normalize_text(messy_text)
        
        assert 'proteina' in normalized  # Should remove accent
        assert '12.5g' in normalized     # Should normalize decimal separator
        assert 'kcal' in normalized      # Should normalize case
    
    def test_extract_nutrient_value(self, parser):
        """Test individual nutrient extraction"""
        text = "Protein: 15.5g per serving"
        
        patterns = parser.NUTRIENT_KEYWORDS['protein_g']
        value, confidence, pattern = parser._extract_nutrient_value(text, patterns, 'protein_g')
        
        assert value == 15.5
        assert 0.0 < confidence <= 1.0
        assert pattern != ""
    
    def test_is_reasonable_value(self, parser):
        """Test value range validation"""
        # Valid values
        assert parser._is_reasonable_value(250.0, 'energy_kcal') == True
        assert parser._is_reasonable_value(15.0, 'protein_g') == True
        
        # Invalid values
        assert parser._is_reasonable_value(1500.0, 'energy_kcal') == False  # Too high
        assert parser._is_reasonable_value(-5.0, 'protein_g') == False      # Negative
        assert parser._is_reasonable_value(150.0, 'fat_g') == False         # Too high
    
    def test_confidence_calculation(self, parser):
        """Test confidence score calculation"""
        # High confidence case: all required nutrients found
        nutrients_complete = {
            'energy_kcal': 300.0,
            'protein_g': 10.0,
            'fat_g': 5.0,
            'carbs_g': 50.0
        }
        extraction_details = {
            nutrient: {'confidence': 0.8} for nutrient in nutrients_complete
        }
        
        confidence = parser._calculate_confidence(nutrients_complete, extraction_details, "nutrition facts per 100g")
        assert confidence > 0.7
        
        # Low confidence case: missing nutrients
        nutrients_incomplete = {'energy_kcal': 300.0}
        extraction_details_incomplete = {'energy_kcal': {'confidence': 0.6}}
        
        confidence_low = parser._calculate_confidence(nutrients_incomplete, extraction_details_incomplete, "short")
        assert confidence_low < 0.6


class TestLocalOCREngine:
    """Test local OCR engine functionality"""
    
    @pytest.fixture
    def ocr_engine(self):
        # Use mock EasyOCR to avoid initialization in tests
        with patch('easyocr.Reader'):
            return LocalOCREngine(use_easyocr=False)  # Tesseract only for tests
    
    def test_extract_text_tesseract(self, ocr_engine, sample_image_path):
        """Test text extraction using Tesseract"""
        mock_text = "NUTRITION FACTS Energy: 350 kcal Protein: 12g"
        mock_data = {
            'conf': ['85', '90', '80', '95', '88'],
            'text': ['NUTRITION', 'FACTS', 'Energy:', '350', 'kcal']
        }
        
        with patch('pytesseract.image_to_string', return_value=mock_text), \
             patch('pytesseract.image_to_data', return_value=mock_data):
            
            text, confidence = ocr_engine.extract_text(sample_image_path, method='tesseract')
            
            assert text == mock_text
            assert 0.0 < confidence <= 1.0
    
    def test_extract_text_auto_method(self, sample_image_path):
        """Test automatic method selection"""
        mock_text = "Test nutrition text"
        
        with patch('pytesseract.image_to_string', return_value=mock_text), \
             patch('pytesseract.image_to_data', return_value={'conf': ['90']}):
            
            # Test without EasyOCR
            ocr_engine = LocalOCREngine(use_easyocr=False)
            text, confidence = ocr_engine.extract_text(sample_image_path, method='auto')
            
            assert text == mock_text
            assert confidence > 0.0
    
    def test_extract_text_tesseract_failure(self, ocr_engine, sample_image_path):
        """Test handling of Tesseract failures"""
        with patch('pytesseract.image_to_string', side_effect=Exception("Tesseract failed")):
            
            text, confidence = ocr_engine.extract_text(sample_image_path, method='tesseract')
            
            assert text == ""
            assert confidence == 0.0
    
    def test_extract_text_invalid_method(self, ocr_engine, sample_image_path):
        """Test handling of invalid OCR method"""
        with pytest.raises(ValueError, match="Unknown OCR method"):
            ocr_engine.extract_text(sample_image_path, method='invalid')


class TestMainServiceFunctions:
    """Test main service functions"""
    
    def test_extract_nutrients_from_image_success(self, sample_image_path):
        """Test successful nutrient extraction"""
        mock_ocr_text = "NUTRITION FACTS Energy: 350 kcal Protein: 12.5g Fat: 8g"
        
        with patch('app.services.nutrition_ocr.ImagePreprocessor.preprocess_image', return_value=sample_image_path), \
             patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=(mock_ocr_text, 0.8)), \
             patch('os.remove'):  # Mock cleanup
            
            result = extract_nutrients_from_image(sample_image_path)
            
            assert result['confidence'] > 0.0
            assert 'energy_kcal' in result['parsed_nutriments']
            assert result['raw_text'] == mock_ocr_text
            assert 'processing_details' in result
    
    def test_extract_nutrients_from_image_no_text(self, sample_image_path):
        """Test handling when no text is extracted"""
        with patch('app.services.nutrition_ocr.ImagePreprocessor.preprocess_image', return_value=sample_image_path), \
             patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=("", 0.0)):
            
            result = extract_nutrients_from_image(sample_image_path)
            
            assert result['confidence'] == 0.0
            assert len(result['parsed_nutriments']) == 0
            assert 'No text extracted' in result['processing_details']['error']
    
    def test_extract_nutrients_from_image_processing_error(self, sample_image_path):
        """Test handling of processing errors"""
        with patch('app.services.nutrition_ocr.ImagePreprocessor.preprocess_image', 
                  side_effect=Exception("Processing failed")):
            
            result = extract_nutrients_from_image(sample_image_path)
            
            assert result['confidence'] == 0.0
            assert 'error' in result['processing_details']
    
    def test_extract_nutrients_from_image_with_debug(self, sample_image_path):
        """Test nutrient extraction with debug mode"""
        with patch('app.services.nutrition_ocr.ImagePreprocessor.preprocess_image', return_value=sample_image_path), \
             patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=("test text", 0.5)):
            
            result = extract_nutrients_from_image(sample_image_path, debug=True)
            
            # Should include processed image path in debug mode
            assert result['processing_details'].get('processed_image_path') is not None
    
    def test_call_external_ocr_mock_provider(self, sample_image_path):
        """Test external OCR with mock provider"""
        result = call_external_ocr(sample_image_path, provider='mock')
        
        assert result['confidence'] == 0.95
        assert len(result['parsed_nutriments']) > 0
        assert 'energy_kcal' in result['parsed_nutriments']
        assert result['processing_details']['provider'] == 'mock'
        assert 'NUTRITION FACTS' in result['raw_text']
    
    def test_call_external_ocr_unimplemented_provider(self, sample_image_path):
        """Test external OCR with unimplemented provider"""
        result = call_external_ocr(sample_image_path, provider='nonexistent')
        
        assert result['confidence'] == 0.0
        assert len(result['parsed_nutriments']) == 0
        assert 'not implemented' in result['processing_details']['error']
        assert 'implementation_guide' in result['processing_details']


class TestConfidenceThresholding:
    """Test confidence-based decision making"""
    
    def test_high_confidence_extraction(self):
        """Test high confidence scenario"""
        # Simulate perfect extraction
        parser = NutritionTextParser()
        
        perfect_text = '''
        NUTRITION FACTS
        Per 100g
        Energy: 350 kcal
        Protein: 15.0g
        Fat: 10.0g
        Carbohydrates: 60.0g
        Sugars: 12.0g
        Salt: 1.5g
        '''
        
        result = parser.parse_nutrition_text(perfect_text)
        
        # Should have high confidence with all required nutrients
        assert result['confidence'] > 0.8
        assert len(result['missing_required']) == 0
        assert len(result['parsed_nutriments']) >= 4  # At least required nutrients
    
    def test_medium_confidence_extraction(self):
        """Test medium confidence scenario"""
        parser = NutritionTextParser()
        
        partial_text = '''
        Energy 350 cal
        Protein 15g
        Fat missing
        Carbs 60
        '''
        
        result = parser.parse_nutrition_text(partial_text)
        
        # Should have medium confidence with some nutrients missing
        assert 0.3 < result['confidence'] < 0.8
        assert len(result['missing_required']) > 0
        assert len(result['parsed_nutriments']) > 0
    
    def test_low_confidence_extraction(self):
        """Test low confidence scenario"""
        parser = NutritionTextParser()
        
        poor_text = "random text with no nutrition info 123 abc"
        
        result = parser.parse_nutrition_text(poor_text)
        
        # Should have low confidence
        assert result['confidence'] < 0.5
        assert len(result['missing_required']) >= 3  # Most required nutrients missing


class TestParsingHeuristics:
    """Test various parsing edge cases and heuristics"""
    
    @pytest.fixture
    def parser(self):
        return NutritionTextParser()
    
    def test_decimal_separator_handling(self, parser):
        """Test handling of different decimal separators"""
        text_with_commas = "Energy: 350,5 kcal Protein: 12,3g"
        result = parser.parse_nutrition_text(text_with_commas)
        
        nutrients = result['parsed_nutriments']
        assert nutrients.get('energy_kcal') == 350.5
        assert nutrients.get('protein_g') == 12.3
    
    def test_unit_variations(self, parser):
        """Test handling of various unit formats"""
        text_variations = '''
        Energy 350kcal
        Protein: 12 g
        Fat 8.0 grams
        Carbs: 65g
        '''
        
        result = parser.parse_nutrition_text(text_variations)
        nutrients = result['parsed_nutriments']
        
        # Should extract values despite unit variations
        assert 'energy_kcal' in nutrients
        assert 'protein_g' in nutrients
    
    def test_multilingual_keywords(self, parser):
        """Test extraction with mixed language keywords"""
        mixed_text = '''
        Energía: 350 kcal
        Protein: 12g
        Grasas: 8g
        Carbohydrates: 65g
        '''
        
        result = parser.parse_nutrition_text(mixed_text)
        nutrients = result['parsed_nutriments']
        
        # Should handle both English and Spanish keywords
        assert 'energy_kcal' in nutrients
        assert 'protein_g' in nutrients
        assert 'fat_g' in nutrients
    
    def test_range_value_handling(self, parser):
        """Test handling of value ranges (take first value)"""
        text_with_ranges = "Energy: 340-360 kcal Protein: 12-15g"
        result = parser.parse_nutrition_text(text_with_ranges)
        
        # Should extract the first value from ranges
        nutrients = result['parsed_nutriments']
        if 'energy_kcal' in nutrients:
            assert 340 <= nutrients['energy_kcal'] <= 360
    
    def test_per_serving_vs_per_100g(self, parser):
        """Test distinction between per serving and per 100g values"""
        text_per_100g = '''
        Per 100g:
        Energy: 350 kcal
        Protein: 15g
        '''
        
        text_per_serving = '''
        Per serving (50g):
        Energy: 175 kcal
        Protein: 7.5g
        '''
        
        result_100g = parser.parse_nutrition_text(text_per_100g)
        result_serving = parser.parse_nutrition_text(text_per_serving)
        
        # Both should extract values, but confidence might differ
        assert 'energy_kcal' in result_100g['parsed_nutriments']
        assert 'energy_kcal' in result_serving['parsed_nutriments']
        
        # Per 100g might have higher confidence due to standardization
        # (This is heuristic-based, exact comparison may vary)
    
    def test_ocr_error_tolerance(self, parser):
        """Test tolerance for common OCR errors"""
        text_with_errors = '''
        NUTRlTlON FACTS  // l instead of I
        Energy: 35O kcal // O instead of 0
        Protern: l2.5g   // missing i, l instead of 1
        '''
        
        result = parser.parse_nutrition_text(text_with_errors)
        
        # Should still extract some values despite OCR errors
        # Confidence will be lower, but some extraction should succeed
        assert result['confidence'] >= 0.0
        if result['parsed_nutriments']:
            assert any(v > 0 for v in result['parsed_nutriments'].values())


class TestIntegrationScenarios:
    """Integration tests combining multiple components"""
    
    def test_full_pipeline_high_quality_image(self, sample_image_path):
        """Test full pipeline with high-quality input"""
        mock_clean_text = '''
        NUTRITION FACTS
        Serving Size: 100g
        
        Energy: 450 kcal
        Protein: 18.0g
        Fat: 12.0g
        Carbohydrates: 58.0g
        Sugars: 8.5g
        Salt: 2.1g
        Fiber: 6.0g
        '''
        
        with patch('app.services.nutrition_ocr.ImagePreprocessor.preprocess_image', return_value=sample_image_path), \
             patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=(mock_clean_text, 0.9)):
            
            result = extract_nutrients_from_image(sample_image_path)
            
            # Should achieve high confidence with complete extraction
            assert result['confidence'] > 0.8
            assert len(result['parsed_nutriments']) >= 6
            assert len(result['processing_details']['missing_required']) == 0
    
    def test_full_pipeline_poor_quality_image(self, sample_image_path):
        """Test full pipeline with poor-quality input"""
        mock_poor_text = "35O cal prot 1O fat 5 carb"  # OCR errors, missing units
        
        with patch('app.services.nutrition_ocr.ImagePreprocessor.preprocess_image', return_value=sample_image_path), \
             patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=(mock_poor_text, 0.3)):
            
            result = extract_nutrients_from_image(sample_image_path)
            
            # Should have low confidence but still extract something
            assert result['confidence'] < 0.7
            assert len(result['processing_details']['missing_required']) > 0
    
    def test_local_vs_external_ocr_comparison(self, sample_image_path):
        """Test comparison between local and external OCR"""
        # Mock poor local OCR result
        mock_local_text = "350 cal 12 prot"  # Incomplete
        
        with patch('app.services.nutrition_ocr.ImagePreprocessor.preprocess_image', return_value=sample_image_path), \
             patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=(mock_local_text, 0.4)):
            
            local_result = extract_nutrients_from_image(sample_image_path)
            external_result = call_external_ocr(sample_image_path, provider='mock')
            
            # External should have higher confidence and more complete data
            assert external_result['confidence'] > local_result['confidence']
            assert len(external_result['parsed_nutriments']) >= len(local_result['parsed_nutriments'])
    
    def test_confidence_threshold_decision_making(self, sample_image_path):
        """Test decision making based on confidence thresholds"""
        
        def should_use_external_ocr(local_confidence: float, threshold: float = 0.7) -> bool:
            return local_confidence < threshold
        
        # Test high confidence local result
        with patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=("good text", 0.8)):
            local_result = extract_nutrients_from_image(sample_image_path)
            assert not should_use_external_ocr(local_result['confidence'])  # Should not need external
        
        # Test low confidence local result
        with patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', return_value=("poor text", 0.3)):
            local_result = extract_nutrients_from_image(sample_image_path)
            assert should_use_external_ocr(local_result['confidence'])  # Should use external


# Performance and stress tests
class TestPerformanceAndEdgeCases:
    """Test performance characteristics and edge cases"""
    
    def test_large_text_handling(self):
        """Test handling of very large OCR text"""
        parser = NutritionTextParser()
        
        # Create large text with nutrition info buried inside
        large_text = "random text " * 1000 + "Energy: 300 kcal Protein: 15g" + " more text" * 1000
        
        result = parser.parse_nutrition_text(large_text)
        
        # Should still find the nutrition info
        assert 'energy_kcal' in result['parsed_nutriments']
        assert result['parsed_nutriments']['energy_kcal'] == 300.0
    
    def test_empty_and_none_inputs(self):
        """Test handling of empty and None inputs"""
        # Test extract_nutrients_from_image with invalid path
        result = extract_nutrients_from_image("")
        assert result['confidence'] == 0.0
        
        # Test parser with None input
        parser = NutritionTextParser()
        result = parser.parse_nutrition_text(None)
        assert result['confidence'] == 0.0
    
    def test_concurrent_processing_simulation(self, sample_image_path):
        """Test concurrent processing simulation"""
        import asyncio
        
        async def process_image():
            # Simulate async processing
            with patch('app.services.nutrition_ocr.LocalOCREngine.extract_text', 
                      return_value=("test text", 0.5)):
                return extract_nutrients_from_image(sample_image_path)
        
        # This test mainly ensures no race conditions in data structures
        # In real async environment, you'd use asyncio.gather
        result = asyncio.run(process_image())
        assert 'confidence' in result
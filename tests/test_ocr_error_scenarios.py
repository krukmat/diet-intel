import pytest
import os
import tempfile
import cv2
import numpy as np
from unittest.mock import patch, MagicMock
from PIL import Image
from app.services.nutrition_ocr import (
    ImagePreprocessor,
    LocalOCREngine,
    NutritionTextParser,
    extract_nutrients_from_image,
    call_external_ocr
)


class TestCorruptedImageHandling:
    """Test handling of corrupted or invalid image files"""
    
    @pytest.fixture
    def corrupted_image_path(self):
        """Create a corrupted image file"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            tmp.write(b"This is not an image file content")
            yield tmp.name
        os.unlink(tmp.name)
    
    @pytest.fixture
    def zero_byte_image_path(self):
        """Create a zero-byte image file"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # File is created but empty
            yield tmp.name
        os.unlink(tmp.name)
    
    def test_preprocess_corrupted_image(self, corrupted_image_path):
        """Test preprocessing with corrupted image data"""
        result = ImagePreprocessor.preprocess_image(corrupted_image_path)
        
        # Should return original path as fallback
        assert result == corrupted_image_path
    
    def test_preprocess_zero_byte_image(self, zero_byte_image_path):
        """Test preprocessing with zero-byte image file"""
        result = ImagePreprocessor.preprocess_image(zero_byte_image_path)
        
        # Should handle gracefully
        assert result == zero_byte_image_path
    
    @patch('cv2.imread')
    def test_cv2_imread_returns_none(self, mock_imread):
        """Test when cv2.imread returns None (corrupted image)"""
        mock_imread.return_value = None
        
        result = ImagePreprocessor.preprocess_image("test.png")
        
        # Should return original path as fallback
        assert result == "test.png"
    
    def test_extract_nutrients_corrupted_image(self, corrupted_image_path):
        """Test nutrient extraction with corrupted image"""
        result = extract_nutrients_from_image(corrupted_image_path)
        
        assert 'error' in result or result['confidence'] == 0.0
        assert result['source'] == 'Local OCR'
    
    def test_ocr_engine_with_corrupted_image(self, corrupted_image_path):
        """Test OCR engine with corrupted image"""
        engine = LocalOCREngine()
        text, confidence = engine.extract_text(corrupted_image_path)
        
        assert text == ""
        assert confidence == 0.0


class TestLowQualityImageProcessing:
    """Test handling of low-quality images"""
    
    @pytest.fixture
    def blurry_image_path(self):
        """Create a blurry test image"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Create very small, pixelated image
            img = np.random.randint(0, 255, (50, 80, 3), dtype=np.uint8)
            # Apply heavy blur
            img = cv2.GaussianBlur(img, (15, 15), 5)
            cv2.imwrite(tmp.name, img)
            yield tmp.name
        os.unlink(tmp.name)
    
    @pytest.fixture
    def noisy_image_path(self):
        """Create a noisy test image"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Create image with random noise
            img = np.random.randint(0, 255, (100, 150, 3), dtype=np.uint8)
            cv2.imwrite(tmp.name, img)
            yield tmp.name
        os.unlink(tmp.name)
    
    @pytest.fixture
    def low_contrast_image_path(self):
        """Create a low-contrast test image"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            # Create low contrast image (gray values between 100-120)
            img = np.full((100, 150, 3), 110, dtype=np.uint8)
            cv2.imwrite(tmp.name, img)
            yield tmp.name
        os.unlink(tmp.name)
    
    def test_preprocess_blurry_image(self, blurry_image_path):
        """Test preprocessing of blurry image"""
        result = ImagePreprocessor.preprocess_image(blurry_image_path)
        
        # Should still process and return a processed path
        assert result is not None
        assert result.endswith('_processed.png')
        
        # Clean up
        if os.path.exists(result) and result != blurry_image_path:
            os.unlink(result)
    
    def test_preprocess_noisy_image(self, noisy_image_path):
        """Test preprocessing of noisy image"""
        result = ImagePreprocessor.preprocess_image(noisy_image_path)
        
        assert result is not None
        assert result.endswith('_processed.png')
        
        # Clean up
        if os.path.exists(result) and result != noisy_image_path:
            os.unlink(result)
    
    def test_extract_nutrients_low_quality_image(self, blurry_image_path):
        """Test nutrient extraction from low-quality image"""
        result = extract_nutrients_from_image(blurry_image_path)
        
        # Should handle gracefully with low confidence
        assert 'confidence' in result
        assert result['confidence'] >= 0.0
        assert 'nutrients' in result


class TestTesseractErrorHandling:
    """Test handling of Tesseract OCR errors"""
    
    @pytest.fixture
    def test_image_path(self):
        """Create a simple test image"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 200, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, img)
            yield tmp.name
        os.unlink(tmp.name)
    
    @patch('pytesseract.image_to_string')
    def test_tesseract_timeout_error(self, mock_tesseract, test_image_path):
        """Test Tesseract timeout handling"""
        mock_tesseract.side_effect = TimeoutError("Tesseract timeout")
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine._extract_with_tesseract(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('pytesseract.image_to_string')
    def test_tesseract_runtime_error(self, mock_tesseract, test_image_path):
        """Test Tesseract runtime error handling"""
        mock_tesseract.side_effect = RuntimeError("Tesseract failed")
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine._extract_with_tesseract(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('pytesseract.image_to_string')
    def test_tesseract_file_not_found(self, mock_tesseract, test_image_path):
        """Test Tesseract file not found error"""
        mock_tesseract.side_effect = FileNotFoundError("tesseract not found")
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine._extract_with_tesseract(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('pytesseract.image_to_string')
    def test_tesseract_permission_error(self, mock_tesseract, test_image_path):
        """Test Tesseract permission error handling"""
        mock_tesseract.side_effect = PermissionError("Permission denied")
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine._extract_with_tesseract(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('pytesseract.image_to_string')
    def test_tesseract_empty_result(self, mock_tesseract, test_image_path):
        """Test when Tesseract returns empty result"""
        mock_tesseract.return_value = ""
        
        engine = LocalOCREngine(use_easyocr=False)
        text, confidence = engine._extract_with_tesseract(test_image_path)
        
        assert text == ""
        assert confidence == 0.0


class TestEasyOCRErrorHandling:
    """Test handling of EasyOCR errors"""
    
    @pytest.fixture
    def test_image_path(self):
        """Create a simple test image"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 200, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, img)
            yield tmp.name
        os.unlink(tmp.name)
    
    @patch('easyocr.Reader')
    def test_easyocr_initialization_error(self, mock_reader_class, test_image_path):
        """Test EasyOCR initialization error"""
        mock_reader_class.side_effect = RuntimeError("EasyOCR init failed")
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine._extract_with_easyocr(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('easyocr.Reader')
    def test_easyocr_readtext_error(self, mock_reader_class, test_image_path):
        """Test EasyOCR readtext method error"""
        mock_reader = MagicMock()
        mock_reader.readtext.side_effect = Exception("EasyOCR readtext failed")
        mock_reader_class.return_value = mock_reader
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine._extract_with_easyocr(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('easyocr.Reader')
    def test_easyocr_memory_error(self, mock_reader_class, test_image_path):
        """Test EasyOCR memory error handling"""
        mock_reader_class.side_effect = MemoryError("Out of memory")
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine._extract_with_easyocr(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('easyocr.Reader')
    def test_easyocr_empty_results(self, mock_reader_class, test_image_path):
        """Test when EasyOCR returns empty results"""
        mock_reader = MagicMock()
        mock_reader.readtext.return_value = []
        mock_reader_class.return_value = mock_reader
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine._extract_with_easyocr(test_image_path)
        
        assert text == ""
        assert confidence == 0.0
    
    @patch('easyocr.Reader')
    def test_easyocr_malformed_results(self, mock_reader_class, test_image_path):
        """Test when EasyOCR returns malformed results"""
        mock_reader = MagicMock()
        # Return malformed result (missing confidence score)
        mock_reader.readtext.return_value = [([0, 0, 100, 30], 'text')]
        mock_reader_class.return_value = mock_reader
        
        engine = LocalOCREngine(use_easyocr=True)
        text, confidence = engine._extract_with_easyocr(test_image_path)
        
        # Should handle malformed results gracefully
        assert isinstance(text, str)
        assert isinstance(confidence, (int, float))
        assert confidence >= 0.0


class TestUnsupportedImageFormats:
    """Test handling of unsupported image formats"""
    
    @pytest.fixture
    def text_file_path(self):
        """Create a text file with .jpg extension"""
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False, mode='w') as tmp:
            tmp.write("This is not an image")
            yield tmp.name
        os.unlink(tmp.name)
    
    @pytest.fixture
    def binary_file_path(self):
        """Create a binary file that's not an image"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            tmp.write(b"\x00\x01\x02\x03\x04\x05")
            yield tmp.name
        os.unlink(tmp.name)
    
    def test_text_file_as_image(self, text_file_path):
        """Test processing text file as image"""
        result = extract_nutrients_from_image(text_file_path)
        
        assert 'error' in result or result['confidence'] == 0.0
    
    def test_binary_file_as_image(self, binary_file_path):
        """Test processing binary file as image"""
        result = extract_nutrients_from_image(binary_file_path)
        
        assert 'error' in result or result['confidence'] == 0.0
    
    def test_nonexistent_file(self):
        """Test processing nonexistent file"""
        result = extract_nutrients_from_image("/nonexistent/path/image.png")
        
        assert 'error' in result
        assert result['confidence'] == 0.0
    
    def test_directory_as_image(self):
        """Test processing directory path as image"""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = extract_nutrients_from_image(tmpdir)
            
            assert 'error' in result or result['confidence'] == 0.0


class TestMemoryExhaustionScenarios:
    """Test handling of memory exhaustion scenarios"""
    
    @patch('cv2.imread')
    def test_large_image_memory_error(self, mock_imread):
        """Test memory error when loading large image"""
        mock_imread.side_effect = MemoryError("Cannot allocate memory")
        
        result = ImagePreprocessor.preprocess_image("large_image.png")
        
        # Should return original path as fallback
        assert result == "large_image.png"
    
    @patch('cv2.resize')
    def test_resize_memory_error(self, mock_resize):
        """Test memory error during image resize"""
        mock_resize.side_effect = MemoryError("Cannot allocate memory for resize")
        
        # Create small test image
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            small_img = np.ones((50, 50, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, small_img)
            
            result = ImagePreprocessor.preprocess_image(tmp.name)
            
            # Should return original path as fallback
            assert result == tmp.name
            
            os.unlink(tmp.name)
    
    @patch('app.services.nutrition_ocr.LocalOCREngine')
    def test_ocr_memory_exhaustion(self, mock_engine_class):
        """Test OCR memory exhaustion handling"""
        mock_engine = MagicMock()
        mock_engine.extract_text.side_effect = MemoryError("OCR out of memory")
        mock_engine_class.return_value = mock_engine
        
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 100, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, img)
            
            result = extract_nutrients_from_image(tmp.name)
            
            assert 'error' in result or result['confidence'] == 0.0
            
            os.unlink(tmp.name)


class TestNetworkRelatedErrors:
    """Test handling of network-related errors for external OCR"""
    
    def test_external_ocr_timeout(self):
        """Test external OCR timeout handling"""
        # This would typically involve network calls
        result = call_external_ocr("test.png", provider="timeout_provider")
        
        # Mock provider should handle gracefully
        assert 'error' in result or 'source' in result
    
    def test_external_ocr_connection_error(self):
        """Test external OCR connection error"""
        result = call_external_ocr("test.png", provider="connection_error")
        
        assert 'error' in result or 'source' in result
    
    def test_external_ocr_invalid_response(self):
        """Test external OCR invalid response handling"""
        result = call_external_ocr("test.png", provider="invalid_response")
        
        assert 'error' in result or 'source' in result


class TestConcurrentAccessErrors:
    """Test handling of concurrent access errors"""
    
    @patch('cv2.imwrite')
    def test_file_write_permission_error(self, mock_imwrite):
        """Test file write permission error during preprocessing"""
        mock_imwrite.side_effect = PermissionError("Permission denied")
        
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 100, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, img)
            
            result = ImagePreprocessor.preprocess_image(tmp.name)
            
            # Should return original path as fallback
            assert result == tmp.name
            
            os.unlink(tmp.name)
    
    def test_temp_directory_access_error(self):
        """Test temporary directory access error"""
        # Mock scenario where temp directory is not writable
        with patch('tempfile.TemporaryDirectory') as mock_temp:
            mock_temp.side_effect = PermissionError("Cannot create temp directory")
            
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                img = np.ones((100, 100, 3), dtype=np.uint8) * 255
                cv2.imwrite(tmp.name, img)
                
                # This might still work with fallback paths
                result = extract_nutrients_from_image(tmp.name)
                
                assert 'error' in result or 'confidence' in result
                
                os.unlink(tmp.name)


class TestResourceCleanupErrors:
    """Test handling of resource cleanup errors"""
    
    @patch('os.unlink')
    def test_temp_file_cleanup_error(self, mock_unlink):
        """Test error during temporary file cleanup"""
        mock_unlink.side_effect = PermissionError("Cannot delete file")
        
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 100, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, img)
            
            # Should still complete processing despite cleanup error
            result = extract_nutrients_from_image(tmp.name, debug=False)
            
            assert 'confidence' in result
            
            # Manual cleanup
            try:
                os.unlink(tmp.name)
            except:
                pass
    
    @patch('shutil.rmtree')
    def test_debug_directory_cleanup_error(self, mock_rmtree):
        """Test error during debug directory cleanup"""
        mock_rmtree.side_effect = PermissionError("Cannot delete directory")
        
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 100, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, img)
            
            # Should still work despite cleanup error
            result = extract_nutrients_from_image(tmp.name, debug=True)
            
            assert 'confidence' in result
            
            os.unlink(tmp.name)


class TestMaliciousInputHandling:
    """Test handling of potentially malicious inputs"""
    
    def test_path_traversal_protection(self):
        """Test protection against path traversal attacks"""
        malicious_path = "../../../etc/passwd"
        
        result = extract_nutrients_from_image(malicious_path)
        
        # Should handle gracefully without exposing system files
        assert 'error' in result
        assert result['confidence'] == 0.0
    
    def test_extremely_long_filename(self):
        """Test handling of extremely long filenames"""
        long_filename = "a" * 1000 + ".png"
        
        result = extract_nutrients_from_image(long_filename)
        
        assert 'error' in result
        assert result['confidence'] == 0.0
    
    def test_special_characters_in_path(self):
        """Test handling of special characters in file paths"""
        special_paths = [
            "image\x00.png",  # Null byte
            "image\n.png",    # Newline
            "image|rm -rf /.png",  # Command injection attempt
        ]
        
        for path in special_paths:
            result = extract_nutrients_from_image(path)
            
            # Should handle safely
            assert 'error' in result or result['confidence'] == 0.0


class TestEdgeCaseRecovery:
    """Test recovery from various edge case scenarios"""
    
    def test_partial_ocr_failure_recovery(self):
        """Test recovery when one OCR method fails but another succeeds"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 200, 3), dtype=np.uint8) * 255
            cv2.putText(img, 'Energy: 250 kcal', (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.imwrite(tmp.name, img)
            
            with patch('pytesseract.image_to_string') as mock_tesseract:
                with patch('easyocr.Reader') as mock_easyocr_class:
                    # Tesseract fails
                    mock_tesseract.side_effect = Exception("Tesseract failed")
                    
                    # EasyOCR succeeds
                    mock_reader = MagicMock()
                    mock_reader.readtext.return_value = [([0, 0, 100, 30], 'Energy: 250 kcal', 0.9)]
                    mock_easyocr_class.return_value = mock_reader
                    
                    engine = LocalOCREngine(use_easyocr=True)
                    text, confidence = engine.extract_text(tmp.name, method='auto')
                    
                    # Should fallback to working method
                    assert 'Energy' in text
                    assert confidence > 0.0
            
            os.unlink(tmp.name)
    
    def test_graceful_degradation(self):
        """Test graceful degradation when all OCR methods fail"""
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img = np.ones((100, 200, 3), dtype=np.uint8) * 255
            cv2.imwrite(tmp.name, img)
            
            with patch('pytesseract.image_to_string') as mock_tesseract:
                with patch('easyocr.Reader') as mock_easyocr_class:
                    # All methods fail
                    mock_tesseract.side_effect = Exception("Tesseract failed")
                    mock_easyocr_class.side_effect = Exception("EasyOCR failed")
                    
                    result = extract_nutrients_from_image(tmp.name)
                    
                    # Should still return structured result
                    assert 'confidence' in result
                    assert 'source' in result
                    assert result['confidence'] == 0.0
            
            os.unlink(tmp.name)
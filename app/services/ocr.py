import os
import tempfile
import logging
from typing import Optional, Tuple
import cv2
import numpy as np
from PIL import Image
import pytesseract
import easyocr

logger = logging.getLogger(__name__)


class ImageProcessor:
    def __init__(self, use_easyocr: bool = False):
        self.use_easyocr = use_easyocr
        if use_easyocr:
            self.easyocr_reader = easyocr.Reader(['en'])
        else:
            self.easyocr_reader = None
    
    async def preprocess_image(self, image_path: str) -> str:
        """
        Preprocess image for better OCR results:
        - Convert to grayscale
        - Resize if too large
        - Apply denoising
        - Apply adaptive thresholding
        """
        try:
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError("Unable to load image")
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Resize if image is too large (max width 1200px)
            height, width = gray.shape
            if width > 1200:
                scale = 1200 / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                gray = cv2.resize(gray, (new_width, new_height), interpolation=cv2.INTER_AREA)
            
            # Apply denoising
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Apply adaptive thresholding
            adaptive_thresh = cv2.adaptiveThreshold(
                denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Save processed image
            processed_path = image_path.replace('.', '_processed.')
            cv2.imwrite(processed_path, adaptive_thresh)
            
            logger.info(f"Image preprocessed successfully: {processed_path}")
            return processed_path
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            return image_path  # Return original if preprocessing fails
    
    async def extract_text(self, image_path: str) -> str:
        """
        Extract text from image using OCR
        """
        try:
            processed_path = await self.preprocess_image(image_path)
            
            if self.use_easyocr and self.easyocr_reader:
                # Use EasyOCR
                results = self.easyocr_reader.readtext(processed_path)
                text = ' '.join([result[1] for result in results])
                logger.info(f"EasyOCR extracted {len(results)} text blocks")
            else:
                # Use Tesseract
                image = Image.open(processed_path)
                # Use PSM 6 (uniform block of text) for better nutrition table recognition
                custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,()%/: '
                text = pytesseract.image_to_string(image, config=custom_config)
                logger.info(f"Tesseract OCR completed, extracted {len(text)} characters")
            
            # Clean up processed image if different from original
            if processed_path != image_path:
                try:
                    os.remove(processed_path)
                except OSError:
                    pass
            
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error extracting text from image: {e}")
            return ""

    async def extract_nutrients(self, image_path: str, *, debug: bool = False) -> dict:
        """Compatibility wrapper that delegates to the enriched OCR service."""
        try:
            from app.services import nutrition_ocr
        except ImportError as exc:
            logger.error(f"Failed to import advanced nutrition OCR service: {exc}")
            return {
                'confidence': 0.0,
                'parsed_nutriments': {},
                'processing_details': {'error': 'nutrition_ocr_unavailable'}
            }

        return nutrition_ocr.extract_nutrients_from_image(image_path, debug=debug)


class NutritionParser:
    """
    Parse nutrition information from OCR text
    """
    NUTRITION_FIELDS = {
        'energy_kcal': ['energy', 'kcal', 'calories', 'cal'],
        'protein_g': ['protein', 'proteins'],
        'fat_g': ['fat', 'fats', 'total fat', 'lipid'],
        'carbs_g': ['carbohydrate', 'carbohydrates', 'carbs', 'total carbohydrate'],
        'sugars_g': ['sugar', 'sugars', 'total sugar'],
        'salt_g': ['salt', 'sodium', 'na']
    }
    
    def __init__(self):
        self.required_fields = len(self.NUTRITION_FIELDS)
    
    def parse_nutrition_text(self, text: str) -> Tuple[dict, float]:
        """
        Parse nutrition information from OCR text
        Returns: (nutrition_dict, confidence_score)
        """
        text_lower = text.lower()
        nutrition_data = {}
        serving_size = self._extract_serving_size(text_lower)
        
        for field, keywords in self.NUTRITION_FIELDS.items():
            value = self._extract_nutrition_value(text_lower, keywords)
            if value is not None:
                nutrition_data[field] = value
        
        # Calculate confidence score
        found_fields = len([v for v in nutrition_data.values() if v is not None])
        confidence = found_fields / self.required_fields
        
        logger.info(f"Nutrition parsing: {found_fields}/{self.required_fields} fields found, confidence: {confidence:.2f}")
        
        return {
            'nutrition_data': nutrition_data,
            'serving_size': serving_size,
            'confidence': confidence
        }
    
    def _extract_nutrition_value(self, text: str, keywords: list) -> Optional[float]:
        """
        Extract numerical value for a nutrition field
        """
        import re
        
        for keyword in keywords:
            # Look for patterns like "protein 10g" or "protein: 10.5g" or "protein 10.5"
            patterns = [
                rf'{keyword}[:\s]*(\d+\.?\d*)\s*g',
                rf'{keyword}[:\s]*(\d+\.?\d*)',
                rf'(\d+\.?\d*)\s*g[^\w]*{keyword}',
                rf'(\d+\.?\d*)[^\w]*{keyword}'
            ]
            
            for pattern in patterns:
                match = re.search(pattern, text)
                if match:
                    try:
                        value = float(match.group(1))
                        # Basic sanity checks
                        if 0 <= value <= 1000:  # Reasonable range for nutrition values per 100g
                            return value
                    except ValueError:
                        continue
        
        return None
    
    def _extract_serving_size(self, text: str) -> Optional[str]:
        """
        Extract serving size information
        """
        import re
        
        patterns = [
            r'serving size[:\s]*([0-9]+\.?[0-9]*\s*[a-z]+)',
            r'per\s+([0-9]+\.?[0-9]*\s*[a-z]+)',
            r'([0-9]+\.?[0-9]*\s*g)\s+serving',
            r'([0-9]+\.?[0-9]*\s*ml)\s+serving'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return None


async def call_external_ocr(image_path: str) -> Optional[str]:
    """
    Hook function for external OCR services (e.g., Google Vision API, AWS Textract, Azure OCR)
    
    This function is a stub/hook that should be implemented when integrating
    with paid OCR services or Vision Language Models (VLMs).
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Extracted text string or None if service unavailable
        
    Example implementations:
    - Google Vision API: Use google-cloud-vision client
    - AWS Textract: Use boto3 textract client  
    - Azure Computer Vision: Use azure-cognitiveservices-vision-computervision
    - OpenAI Vision API: Use openai client with vision model
    
    Usage:
        external_text = await call_external_ocr(image_path)
        if external_text:
            # Use external OCR result
            pass
        else:
            # Fallback to local OCR
            pass
    """
    logger.info(f"External OCR hook called for: {image_path}")
    logger.warning("External OCR not implemented - this is a stub function")
    
    # Placeholder for external OCR integration
    # Uncomment and implement based on chosen service:
    
    # Google Vision API example:
    # try:
    #     from google.cloud import vision
    #     client = vision.ImageAnnotatorClient()
    #     with open(image_path, 'rb') as image_file:
    #         content = image_file.read()
    #     image = vision.Image(content=content)
    #     response = client.text_detection(image=image)
    #     texts = response.text_annotations
    #     return texts[0].description if texts else None
    # except Exception as e:
    #     logger.error(f"External OCR failed: {e}")
    
    return None


ocr_service = ImageProcessor(use_easyocr=False)  # Default to Tesseract
nutrition_parser = NutritionParser()

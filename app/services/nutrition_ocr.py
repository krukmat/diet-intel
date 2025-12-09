import os
import re
import time
import logging
from typing import Dict, Any, Optional, Tuple, List
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import easyocr

logger = logging.getLogger(__name__)


class ImagePreprocessor:
    """
    Image preprocessing pipeline optimized for nutrition label OCR.
    Applies multiple enhancement techniques for better text recognition.
    """
    
    @staticmethod
    def preprocess_image(image_path: str, save_debug: bool = False) -> str:
        """
        Comprehensive image preprocessing for OCR optimization.
        
        Pipeline:
        1. Load and validate image
        2. Convert to grayscale
        3. Upscale for better resolution
        4. Enhance contrast and sharpness
        5. Apply denoising
        6. Adaptive thresholding
        7. Morphological operations
        
        Args:
            image_path: Path to input image
            save_debug: Whether to save intermediate processing steps
            
        Returns:
            Path to processed image
        """
        try:
            # Load image
            original = cv2.imread(image_path)
            if original is None:
                raise ValueError(f"Cannot load image from {image_path}")
            
            logger.debug(f"Original image shape: {original.shape}")
            
            # Step 1: Convert to grayscale
            gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
            
            # Step 2: Upscale if image is too small (min 1000px width)
            height, width = gray.shape
            if width < 1000:
                scale_factor = 1000 / width
                new_width = int(width * scale_factor)
                new_height = int(height * scale_factor)
                gray = cv2.resize(gray, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
                logger.debug(f"Upscaled image to: {gray.shape}")
            
            # Step 3: Enhance contrast using CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            
            # Step 4: Apply denoising
            denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)
            
            # Step 5: Enhance sharpness using PIL for better control
            pil_image = Image.fromarray(denoised)
            enhancer = ImageEnhance.Sharpness(pil_image)
            sharpened = enhancer.enhance(1.5)  # Increase sharpness
            
            # Convert back to opencv format
            sharpened_cv = np.array(sharpened)
            
            # Step 6: Adaptive thresholding
            # Try multiple thresholding methods and pick the best
            thresh_methods = [
                cv2.adaptiveThreshold(sharpened_cv, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2),
                cv2.adaptiveThreshold(sharpened_cv, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, 3),
            ]
            
            # Use Gaussian adaptive threshold as primary method
            thresh = thresh_methods[0]
            
            # Step 7: Morphological operations to clean up noise
            kernel = np.ones((2, 2), np.uint8)
            cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
            
            # Step 8: Final noise removal with median blur
            final = cv2.medianBlur(cleaned, 3)
            
            # Save processed image
            base_name = os.path.splitext(image_path)[0]
            processed_path = f"{base_name}_processed.png"
            cv2.imwrite(processed_path, final)
            
            # Save debug images if requested
            if save_debug:
                debug_dir = f"{base_name}_debug"
                os.makedirs(debug_dir, exist_ok=True)
                
                cv2.imwrite(f"{debug_dir}/01_gray.png", gray)
                cv2.imwrite(f"{debug_dir}/02_enhanced.png", enhanced)
                cv2.imwrite(f"{debug_dir}/03_denoised.png", denoised)
                cv2.imwrite(f"{debug_dir}/04_sharpened.png", sharpened_cv)
                cv2.imwrite(f"{debug_dir}/05_thresh.png", thresh)
                cv2.imwrite(f"{debug_dir}/06_final.png", final)
                logger.debug(f"Debug images saved to {debug_dir}")
            
            logger.info(f"Image preprocessing completed: {processed_path}")
            return processed_path
            
        except Exception as e:
            logger.error(f"Error preprocessing image {image_path}: {e}")
            return image_path  # Return original path as fallback


class NutritionTextParser:
    """
    Tolerant parser for nutrition information from OCR text.
    Handles multiple languages, formats, and common OCR errors.
    """
    
    # Multilingual keywords for nutrients
    NUTRIENT_KEYWORDS = {
        'energy_kcal': [
            # English
            r'energ[yi].*?(\d+[.,]\d+|\d+)\s*k?cal',
            r'calor[ií]es.*?(\d+[.,]\d+|\d+)',
            r'(\d+[.,]\d+|\d+)\s*k?cal',
            
            # Spanish
            r'energ[ií]a.*?(\d+[.,]\d+|\d+)\s*k?cal',
            r'calor[ií]as.*?(\d+[.,]\d+|\d+)',
        ],
        'energy_kj': [
            r'energ[yi].*?(\d+[.,]\d+|\d+)\s*kj',
            r'(\d+[.,]\d+|\d+)\s*kj',
            r'energ[ií]a.*?(\d+[.,]\d+|\d+)\s*kj',
        ],
        'protein_g': [
            # English - more specific patterns to avoid matching serving sizes
            r'protein[s]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'protein[s]?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*protein[s]?(?:\s|$)',
            
            # Spanish
            r'prote[íi]nas?.*?(\d+[.,]\d+|\d+)\s*g',
            r'prote[íi]nas?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*prote[íi]nas?(?:\s|$)',
        ],
        'fat_g': [
            # English - more specific patterns to avoid matching serving sizes
            r'fat[s]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'fat[s]?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'lipid[s]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*fat[s]?(?:\s|$)',
            
            # Spanish
            r'gras[as]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'gras[as]?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'l[íi]pidos?.*?(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*gras[as]?(?:\s|$)',
        ],
        'carbs_g': [
            # English - more specific patterns to avoid matching serving sizes
            r'carbohydrate[s]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'carbohydrate[s]?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'carbs.*?(\d+[.,]\d+|\d+)\s*g',
            r'carbs\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*carb[s]?(?:\s|$)',
            
            # Spanish
            r'carbohidrato[s]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'carbohidrato[s]?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'hidratos?.*?(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*carbohidrato[s]?(?:\s|$)',
        ],
        'sugars_g': [
            # English - more specific patterns to avoid matching serving sizes
            r'sugar[s]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'sugar[s]?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*sugar[s]?(?:\s|$)',
            
            # Spanish
            r'az[úu]car[es]?.*?(\d+[.,]\d+|\d+)\s*g',
            r'az[úu]car[es]?\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'(\d+[.,]\d+|\d+)\s*g\s*az[úu]car[es]?(?:\s|$)',
        ],
        'salt_g': [
            # English - more specific patterns to avoid matching serving sizes
            r'salt.*?(\d+[.,]\d+|\d+)\s*g',
            r'salt\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'sodium.*?(\d+[.,]\d+|\d+)\s*(?:g|mg)',
            r'(\d+[.,]\d+|\d+)\s*g\s*salt(?:\s|$)',
            
            # Spanish
            r'sal.*?(\d+[.,]\d+|\d+)\s*g',
            r'sal\s*:?\s*(\d+[.,]\d+|\d+)\s*g',
            r'sodio.*?(\d+[.,]\d+|\d+)\s*(?:g|mg)',
            r'(\d+[.,]\d+|\d+)\s*g\s*sal(?:\s|$)',
        ],
        'fiber_g': [
            # English
            r'fiber.*?(\d+[.,]\d+|\d+)\s*g',
            r'fibre.*?(\d+[.,]\d+|\d+)\s*g',
            
            # Spanish
            r'fibra.*?(\d+[.,]\d+|\d+)\s*g',
        ]
    }
    
    OUTPUT_KEY_MAP = {
        'energy_kcal': 'energy_kcal_per_100g',
        'energy_kj': 'energy_kj_per_100g',
        'protein_g': 'protein_g_per_100g',
        'fat_g': 'fat_g_per_100g',
        'carbs_g': 'carbs_g_per_100g',
        'sugars_g': 'sugars_g_per_100g',
        'salt_g': 'salt_g_per_100g',
        'fiber_g': 'fiber_g_per_100g',
    }

    def __init__(self):
        self.required_nutrients = ['energy_kcal', 'protein_g', 'fat_g', 'carbs_g']
        self.optional_nutrients = ['sugars_g', 'salt_g', 'fiber_g']
    
    def parse_nutrition_text(self, text: str) -> Dict[str, Any]:
        """
        Parse nutrition information from OCR text with tolerance for errors.
        
        Args:
            text: Raw OCR text
            
        Returns:
            Dictionary with parsed nutrients, confidence score, and metadata
        """
        # Normalize text for better parsing
        normalized_text = self._normalize_text(text)

        # Extract serving information before nutrient parsing
        serving_size = self._extract_serving_size(normalized_text)

        # Extract individual nutrients
        nutrients = {}
        extraction_details = {}

        for nutrient, patterns in self.NUTRIENT_KEYWORDS.items():
            value, confidence, matched_text = self._extract_nutrient_value(normalized_text, patterns, nutrient)
            
            if value is not None:
                # Convert units if needed
                if nutrient == 'energy_kj':
                    # Convert kJ to kcal and store as energy_kcal
                    # But only if we don't already have a direct kcal value with higher confidence
                    kcal_value = round(value / 4.184, 1)
                    existing_kcal_confidence = extraction_details.get('energy_kcal', {}).get('confidence', 0)
                    
                    if 'energy_kcal' not in nutrients or confidence > existing_kcal_confidence:
                        nutrients['energy_kcal'] = kcal_value
                        extraction_details['energy_kcal'] = {
                            'original_value': value,
                            'original_unit': 'kJ',
                            'pattern': matched_text,
                            'confidence': confidence
                        }
                        logger.debug(f"Converted {value} kJ to {kcal_value} kcal")
                    else:
                        logger.debug(f"Kept existing kcal value instead of converting {value} kJ")
                elif nutrient.endswith('_mg') and matched_text and 'sodium' in matched_text.lower():
                    # Convert sodium mg to salt g (approximate: sodium_mg * 2.5 / 1000)
                    salt_g = round(value * 2.5 / 1000, 2)
                    nutrients['salt_g'] = salt_g
                    extraction_details['salt_g'] = {
                        'original_value': value,
                        'original_unit': 'mg_sodium',
                        'pattern': matched_text,
                        'confidence': confidence
                    }
                else:
                    nutrients[nutrient] = value
                    extraction_details[nutrient] = {
                        'pattern': matched_text,
                        'confidence': confidence
                    }
        # Calculate overall confidence
        confidence_score = self._calculate_confidence(nutrients, extraction_details, normalized_text)

        # Map nutrient keys to expected output (per_100g naming)
        normalized_nutrients: Dict[str, Optional[float]] = {}
        normalized_details: Dict[str, Dict[str, Any]] = {}
        for key, value in nutrients.items():
            output_key = self.OUTPUT_KEY_MAP.get(key, key)
            normalized_nutrients[output_key] = value
            detail = extraction_details.get(key, {}).copy()
            if detail:
                detail['original_key'] = key
                normalized_details[output_key] = detail

        missing_required = []
        for required in self.required_nutrients:
            output_key = self.OUTPUT_KEY_MAP.get(required, required)
            if output_key not in normalized_nutrients:
                missing_required.append(output_key)

        if serving_size:
            parts = serving_size.split()
            unit = parts[1] if len(parts) > 1 else None
        else:
            unit = None
        serving_info = {
            'detected': serving_size,
            'unit': unit,
        }

        result = {
            'raw_text': text,
            'normalized_text': normalized_text,
            'parsed_nutriments': nutrients,
            'nutrition_data': normalized_nutrients,
            'nutrients': normalized_nutrients,
            'confidence': confidence_score,
            'serving_size': serving_size,
            'serving_info': serving_info,
            'extraction_details': extraction_details,
            'normalized_extraction_details': normalized_details,
            'found_nutrients': list(normalized_nutrients.keys()),
            'missing_required': missing_required,
        }

        logger.info(f"Parsed {len(nutrients)} nutrients with confidence {confidence_score:.2f}")
        logger.debug(f"Found: {list(normalized_nutrients.keys())}")

        return result
    
    def _normalize_text(self, text: str) -> str:
        """
        Normalize OCR text to improve parsing accuracy.
        """
        if not text:
            return ""
        
        # Convert to lowercase for pattern matching
        normalized = text.lower()
        
        # Fix common OCR errors
        ocr_fixes = {
            # Number/letter confusion
            'o': '0',  # letter O to zero
            'i': '1',  # letter I to one
            'l': '1',  # letter l to one
            's': '5',  # letter s to five (in numbers)
            
            # Unit fixes
            ' cal ': ' kcal ',
            ' cals': ' kcal',
            'kj ': 'kj ',
            
            # Language fixes
            'proteína': 'proteina',
            'energía': 'energia',
            'azúcar': 'azucar',
        }
        
        # Apply fixes carefully (only in likely number contexts)
        for old, new in ocr_fixes.items():
            if old in ['o', 'i', 'l', 's']:
                # Replace if surrounded by digits OR at end of number followed by space/unit
                normalized = re.sub(rf'(\d){old}(\d)', rf'\g<1>{new}\g<2>', normalized)  # Between digits
                normalized = re.sub(rf'(\d){old}(\s|$|\w)', rf'\g<1>{new}\g<2>', normalized)  # At end of number
            else:
                normalized = normalized.replace(old, new)
        
        # Normalize punctuation
        normalized = re.sub(r'[,.](\d)', r'.\1', normalized)  # Normalize decimal separators
        normalized = re.sub(r'\s+', ' ', normalized)  # Normalize whitespace

        return normalized.strip()

    def _extract_serving_size(self, text: str) -> Optional[str]:
        """Extract serving size declarations (e.g., "Serving Size: 100g", "Per 250 ml")."""
        if not text:
            return None

        # Common units across English and Spanish labels
        unit_pattern = r"(?:g|gramos?|grams?|ml|mililitros?|oz|ounces?|servings?|porciones?)"
        number_pattern = r"\d+(?:\.\d+)?"

        patterns = [
            rf"serving\s+size[:\s]*({number_pattern}\s*{unit_pattern})",
            rf"porci[oó]n[:\s]*({number_pattern}\s*{unit_pattern})",
            rf"per\s+({number_pattern}\s*{unit_pattern})",
            rf"por\s+({number_pattern}\s*{unit_pattern})",
            rf"({number_pattern}\s*{unit_pattern})\s+per\s+serving",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip()

        # Capture plain "100g" mentions near nutrition headers as a fallback
        fallback_match = re.search(r"(\d+(?:\.\d+)?\s*(?:g|ml))", text)
        if fallback_match:
            return fallback_match.group(1).strip()

        return None
    
    def _extract_nutrient_value(self, text: str, patterns: List[str], nutrient_name: str) -> Tuple[Optional[float], float, str]:
        """
        Extract a single nutrient value using multiple patterns.
        
        Returns:
            Tuple of (value, confidence, matched_text)
        """
        best_value = None
        best_confidence = 0.0
        best_match_text = ""
        best_pattern = ""

        for pattern in patterns:
            try:
                matches = re.finditer(pattern, text, re.IGNORECASE)

                for match in matches:
                    # Extract numeric value
                    value_str = match.group(1)
                    matched_text = match.group(0)
                    
                    try:
                        # Handle decimal separators
                        value_str = value_str.replace(',', '.')
                        value = float(value_str)
                        
                        # Sanity check values
                        if not self._is_reasonable_value(value, nutrient_name):
                            continue
                        
                        # Calculate confidence based on pattern specificity and context
                        confidence = self._calculate_pattern_confidence(match, pattern, text)

                        if confidence > best_confidence:
                            best_value = value
                            best_confidence = confidence
                            best_match_text = matched_text
                            best_pattern = pattern
                            
                    except ValueError:
                        continue
                        
            except re.error as e:
                logger.warning(f"Invalid regex pattern '{pattern}': {e}")
                continue
        
        return best_value, best_confidence, best_match_text
    
    def _is_reasonable_value(self, value: float, nutrient_name: str) -> bool:
        """
        Check if extracted value is within reasonable ranges.
        """
        ranges = {
            'energy_kcal': (1, 1000),   # kcal per 100g (exclude 0)
            'energy_kj': (0, 4200),     # kJ per 100g
            'protein_g': (0, 100),      # g per 100g
            'fat_g': (0, 100),          # g per 100g
            'carbs_g': (0, 100),        # g per 100g
            'sugars_g': (0, 100),       # g per 100g
            'salt_g': (0, 50),          # g per 100g
            'fiber_g': (0, 50),         # g per 100g
        }
        
        min_val, max_val = ranges.get(nutrient_name, (0, 1000))
        return min_val <= value <= max_val
    
    def _calculate_pattern_confidence(self, match: re.Match, pattern: str, text: str) -> float:
        """
        Calculate confidence score for a pattern match.
        """
        confidence = 0.5  # Base confidence
        
        matched_text = match.group(0)
        
        # Boost confidence for explicit units
        if 'kcal' in matched_text or 'kj' in matched_text:
            confidence += 0.2
        if ' g ' in matched_text or matched_text.endswith('g'):
            confidence += 0.1
        
        # Boost for nutrition-specific context
        nutrition_indicators = ['per 100', 'nutrition', 'facts', 'información nutricional', 'valores nutricionales']
        for indicator in nutrition_indicators:
            if indicator in text:
                confidence += 0.1
                break
        
        # Penalty for very short matches (likely false positives)
        if len(matched_text) < 5:
            confidence -= 0.1
        
        # Boost for complete nutrient-value patterns
        if re.search(r'\w+\s*:?\s*\d+', matched_text):
            confidence += 0.1
        
        return min(1.0, max(0.0, confidence))
    
    def _calculate_confidence(self, nutrients: Dict[str, float], 
                            extraction_details: Dict[str, Dict], 
                            text: str) -> float:
        """
        Calculate overall confidence score for the extraction.
        """
        if not nutrients:
            return 0.0
        
        # Normalize keys so both raw and per_100g identifiers count
        inverse_key_map = {v: k for k, v in self.OUTPUT_KEY_MAP.items()}
        normalized_keys = set()
        for key in nutrients.keys():
            normalized_keys.add(inverse_key_map.get(key, key))

        # Base score from found nutrients
        required_found = len([n for n in self.required_nutrients if n in normalized_keys])
        total_found = len(normalized_keys)
        
        # Score based on completeness
        completeness_score = required_found / len(self.required_nutrients)
        bonus_score = min(0.2, total_found * 0.05)  # Bonus for additional nutrients
        
        # Average pattern confidence
        if isinstance(extraction_details, dict):
            pattern_confidences = [details.get('confidence', 0.5) for details in extraction_details.values()]
        else:
            pattern_confidences = []
        avg_pattern_confidence = sum(pattern_confidences) / len(pattern_confidences) if pattern_confidences else 0.5
        
        # Text quality indicators
        text_quality = 0.5
        
        # Look for structure indicators
        if any(indicator in text.lower() for indicator in ['nutrition facts', 'per 100', 'información nutricional']):
            text_quality += 0.2
        
        # Penalty for very short text (likely poor OCR)
        if len(text.strip()) < 50:
            text_quality -= 0.2
        
        # Final confidence (weighted average)
        final_confidence = (
            completeness_score * 0.4 +  # 40% based on required nutrients found
            avg_pattern_confidence * 0.3 +  # 30% based on pattern confidence
            text_quality * 0.2 +  # 20% based on text quality
            bonus_score  # 10% bonus for additional nutrients
        )
        
        return round(min(1.0, max(0.0, final_confidence)), 2)


class LocalOCREngine:
    """
    Local OCR engine using both Tesseract and EasyOCR for multilingual support.
    """
    
    def __init__(self, use_easyocr: bool = True):
        self.use_easyocr = use_easyocr
        
        if use_easyocr:
            try:
                self.easyocr_reader = easyocr.Reader(['en', 'es'], gpu=False)
                logger.info("EasyOCR initialized with English and Spanish support")
            except Exception as e:
                logger.warning(f"EasyOCR initialization failed: {e}, falling back to Tesseract only")
                self.easyocr_reader = None
        else:
            self.easyocr_reader = None
    
    def extract_text(self, image_path: str, method: str = 'auto') -> Tuple[str, float]:
        """
        Extract text from image using specified OCR method.
        
        Args:
            image_path: Path to image
            method: 'tesseract', 'easyocr', or 'auto'
            
        Returns:
            Tuple of (extracted_text, confidence)
        """
        if method == 'auto':
            # Try both methods and return the best result
            results = []
            
            # Try Tesseract
            try:
                tesseract_text, tesseract_conf = self._extract_with_tesseract(image_path)
                results.append(('tesseract', tesseract_text, tesseract_conf))
            except Exception as e:
                logger.warning(f"Tesseract failed: {e}")
            
            # Try EasyOCR if available
            if self.easyocr_reader:
                try:
                    easyocr_text, easyocr_conf = self._extract_with_easyocr(image_path)
                    results.append(('easyocr', easyocr_text, easyocr_conf))
                except Exception as e:
                    logger.warning(f"EasyOCR failed: {e}")
            
            if not results:
                return "", 0.0
            
            # Return result with highest confidence
            best_method, best_text, best_conf = max(results, key=lambda x: x[2])
            logger.info(f"Best OCR result from {best_method} (confidence: {best_conf:.2f})")
            return best_text, best_conf
        
        elif method == 'tesseract':
            return self._extract_with_tesseract(image_path)
        
        elif method == 'easyocr':
            if not self.easyocr_reader:
                raise ValueError("EasyOCR not available")
            return self._extract_with_easyocr(image_path)
        
        else:
            raise ValueError(f"Unknown OCR method: {method}")
    
    def _extract_with_tesseract(self, image_path: str) -> Tuple[str, float]:
        """Extract text using Tesseract OCR."""
        try:
            # Multiple configurations for different text layouts
            configs = [
                '--oem 3 --psm 6',  # Uniform block of text
                '--oem 3 --psm 4',  # Single column of text
                '--oem 3 --psm 1',  # Automatic page segmentation with OSD
            ]
            
            best_text = ""
            best_confidence = 0.0
            
            for config in configs:
                try:
                    # Extract text
                    text = pytesseract.image_to_string(image_path, config=config, lang='eng+spa')
                    
                    # Get confidence data
                    data = pytesseract.image_to_data(image_path, config=config, lang='eng+spa', output_type=pytesseract.Output.DICT)
                    
                    # Calculate average confidence
                    confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
                    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                    confidence = avg_confidence / 100.0  # Convert to 0-1 scale
                    
                    # Prefer longer text with reasonable confidence
                    score = len(text.strip()) * confidence
                    if score > len(best_text.strip()) * best_confidence:
                        best_text = text
                        best_confidence = confidence

                    # Stop early if we extracted meaningful text with confidence
                    if best_text.strip() and best_confidence > 0:
                        break

                except Exception as e:
                    logger.debug(f"Tesseract config '{config}' failed: {e}")
                    continue
            
            logger.debug(f"Tesseract extracted {len(best_text)} characters with confidence {best_confidence:.2f}")
            return best_text, best_confidence
            
        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            return "", 0.0
    
    def _extract_with_easyocr(self, image_path: str) -> Tuple[str, float]:
        """Extract text using EasyOCR."""
        try:
            results = self.easyocr_reader.readtext(image_path)
            
            if not results:
                return "", 0.0
            
            # Combine text results and calculate average confidence
            text_parts = []
            confidences = []
            
            for (bbox, text, confidence) in results:
                text_parts.append(text)
                confidences.append(confidence)
            
            combined_text = ' '.join(text_parts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            logger.debug(f"EasyOCR extracted {len(combined_text)} characters with confidence {avg_confidence:.2f}")
            return combined_text, avg_confidence
            
        except Exception as e:
            logger.error(f"EasyOCR extraction failed: {e}")
            return "", 0.0


# Main service functions

def extract_nutrients_from_image(image_path: str, debug: bool = False) -> Dict[str, Any]:
    """
    Extract nutrition information from image using local OCR.

    Args:
        image_path: Path to nutrition label image
        debug: Whether to return detailed timing/debug information

    Returns:
        Structured dictionary containing nutrition data, confidence, and metadata.
    """
    start_time = time.perf_counter()
    
    try:
        logger.info(f"Starting nutrition extraction from: {image_path}")
        
        # Step 1: Preprocess image
        preprocessor = ImagePreprocessor()
        preprocess_start = time.perf_counter()
        processed_image_path = preprocessor.preprocess_image(image_path, save_debug=debug)
        preprocess_duration = time.perf_counter() - preprocess_start

        # Step 2: Extract text using OCR
        ocr_engine = LocalOCREngine(use_easyocr=True)
        ocr_start = time.perf_counter()
        raw_text, ocr_confidence = ocr_engine.extract_text(processed_image_path, method='auto')
        ocr_duration = time.perf_counter() - ocr_start
        
        if not raw_text.strip():
            logger.warning("No text extracted from image")
            return {
                'source': 'Local OCR',
                'raw_text': '',
                'nutrients': {},
                'nutrition_data': {},
                'parsed_nutriments': {},
                'confidence': 0.0,
                'serving_size': None,
                'serving_info': {'detected': None},
                'processing_details': {
                    'ocr_confidence': 0.0,
                    'parsing_confidence': 0.0,
                    'error': 'No text extracted'
                },
                'error': 'No text extracted'
            }
        
        # Step 3: Parse nutrition information
        parser = NutritionTextParser()
        parse_start = time.perf_counter()
        parse_result = parser.parse_nutrition_text(raw_text)
        parse_duration = time.perf_counter() - parse_start
        
        # Step 4: Combine confidences
        final_confidence = (ocr_confidence * 0.4 + parse_result['confidence'] * 0.6)
        
        # Clean up processed image unless debugging
        if not debug and processed_image_path != image_path:
            try:
                os.remove(processed_image_path)
            except OSError:
                pass
        
        total_duration = time.perf_counter() - start_time

        nutrients = parse_result['nutrition_data']
        processing_details = {
            'ocr_confidence': round(ocr_confidence, 2),
            'parsing_confidence': parse_result['confidence'],
            'found_nutrients': parse_result['found_nutrients'],
            'missing_required': parse_result['missing_required'],
            'processing_time_seconds': round(total_duration, 2),
            'processed_image_path': processed_image_path if debug else None,
            'ocr_engine': 'auto'
        }

        result = {
            'source': 'Local OCR',
            'raw_text': raw_text,
            'normalized_text': parse_result['normalized_text'],
            'nutrients': nutrients,
            'nutrition_data': nutrients,
            'parsed_nutriments': parse_result['parsed_nutriments'],
            'confidence': round(final_confidence, 2),
            'serving_size': parse_result.get('serving_size'),
            'serving_info': parse_result.get('serving_info'),
            'extraction_details': parse_result['extraction_details'],
            'found_nutrients': parse_result['found_nutrients'],
            'missing_required': parse_result['missing_required'],
            'processing_details': processing_details,
        }

        if debug:
            result['debug_info'] = {
                'total_time': round(total_duration, 4),
                'preprocessing_time': round(preprocess_duration, 4),
                'ocr_time': round(ocr_duration, 4),
                'parsing_time': round(parse_duration, 4),
                'processed_image_path': processed_image_path,
            }

        logger.info(f"Extraction completed: {len(result['parsed_nutriments'])} nutrients found, "
                   f"confidence: {result['confidence']:.2f}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error extracting nutrients from {image_path}: {e}")
        return {
            'source': 'Local OCR',
            'raw_text': '',
            'nutrients': {},
            'nutrition_data': {},
            'parsed_nutriments': {},
            'confidence': 0.0,
            'serving_size': None,
            'serving_info': {'detected': None, 'unit': None},
            'processing_details': {
                'error': str(e)
            },
            'error': str(e)
        }


def call_external_ocr(image_path: str, provider: str = 'mock') -> Dict[str, Any]:
    """
    Call external OCR service for enhanced nutrition extraction.
    
    This function provides a stub for external OCR services with high accuracy.
    Currently returns mock data for testing, but includes detailed implementation
    guides for various providers.
    
    Args:
        image_path: Path to nutrition label image  
        provider: OCR provider ('mock', 'mindee', 'gpt4o', 'azure', 'google')
        
    Returns:
        Dict with same structure as extract_nutrients_from_image but typically
        higher confidence and accuracy.
        
    Implementation Guide:
    
    1. MINDEE OCR API:
    ```python
    # Install: pip install mindee
    from mindee import Client, PredictResponse, product
    
    mindee_client = Client(api_key="your-api-key")
    
    with open(image_path, "rb") as image_file:
        input_doc = mindee_client.source_from_file(image_file)
        result: PredictResponse = mindee_client.parse(
            product.NutritionFactsLabelV1, input_doc
        )
    
    # Extract nutrients from result.document.inference.prediction
    nutrients = {}
    for nutrient in result.document.inference.prediction.nutrients:
        if nutrient.name == "energy":
            nutrients['energy_kcal'] = nutrient.per_100g
        elif nutrient.name == "protein":
            nutrients['protein_g'] = nutrient.per_100g
        # ... etc
        
    return {
        'raw_text': result.document.inference.prediction.raw_text or "",
        'parsed_nutriments': nutrients,
        'confidence': 0.95,  # Mindee typically very accurate
        'processing_details': {'provider': 'mindee'}
    }
    ```
    
    2. GPT-4o Vision API:
    ```python
    # Install: pip install openai
    import openai
    import base64
    
    client = openai.OpenAI(api_key="your-api-key")
    
    # Encode image
    with open(image_path, "rb") as image_file:
        image_data = base64.b64encode(image_file.read()).decode()
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user", 
                "content": [
                    {
                        "type": "text",
                        "text": '''Extract nutrition information from this label. 
                        Return JSON with: energy_kcal, protein_g, fat_g, carbs_g, sugars_g, salt_g per 100g.
                        If values are per serving, convert to per 100g if serving size is given.'''
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}"
                        }
                    }
                ]
            }
        ],
        max_tokens=500
    )
    
    # Parse JSON response
    import json
    nutrients = json.loads(response.choices[0].message.content)
    
    return {
        'raw_text': "Extracted by GPT-4o Vision",
        'parsed_nutriments': nutrients,
        'confidence': 0.90,  # GPT-4o very good at understanding context
        'processing_details': {'provider': 'gpt4o'}
    }
    ```
    
    3. Azure Computer Vision:
    ```python
    # Install: pip install azure-cognitiveservices-vision-computervision
    from azure.cognitiveservices.vision.computervision import ComputerVisionClient
    from azure.cognitiveservices.vision.computervision.models import OperationStatusCodes
    from msrest.authentication import CognitiveServicesCredentials
    
    cv_client = ComputerVisionClient(
        "your-endpoint", 
        CognitiveServicesCredentials("your-key")
    )
    
    with open(image_path, "rb") as image_stream:
        read_response = cv_client.read_in_stream(image_stream, raw=True)
    
    # Get operation ID and poll for results
    operation_id = read_response.headers["Operation-Location"].split("/")[-1]
    
    while True:
        read_result = cv_client.get_read_result(operation_id)
        if read_result.status not in [OperationStatusCodes.not_started, OperationStatusCodes.running]:
            break
        time.sleep(1)
    
    # Extract text
    text_lines = []
    if read_result.status == OperationStatusCodes.succeeded:
        for page in read_result.analyze_result.read_results:
            for line in page.lines:
                text_lines.append(line.text)
    
    full_text = " ".join(text_lines)
    
    # Parse with your nutrition parser
    parser = NutritionTextParser()
    parse_result = parser.parse_nutrition_text(full_text)
    
    return {
        'raw_text': full_text,
        'parsed_nutriments': parse_result['parsed_nutriments'],
        'confidence': min(0.85, parse_result['confidence'] + 0.1),  # Azure OCR boost
        'processing_details': {'provider': 'azure'}
    }
    ```
    """
    
    logger.info(f"External OCR called for {image_path} using provider: {provider}")
    
    if provider == 'mock':
        # High-confidence mock data for testing
        nutrients = {
            'energy_kcal_per_100g': 350.0,
            'protein_g_per_100g': 12.5,
            'fat_g_per_100g': 8.2,
            'carbs_g_per_100g': 65.3,
            'sugars_g_per_100g': 15.2,
            'salt_g_per_100g': 1.1,
            'fiber_g_per_100g': 4.2,
        }
        return {
            'source': 'External OCR (Mock)',
            'raw_text': '''NUTRITION FACTS
            Serving Size: 100g
            
            Energy: 350 kcal
            Protein: 12.5g
            Fat: 8.2g
            Carbohydrates: 65.3g
            Sugars: 15.2g
            Salt: 1.1g
            Fiber: 4.2g''',
            
            'nutrients': nutrients,
            'nutrition_data': nutrients,
            'parsed_nutriments': {
                'energy_kcal': 350.0,
                'protein_g': 12.5,
                'fat_g': 8.2,
                'carbs_g': 65.3,
                'sugars_g': 15.2,
                'salt_g': 1.1,
                'fiber_g': 4.2
            },
            'confidence': 0.95,
            
            'processing_details': {
                'provider': 'mock',
                'note': 'This is mock data for testing. Implement real provider integration above.',
                'found_nutrients': ['energy_kcal', 'protein_g', 'fat_g', 'carbs_g', 'sugars_g', 'salt_g', 'fiber_g'],
                'missing_required': []
            },
            'serving_size': '100g',
            'serving_info': {'detected': '100g', 'unit': 'g'},
        }
    
    else:
        logger.warning(f"External OCR provider '{provider}' not implemented yet")
        return {
            'source': f'External OCR ({provider})',
            'raw_text': '',
            'nutrients': {},
            'nutrition_data': {},
            'parsed_nutriments': {},
            'confidence': 0.0,
            'serving_size': None,
            'serving_info': {'detected': None, 'unit': None},
            'processing_details': {
                'error': f"Unsupported provider '{provider}' not implemented",
                'available_providers': ['mock'],
                'implementation_guide': 'See function docstring for implementation examples'
            },
            'error': f"Unsupported provider '{provider}'"
        }

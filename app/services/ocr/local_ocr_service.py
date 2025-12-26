"""
Local OCR Service using Tesseract
Wraps existing nutrition_ocr module
"""
import logging
from typing import Optional
from app.services.ocr.ocr_service import OCRService, OCRResult
from app.services import nutrition_ocr

logger = logging.getLogger(__name__)


class LocalOCRService(OCRService):
    """OCR service using local Tesseract engine"""

    def __init__(self, debug: bool = False):
        """
        Initialize LocalOCRService

        Args:
            debug: Enable debug logging
        """
        self.debug = debug
        self.logger = logging.getLogger(self.__class__.__name__)

    async def extract_nutrients(self, image_path: str) -> Optional[OCRResult]:
        """
        Extract nutrients from image using local Tesseract

        Args:
            image_path: Path to image file

        Returns:
            OCRResult if successful, None if failed
        """
        try:
            # Call existing nutrition_ocr module
            result = await nutrition_ocr.extract_nutrients_from_image(
                image_path,
                debug=self.debug
            )

            if not result:
                self.logger.debug(f"No nutrition data extracted from {image_path}")
                return None

            # Standardize result to OCRResult format
            return OCRResult(
                raw_text=result.get('raw_text', ''),
                parsed_nutriments=result.get('parsed_nutriments', {}),
                confidence=result.get('confidence', 0.0),
                serving_info=result.get('serving_info', {}),
                processing_details={
                    'ocr_engine': 'tesseract_local',
                    **result.get('processing_details', {})
                },
                found_nutrients=result.get('found_nutrients', []),
                missing_required=result.get('missing_required', [])
            )

        except Exception as e:
            self.logger.error(f"Local OCR extraction failed for {image_path}: {e}")
            return None

    def get_engine_name(self) -> str:
        """Return engine identifier"""
        return "tesseract_local"

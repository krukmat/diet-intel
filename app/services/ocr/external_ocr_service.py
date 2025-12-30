"""
External OCR Service
Integrates with third-party OCR providers (Google Vision, AWS Textract, etc.)
"""
import logging
from typing import Optional
from app.services.ocr.ocr_service import OCRService, OCRResult
from app.services.nutrition_ocr import call_external_ocr

logger = logging.getLogger(__name__)


class ExternalOCRService(OCRService):
    """OCR service using external paid APIs"""

    def __init__(self, api_key: Optional[str] = None, provider: str = "google"):
        """
        Initialize ExternalOCRService

        Args:
            api_key: API key for the external service
            provider: Provider name (google, aws, azure, etc.)
        """
        self.api_key = api_key
        self.provider = provider
        self.logger = logging.getLogger(self.__class__.__name__)

    async def extract_nutrients(self, image_path: str) -> Optional[OCRResult]:
        """
        Extract nutrients from image using external OCR API

        Args:
            image_path: Path to image file

        Returns:
            OCRResult if successful, None if failed
        """
        try:
            # Call external OCR service
            result = await call_external_ocr(
                image_path,
                api_key=self.api_key,
                provider=self.provider
            )

            if not result:
                self.logger.debug(
                    f"External OCR ({self.provider}) returned no data for {image_path}"
                )
                return None

            # Standardize result to OCRResult format
            return OCRResult(
                raw_text=result.get('raw_text', ''),
                parsed_nutriments=result.get('parsed_nutriments', {}),
                confidence=result.get('confidence', 0.0),
                serving_info=result.get('serving_info', {}),
                processing_details={
                    'ocr_engine': f'external_{self.provider}',
                    **result.get('processing_details', {})
                },
                found_nutrients=result.get('found_nutrients', []),
                missing_required=result.get('missing_required', [])
            )

        except Exception as e:
            self.logger.error(
                f"External OCR ({self.provider}) extraction failed for {image_path}: {e}"
            )
            return None

    def get_engine_name(self) -> str:
        """Return engine identifier"""
        return f"external_{self.provider}"

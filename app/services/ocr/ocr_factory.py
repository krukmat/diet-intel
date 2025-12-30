"""
OCR Service Factory
Creates appropriate OCR service instances based on configuration
"""
from typing import Optional
from app.services.ocr.ocr_service import OCRService
from app.services.ocr.local_ocr_service import LocalOCRService
from app.services.ocr.external_ocr_service import ExternalOCRService
from app.config import config


class OCRFactory:
    """Factory for creating OCR service instances"""

    @staticmethod
    def create_local(debug: bool = False) -> OCRService:
        """
        Create local Tesseract OCR service

        Args:
            debug: Enable debug logging

        Returns:
            LocalOCRService instance
        """
        return LocalOCRService(debug=debug)

    @staticmethod
    def create_external(
        provider: str = "google",
        api_key: Optional[str] = None
    ) -> OCRService:
        """
        Create external OCR service

        Args:
            provider: OCR provider (google, aws, azure, etc.)
            api_key: API key for the service (uses config if not provided)

        Returns:
            ExternalOCRService instance
        """
        api_key = api_key or getattr(config, 'EXTERNAL_OCR_API_KEY', None)
        return ExternalOCRService(api_key=api_key, provider=provider)

    @staticmethod
    def create_default() -> OCRService:
        """
        Create default OCR service based on configuration

        Returns:
            OCRService instance (Local or External based on config)
        """
        use_external = getattr(config, 'USE_EXTERNAL_OCR', False)
        if use_external:
            return OCRFactory.create_external()
        return OCRFactory.create_local()

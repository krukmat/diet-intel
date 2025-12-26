"""
OCR Services Module
Provides unified interface for OCR operations with multiple backends
"""
from app.services.ocr.ocr_service import OCRService, OCRResult
from app.services.ocr.local_ocr_service import LocalOCRService
from app.services.ocr.external_ocr_service import ExternalOCRService
from app.services.ocr.ocr_factory import OCRFactory

__all__ = [
    'OCRService',
    'OCRResult',
    'LocalOCRService',
    'ExternalOCRService',
    'OCRFactory',
]

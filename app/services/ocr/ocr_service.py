"""
Base OCR Service Interface
Provides standardized interface for different OCR implementations
"""
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class OCRResult:
    """Standardized OCR result across all implementations"""
    raw_text: str
    parsed_nutriments: Dict[str, Any]
    confidence: float
    serving_info: Dict[str, Any]
    processing_details: Dict[str, Any]
    found_nutrients: list
    missing_required: list

    def is_high_confidence(self, threshold: float = 0.7) -> bool:
        """Check if confidence meets threshold"""
        return self.confidence >= threshold


class OCRService(ABC):
    """Abstract base class for OCR services"""

    @abstractmethod
    async def extract_nutrients(self, image_path: str) -> Optional[OCRResult]:
        """
        Extract nutritional information from image

        Args:
            image_path: Path to image file

        Returns:
            OCRResult if successful, None if failed
        """
        pass

    @abstractmethod
    def get_engine_name(self) -> str:
        """Return engine identifier for logging/tracking"""
        pass

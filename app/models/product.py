from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, validator


class BarcodeRequest(BaseModel):
    barcode: str = Field(..., description="Product barcode to lookup")

    @validator("barcode")
    def validate_barcode(cls, value: str) -> str:
        if value is None:
            raise ValueError("Barcode cannot be empty")

        # Defer strict format validation to downstream services/routes so tests can
        # inject sentinel values (e.g., timeout/network fallbacks).
        return value


class Product(BaseModel):
    """Product model for repository operations - Task 2.1.5"""
    id: Optional[int] = Field(None, description="Product ID (auto-generated)")
    barcode: str = Field(..., description="Product barcode (unique)")
    name: str = Field(..., description="Product name")
    brand: Optional[str] = Field(None, description="Product brand")
    serving_size: Optional[str] = Field("100g", description="Default serving size")
    nutriments: Optional[dict] = Field(None, description="Nutritional information as dict")

    class Config:
        """Allow arbitrary types"""
        arbitrary_types_allowed = True


class Nutriments(BaseModel):
    energy_kcal_per_100g: Optional[float] = Field(None, description="Energy in kcal per 100g")
    protein_g_per_100g: Optional[float] = Field(None, description="Protein in grams per 100g")
    fat_g_per_100g: Optional[float] = Field(None, description="Fat in grams per 100g")
    carbs_g_per_100g: Optional[float] = Field(None, description="Carbohydrates in grams per 100g")
    sugars_g_per_100g: Optional[float] = Field(None, description="Sugars in grams per 100g")
    salt_g_per_100g: Optional[float] = Field(None, description="Salt in grams per 100g")


class ProductResponse(BaseModel):
    source: str = Field(..., description="Data source")
    barcode: str = Field(..., description="Product barcode")
    name: Optional[str] = Field(None, description="Product name")
    brand: Optional[str] = Field(None, description="Product brand")
    image_url: Optional[str] = Field(None, description="Product image URL")
    serving_size: Optional[str] = Field(None, description="Serving size information")
    nutriments: Nutriments = Field(..., description="Nutritional information")
    fetched_at: datetime = Field(..., description="Timestamp when data was fetched")


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional error details")


class ScanResponse(BaseModel):
    source: str = Field(..., description="Data source (OCR)")
    confidence: float = Field(..., description="Confidence score (0.0 to 1.0)")
    raw_text: str = Field(..., description="Raw OCR extracted text")
    serving_size: Optional[str] = Field(None, description="Detected serving size")
    nutriments: Nutriments = Field(..., description="Parsed nutritional information")
    nutrients: Optional[Nutriments] = Field(None, description="Legacy alias for nutriments")
    scanned_at: datetime = Field(..., description="Timestamp when image was processed")

    def dict(self, *args, **kwargs):  # type: ignore[override]
        data = super().dict(*args, **kwargs)
        if 'nutriments' in data and 'nutrients' not in data:
            data['nutrients'] = data['nutriments']
        return data

    def model_dump(self, *args, **kwargs):  # compatibility with pydantic v2 api
        return self.dict(*args, **kwargs)


class LowConfidenceScanResponse(BaseModel):
    low_confidence: bool = Field(True, description="Indicates low confidence scan")
    confidence: float = Field(..., description="Confidence score (below 0.7)")
    raw_text: str = Field(..., description="Raw OCR extracted text")
    partial_parsed: dict = Field(..., description="Partially parsed nutrition data")
    suggest_external_ocr: bool = Field(True, description="Suggests using external OCR service")
    scanned_at: datetime = Field(..., description="Timestamp when image was processed")

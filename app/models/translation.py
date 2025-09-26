"""
Pydantic models for translation API requests and responses.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, validator


class TranslationRequest(BaseModel):
    """Request model for single text translation."""
    
    text: str = Field(..., min_length=1, max_length=500, description="Text to translate")
    source_lang: str = Field(default="en", description="Source language code")
    target_lang: str = Field(..., description="Target language code")
    
    @validator('text')
    def validate_text(cls, v):
        if not v or not v.strip():
            raise ValueError("Text cannot be empty")
        return v.strip()
    
    @validator('source_lang', 'target_lang')
    def validate_language_codes(cls, v):
        if not v or len(v) != 2:
            raise ValueError("Language code must be exactly 2 characters")
        return v.lower()


class FoodTranslationRequest(TranslationRequest):
    """Request model for food name translation."""
    
    text: str = Field(..., min_length=1, max_length=200, description="Food name to translate")


class BatchTranslationRequest(BaseModel):
    """Request model for batch translation of multiple texts."""
    
    texts: List[str] = Field(..., min_items=1, max_items=50, description="List of texts to translate")
    source_lang: str = Field(default="en", description="Source language code")
    target_lang: str = Field(..., description="Target language code")
    
    @validator('texts')
    def validate_texts(cls, v):
        if not v:
            raise ValueError("Texts list cannot be empty")
        
        # Filter out empty texts
        filtered_texts = [text.strip() for text in v if text and text.strip()]
        
        if not filtered_texts:
            raise ValueError("No valid texts provided")
        
        if len(filtered_texts) > 50:
            raise ValueError("Maximum 50 texts allowed per batch")
        
        return filtered_texts
    
    @validator('source_lang', 'target_lang')
    def validate_language_codes(cls, v):
        if not v or len(v) != 2:
            raise ValueError("Language code must be exactly 2 characters")
        return v.lower()


class BatchFoodTranslationRequest(BaseModel):
    """Request model for batch food name translation."""
    
    food_names: List[str] = Field(..., min_items=1, max_items=50, description="List of food names to translate")
    source_lang: str = Field(default="en", description="Source language code")
    target_lang: str = Field(..., description="Target language code")
    
    @validator('food_names')
    def validate_food_names(cls, v):
        if not v:
            raise ValueError("Food names list cannot be empty")
        
        # Filter out empty food names
        filtered_names = [name.strip() for name in v if name and name.strip()]
        
        if not filtered_names:
            raise ValueError("No valid food names provided")
        
        if len(filtered_names) > 50:
            raise ValueError("Maximum 50 food names allowed per batch")
        
        return filtered_names
    
    @validator('source_lang', 'target_lang')
    def validate_language_codes(cls, v):
        if not v or len(v) != 2:
            raise ValueError("Language code must be exactly 2 characters")
        return v.lower()


class TranslationResponse(BaseModel):
    """Response model for single text translation."""
    
    original_text: str = Field(..., description="Original text that was translated")
    translated_text: Optional[str] = Field(None, description="Translated text")
    source_lang: str = Field(..., description="Source language code")
    target_lang: str = Field(..., description="Target language code")
    success: bool = Field(..., description="Whether translation was successful")
    cached: bool = Field(default=False, description="Whether result was retrieved from cache")
    error_message: Optional[str] = Field(None, description="Error message if translation failed")


class BatchTranslationResponse(BaseModel):
    """Response model for batch translation."""
    
    translations: Dict[str, Optional[str]] = Field(..., description="Mapping of original to translated texts")
    source_lang: str = Field(..., description="Source language code")
    target_lang: str = Field(..., description="Target language code")
    total_count: int = Field(..., description="Total number of texts processed")
    successful_count: int = Field(..., description="Number of successful translations")
    failed_count: int = Field(..., description="Number of failed translations")
    cached_count: int = Field(default=0, description="Number of results retrieved from cache")


class SupportedLanguagesResponse(BaseModel):
    """Response model for supported languages."""
    
    languages: Dict[str, str] = Field(..., description="Mapping of language codes to language names")
    count: int = Field(..., description="Total number of supported languages")


class TranslationHealthResponse(BaseModel):
    """Response model for translation service health check."""
    
    status: str = Field(..., description="Service status")
    supported_languages_count: int = Field(..., description="Number of supported languages")
    cache_available: bool = Field(..., description="Whether caching is available")
    providers_status: Dict[str, str] = Field(..., description="Status of translation providers")
    fallback_available: bool = Field(default=True, description="Whether offline fallback dictionaries are available")


# Error response models
class TranslationError(BaseModel):
    """Error response model for translation failures."""
    
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Detailed error message")
    details: Optional[Dict] = Field(None, description="Additional error details")


class ValidationErrorDetail(BaseModel):
    """Validation error detail model."""
    
    loc: List[str] = Field(..., description="Location of the error")
    msg: str = Field(..., description="Error message")
    type: str = Field(..., description="Error type")


class ValidationError(BaseModel):
    """Validation error response model."""
    
    error: str = Field(default="validation_error", description="Error type")
    message: str = Field(default="Input validation failed", description="Error message")
    details: List[ValidationErrorDetail] = Field(..., description="Validation error details")

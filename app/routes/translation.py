"""
FastAPI routes for translation services.
Provides endpoints for food name translation using external APIs.
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse

from ..models.translation import (
    TranslationRequest,
    FoodTranslationRequest,
    BatchTranslationRequest,
    BatchFoodTranslationRequest,
    TranslationResponse,
    BatchTranslationResponse,
    SupportedLanguagesResponse,
    TranslationHealthResponse,
    TranslationError
)
from ..services.translation_service import get_translation_service, TranslationService
from ..services.cache import get_cache_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/translate", tags=["translation"])


def get_translation_service_dependency() -> TranslationService:
    """Dependency to get translation service instance."""
    cache_service = get_cache_service()
    return get_translation_service(cache_service)


@router.post(
    "/text",
    response_model=TranslationResponse,
    summary="Translate single text",
    description="Translate a single text from source language to target language"
)
async def translate_text(
    request: TranslationRequest,
    translation_service: TranslationService = Depends(get_translation_service_dependency)
):
    """Translate a single text."""
    try:
        # Check if languages are supported
        if not translation_service.is_language_supported(request.source_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Source language '{request.source_lang}' is not supported"
            )
        
        if request.target_lang == "auto":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target language cannot be 'auto'"
            )

        if not translation_service.is_language_supported(request.target_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target language '{request.target_lang}' is not supported"
            )
        
        # Perform translation
        translated_text = await translation_service.translate_text(
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
        
        success = translated_text is not None
        
        return TranslationResponse(
            original_text=request.text,
            translated_text=translated_text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            success=success,
            error_message=None if success else "Translation failed"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal translation service error"
        )


@router.post(
    "/food",
    response_model=TranslationResponse,
    summary="Translate food name",
    description="Translate a food name with food-specific optimizations"
)
async def translate_food_name(
    request: FoodTranslationRequest,
    translation_service: TranslationService = Depends(get_translation_service_dependency)
):
    """Translate a food name with food-specific processing."""
    try:
        # Check if languages are supported
        if not translation_service.is_language_supported(request.source_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Source language '{request.source_lang}' is not supported"
            )
        
        if request.target_lang == "auto":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target language cannot be 'auto'"
            )

        if not translation_service.is_language_supported(request.target_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target language '{request.target_lang}' is not supported"
            )
        
        # Perform food-specific translation
        translated_text = await translation_service.translate_food_name(
            food_name=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
        
        success = translated_text is not None
        
        return TranslationResponse(
            original_text=request.text,
            translated_text=translated_text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            success=success,
            error_message=None if success else "Food translation failed"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Food translation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal food translation service error"
        )


@router.post(
    "/batch",
    response_model=BatchTranslationResponse,
    summary="Batch translate texts",
    description="Translate multiple texts in a single request"
)
async def batch_translate_texts(
    request: BatchTranslationRequest,
    translation_service: TranslationService = Depends(get_translation_service_dependency)
):
    """Batch translate multiple texts."""
    try:
        # Check if languages are supported
        if not translation_service.is_language_supported(request.source_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Source language '{request.source_lang}' is not supported"
            )
        
        if request.target_lang == "auto":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target language cannot be 'auto'"
            )

        if not translation_service.is_language_supported(request.target_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target language '{request.target_lang}' is not supported"
            )
        
        # Perform batch translation
        translations = {}
        successful_count = 0
        failed_count = 0
        
        for text in request.texts:
            translated_text = await translation_service.translate_text(
                text=text,
                source_lang=request.source_lang,
                target_lang=request.target_lang
            )
            
            translations[text] = translated_text
            
            if translated_text is not None:
                successful_count += 1
            else:
                failed_count += 1
        
        return BatchTranslationResponse(
            translations=translations,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            total_count=len(request.texts),
            successful_count=successful_count,
            failed_count=failed_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch translation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal batch translation service error"
        )


@router.post(
    "/batch/foods",
    response_model=BatchTranslationResponse,
    summary="Batch translate food names",
    description="Translate multiple food names with food-specific optimizations"
)
async def batch_translate_food_names(
    request: BatchFoodTranslationRequest,
    translation_service: TranslationService = Depends(get_translation_service_dependency)
):
    """Batch translate multiple food names."""
    try:
        # Check if languages are supported
        if not translation_service.is_language_supported(request.source_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Source language '{request.source_lang}' is not supported"
            )
        
        if request.target_lang == "auto":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target language cannot be 'auto'"
            )

        if not translation_service.is_language_supported(request.target_lang):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target language '{request.target_lang}' is not supported"
            )
        
        # Perform batch food translation
        translations = await translation_service.translate_food_names(
            food_names=request.food_names,
            source_lang=request.source_lang,
            target_lang=request.target_lang
        )
        
        successful_count = sum(1 for translation in translations.values() if translation is not None)
        failed_count = len(translations) - successful_count
        
        return BatchTranslationResponse(
            translations=translations,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            total_count=len(request.food_names),
            successful_count=successful_count,
            failed_count=failed_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch food translation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal batch food translation service error"
        )


@router.get(
    "/languages",
    response_model=SupportedLanguagesResponse,
    summary="Get supported languages",
    description="Get list of supported language codes and names"
)
async def get_supported_languages(
    translation_service: TranslationService = Depends(get_translation_service_dependency)
):
    """Get supported languages."""
    try:
        languages = translation_service.get_supported_languages()
        
        return SupportedLanguagesResponse(
            languages=languages,
            count=len(languages)
        )
        
    except Exception as e:
        logger.error(f"Error getting supported languages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving supported languages"
        )


@router.get(
    "/health",
    response_model=TranslationHealthResponse,
    summary="Translation service health check",
    description="Check the health status of the translation service"
)
async def translation_health_check(
    translation_service: TranslationService = Depends(get_translation_service_dependency)
):
    """Health check for translation service."""
    try:
        # Check cache availability
        cache_available = True
        try:
            await translation_service.cache.ping()
        except:
            cache_available = False
        
        # Check translation providers (simplified check)
        providers_status = {}
        for provider_class in translation_service.TRANSLATION_PROVIDERS:
            try:
                # Simple instantiation check
                provider_class(source='en', target='es')
                providers_status[provider_class.__name__] = "available"
            except Exception as e:
                providers_status[provider_class.__name__] = f"error: {str(e)}"
        
        libre_status = await translation_service.libretranslate_health()
        providers_status["LibreTranslate"] = libre_status

        # Determine overall status
        available_providers = sum(1 for status in providers_status.values() if status == "available")
        overall_status = "healthy" if available_providers > 0 and cache_available else "degraded"
        
        if available_providers == 0:
            overall_status = "unhealthy"

        fallback_available = True  # Recipe translation service always exposes dictionary-based fallback

        return TranslationHealthResponse(
            status=overall_status,
            supported_languages_count=len(translation_service.get_supported_languages()),
            cache_available=cache_available,
            providers_status=providers_status,
            fallback_available=fallback_available
        )
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return TranslationHealthResponse(
            status="error",
            supported_languages_count=0,
            cache_available=False,
            providers_status={"error": str(e)},
            fallback_available=True
        )


# Note: Exception handlers should be added at the app level, not router level

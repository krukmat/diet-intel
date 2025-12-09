import logging
import os
import re
import tempfile
import inspect
from datetime import datetime
from typing import Optional, Union

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from app.models.product import (
    BarcodeRequest, ProductResponse, ErrorResponse,
    ScanResponse, LowConfidenceScanResponse, Nutriments
)
from app.services.openfoodfacts import openfoodfacts_service
from app.services.cache import cache_service
from app.services import nutrition_ocr


def _normalize_legacy_ocr_result(payload: dict, *, default_engine: str) -> Optional[dict]:
    if not isinstance(payload, dict):
        return None

    normalized = dict(payload)
    raw_text = normalized.get('raw_text') or normalized.get('text') or ''

    parsed = normalized.get('parsed_nutriments') or normalized.get('nutrition_data') or normalized.get('nutrients')
    if not isinstance(parsed, dict):
        parsed = {}
    normalized['parsed_nutriments'] = parsed
    if not raw_text and parsed:
        raw_text = 'legacy_ocr_output'
    normalized['raw_text'] = raw_text
    normalized.setdefault('nutrients', parsed)
    normalized.setdefault('nutrition_data', parsed)

    serving_size = normalized.get('serving_size')
    serving_info = normalized.get('serving_info')
    if not isinstance(serving_info, dict):
        serving_info = {'detected': serving_size, 'unit': None}
    else:
        serving_info = serving_info.copy()
    serving_info.setdefault('detected', serving_size)
    serving_info.setdefault('unit', None)
    normalized['serving_info'] = serving_info
    normalized.setdefault('serving_size', serving_info.get('detected'))

    try:
        normalized['confidence'] = float(normalized.get('confidence', 0.0))
    except (TypeError, ValueError):
        normalized['confidence'] = 0.0

    processing_details = normalized.get('processing_details')
    if not isinstance(processing_details, dict):
        processing_details = {}
    processing_details.setdefault('ocr_engine', default_engine)
    normalized['processing_details'] = processing_details

    found = normalized.get('found_nutrients')
    if not isinstance(found, list):
        found = list(parsed.keys())
    normalized['found_nutrients'] = found
    missing = normalized.get('missing_required')
    if not isinstance(missing, list):
        missing = []
    normalized['missing_required'] = missing

    return normalized


async def _run_local_ocr(image_path: str, *, debug: bool = False) -> dict:
    try:
        from app.services import ocr as legacy_ocr
    except ImportError:
        legacy_ocr = None

    legacy_output = None
    if legacy_ocr is not None:
        legacy_callable = getattr(legacy_ocr.ocr_service, 'extract_nutrients', None)
        if legacy_callable:
            try:
                legacy_output = legacy_callable(image_path)
                if inspect.isawaitable(legacy_output):
                    legacy_output = await legacy_output
            except Exception:
                legacy_output = None

    normalized = _normalize_legacy_ocr_result(legacy_output or {}, default_engine='legacy_ocr') if legacy_output else None
    if normalized:
        return normalized

    return nutrition_ocr.extract_nutrients_from_image(image_path, debug=debug)


def extract_nutrients_from_image(*args, **kwargs):
    """Proxy to nutrition_ocr.extract_nutrients_from_image to ease patching in tests."""
    return nutrition_ocr.extract_nutrients_from_image(*args, **kwargs)


def call_external_ocr(*args, **kwargs):
    """Proxy to nutrition_ocr.call_external_ocr to ease patching in tests."""
    return nutrition_ocr.call_external_ocr(*args, **kwargs)
from app.services.database import db_service
from app.services.auth import RequestContext, get_optional_request_context
import httpx
import aiofiles

logger = logging.getLogger(__name__)
router = APIRouter()


def _ensure_request_context(context: RequestContext) -> RequestContext:
    """Provide a safe fallback when route functions are invoked directly in tests."""
    if isinstance(context, RequestContext):
        return context
    # Any other type (including FastAPI Depends placeholders or mocks) -> anonymous context
    return RequestContext(user=None, session_id=None, token=None)


@router.post(
    "/by-barcode",
    response_model=ProductResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Product not found"},
        408: {"model": ErrorResponse, "description": "Request timeout"},
        503: {"model": ErrorResponse, "description": "Service unavailable"}
    }
)
async def get_product_by_barcode(
    request: BarcodeRequest,
    context: RequestContext = Depends(get_optional_request_context)
):
    context = _ensure_request_context(context)
    barcode = request.barcode

    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode cannot be empty",
        )

    if len(barcode) > 256:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode exceeds maximum length",
        )

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", barcode):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode contains invalid characters",
        )
    start_time = datetime.now()
    
    user_id = context.user_id
    session_id = context.session_id
    
    try:
        # Check cache
        cache_key = f"product:{barcode}"
        cached_product = await cache_service.get(cache_key)
        if cached_product:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_product_lookup(
                user_id, session_id, barcode, cached_product.get('name'), 
                True, response_time, "Cache"
            )
            logger.info(f"Returning cached product for barcode: {barcode}")
            return ProductResponse(**cached_product)

        # Fetch from external API
        try:
            product = await openfoodfacts_service.get_product(barcode)
        except httpx.TimeoutException:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_product_lookup(
                user_id, session_id, barcode, None,
                False, response_time, "OpenFoodFacts", "Timeout"
            )
            logger.error(f"Timeout fetching product for barcode: {barcode}")
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail="Request timeout while fetching product data"
            )
        except httpx.RequestError as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_product_lookup(
                user_id, session_id, barcode, None,
                False, response_time, "OpenFoodFacts", f"Network error: {str(e)}"
            )
            logger.error(f"Network error fetching product for barcode {barcode}: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to connect to product database"
            )
        except Exception as api_error:
            # Log API error and convert to appropriate HTTP status
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_product_lookup(
                user_id, session_id, barcode, None,
                False, response_time, "OpenFoodFacts", f"API error: {str(api_error)}"
            )
            logger.warning(f"OpenFoodFacts API error for barcode {barcode}: {api_error}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Product lookup service temporarily unavailable"
            )
        
        if product is None:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_product_lookup(
                user_id, session_id, barcode, None, 
                False, response_time, "OpenFoodFacts", "Product not found"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with barcode {barcode} not found"
            )
        
        # Store in database and cache
        product_dict = product.model_dump()
        await cache_service.set(cache_key, product_dict, ttl=24*3600)
        
        # Store in database for future lookups  
        await db_service.store_product(
            barcode=product.barcode,
            name=product.name,
            brand=product.brand,
            categories=None,  # ProductResponse doesn't include categories
            nutriments=product_dict.get('nutriments', {}),
            serving_size=product.serving_size,
            image_url=product.image_url,
            source="OpenFoodFacts"
        )
        
        response_time = int((datetime.now() - start_time).total_seconds() * 1000)
        await db_service.log_product_lookup(
            user_id, session_id, barcode, product.name, 
            True, response_time, "OpenFoodFacts"
        )
        await db_service.log_user_product_interaction(
            user_id, session_id, barcode, "lookup", "api_fetch"
        )
        
        logger.info(f"Successfully fetched, stored, and cached product for barcode: {barcode}")
        return product
    except HTTPException:
        # Re-raise HTTPException to preserve intended status codes (like 404)
        raise
    except Exception as e:
        response_time = int((datetime.now() - start_time).total_seconds() * 1000)
        await db_service.log_product_lookup(
            user_id, session_id, barcode, None, 
            False, response_time, "System", f"Unexpected error: {str(e)}"
        )
        logger.error(f"Unexpected error fetching product for barcode {barcode}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post(
    "/scan-label",
    response_model=Union[ScanResponse, LowConfidenceScanResponse],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image file"},
        413: {"model": ErrorResponse, "description": "File too large"},
        500: {"model": ErrorResponse, "description": "Processing error"}
    }
)
async def scan_nutrition_label(
    image: UploadFile = File(None, alias="image"),
    legacy_file: UploadFile = File(None, alias="file"),
    context: RequestContext = Depends(get_optional_request_context)
):
    """
    Scan nutrition label from uploaded image using OCR
    """
    upload = image or legacy_file

    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image file is required"
        )

    # Validate file type
    if not upload.content_type or not upload.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (JPEG, PNG, etc.)"
        )
    
    # Check file size (max 10MB)
    if upload.size and upload.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image file too large (max 10MB)"
        )
    
    context = _ensure_request_context(context)

    # Extract user context
    user_id = context.user_id
    session_id = context.session_id
    
    temp_file_path = None
    start_time = datetime.now()
    
    try:
        # Save uploaded file to temporary storage
        suffix = os.path.splitext(upload.filename or '')[1] or '.jpg'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file_path = temp_file.name
        
        # Write uploaded content to temp file
        content = await upload.read()
        async with aiofiles.open(temp_file_path, 'wb') as f:
            await f.write(content)
        
        logger.info(f"Image saved to temp file: {temp_file_path}")
        
        # Extract nutrients using enhanced OCR service
        ocr_result = await _run_local_ocr(temp_file_path)
        
        if not ocr_result['raw_text'].strip():
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_ocr_scan(
                user_id, session_id, upload.size, 0.0, processing_time_ms,
                ocr_result.get('processing_details', {}).get('ocr_engine', 'tesseract'),
                0, False, "No text extracted"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text could be extracted from the image"
            )
        
        # Extract parsed data
        nutrition_data = ocr_result['parsed_nutriments']
        serving_size = ocr_result.get('serving_size', '100g')  # Default serving size
        confidence = ocr_result['confidence']
        raw_text = ocr_result['raw_text']
        
        processing_time = (datetime.now() - start_time).total_seconds()
        processing_time_ms = int(processing_time * 1000)
        logger.info(f"OCR processing completed in {processing_time:.2f}s, confidence: {confidence:.2f}")
        
        # Log OCR analytics
        nutrients_extracted = len([v for v in nutrition_data.values() if v is not None])
        await db_service.log_ocr_scan(
            user_id, session_id, upload.size, confidence, processing_time_ms,
            ocr_result.get('processing_details', {}).get('ocr_engine', 'tesseract'),
            nutrients_extracted, True
        )
        
        scan_timestamp = datetime.now()
        
        # High confidence response (>= 0.7)
        if confidence >= 0.7:
            nutriments = Nutriments(
                energy_kcal_per_100g=nutrition_data.get('energy_kcal'),
                protein_g_per_100g=nutrition_data.get('protein_g'),
                fat_g_per_100g=nutrition_data.get('fat_g'),
                carbs_g_per_100g=nutrition_data.get('carbs_g'),
                sugars_g_per_100g=nutrition_data.get('sugars_g'),
                salt_g_per_100g=nutrition_data.get('salt_g')
            )
            
            return ScanResponse(
                source="Local OCR",
                confidence=confidence,
                raw_text=raw_text,
                serving_size=serving_size,
                nutriments=nutriments,
                nutrients=nutriments,
                scanned_at=scan_timestamp
            )
        
        # Low confidence response (< 0.7)
        else:
            return LowConfidenceScanResponse(
                low_confidence=True,
                confidence=confidence,
                raw_text=raw_text,
                partial_parsed=nutrition_data,
                suggest_external_ocr=True,
                scanned_at=scan_timestamp
            )
    
    except HTTPException:
        raise
    except Exception as e:
        processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await db_service.log_ocr_scan(
            user_id, session_id, upload.size or 0, 0.0, processing_time_ms,
            "tesseract", 0, False, f"Processing error: {str(e)}"
        )
        logger.error(f"Error processing image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing image"
        )
    
    finally:
        # Clean up temp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temp file: {temp_file_path}")
            except OSError as e:
                logger.warning(f"Failed to clean up temp file {temp_file_path}: {e}")


@router.post(
    "/scan-label-external",
    response_model=Union[ScanResponse, LowConfidenceScanResponse],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image file"},
        503: {"model": ErrorResponse, "description": "External OCR service unavailable"}
    }
)
async def scan_label_with_external_ocr(
    image: UploadFile = File(None, alias="image"),
    legacy_file: UploadFile = File(None, alias="file"),
    context: RequestContext = Depends(get_optional_request_context)
):
    """
    Scan nutrition label using external OCR service (when available)
    Falls back to local OCR if external service is unavailable
    """
    upload = image or legacy_file

    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image file is required"
        )

    # Similar validation as scan_label endpoint
    if not upload.content_type or not upload.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    context = _ensure_request_context(context)

    # Extract user context
    user_id = context.user_id
    session_id = context.session_id
    
    temp_file_path = None
    start_time = datetime.now()
    
    try:
        # Save uploaded file
        suffix = os.path.splitext(upload.filename or '')[1] or '.jpg'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file_path = temp_file.name
        
        content = await upload.read()
        async with aiofiles.open(temp_file_path, 'wb') as f:
            await f.write(content)
        
        # Try external OCR first
        external_result = call_external_ocr(temp_file_path)
        
        if external_result.get('confidence', 0) > 0:
            logger.info("Using external OCR service result")
            ocr_result = external_result
            source = "External OCR"
        else:
            logger.info("External OCR unavailable, falling back to local OCR")
            ocr_result = await _run_local_ocr(temp_file_path)
            source = "Local OCR (fallback)"
        
        if not ocr_result['raw_text'].strip():
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_ocr_scan(
                user_id, session_id, upload.size, 0.0, processing_time_ms,
                source.replace(" OCR", "").lower() + "_api", 0, False, "No text extracted"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text could be extracted from the image"
            )
        
        # Extract parsed data
        nutrition_data = ocr_result['parsed_nutriments']
        serving_size = ocr_result.get('serving_size', '100g')  # Default serving size
        confidence = ocr_result['confidence']
        raw_text = ocr_result['raw_text']
        
        processing_time = (datetime.now() - start_time).total_seconds()
        processing_time_ms = int(processing_time * 1000)
        logger.info(f"External OCR processing completed in {processing_time:.2f}s, confidence: {confidence:.2f}")
        
        # Log OCR analytics
        nutrients_extracted = len([v for v in nutrition_data.values() if v is not None])
        await db_service.log_ocr_scan(
            user_id, session_id, upload.size, confidence, processing_time_ms,
            ocr_result.get('processing_details', {}).get('ocr_engine', 'external_api'),
            nutrients_extracted, True
        )
        
        scan_timestamp = datetime.now()
        
        if confidence >= 0.7:
            nutriments = Nutriments(
                energy_kcal_per_100g=nutrition_data.get('energy_kcal'),
                protein_g_per_100g=nutrition_data.get('protein_g'),
                fat_g_per_100g=nutrition_data.get('fat_g'),
                carbs_g_per_100g=nutrition_data.get('carbs_g'),
                sugars_g_per_100g=nutrition_data.get('sugars_g'),
                salt_g_per_100g=nutrition_data.get('salt_g')
            )
            
            return ScanResponse(
                source=source,
                confidence=confidence,
                raw_text=raw_text,
                serving_size=serving_size,
                nutriments=nutriments,
                nutrients=nutriments,
                scanned_at=scan_timestamp
            )
        else:
            return LowConfidenceScanResponse(
                low_confidence=True,
                confidence=confidence,
                raw_text=raw_text,
                partial_parsed=nutrition_data,
                suggest_external_ocr=external_result.get('confidence', 0) == 0,  # Only suggest if external OCR wasn't used
                scanned_at=scan_timestamp
            )
    
    except HTTPException:
        raise
    except Exception as e:
        processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await db_service.log_ocr_scan(
            user_id, session_id, image.size or 0, 0.0, processing_time_ms,
            "external_api", 0, False, f"Processing error: {str(e)}"
        )
        logger.error(f"Error in external OCR processing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing image with external OCR"
        )
    
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except OSError as e:
                logger.warning(f"Failed to clean up temp file: {e}")

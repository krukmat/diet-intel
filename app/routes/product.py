import logging
import os
import tempfile
from datetime import datetime
from typing import Union
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Depends
from app.models.product import (
    BarcodeRequest, ProductResponse, ErrorResponse,
    ScanResponse, LowConfidenceScanResponse, Nutriments
)
from app.services.openfoodfacts import openfoodfacts_service
from app.services.cache import cache_service
from app.services.nutrition_ocr import extract_nutrients_from_image, call_external_ocr
from app.services.database import db_service
from app.services.auth import RequestContext, get_optional_request_context
import httpx
import aiofiles

logger = logging.getLogger(__name__)
router = APIRouter()


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
    barcode = request.barcode.strip()
    start_time = datetime.now()
    
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode cannot be empty"
        )
    
    # Extract user context (optional authentication)
    user_id = context.user_id
    session_id = context.session_id
    
    try:
        # Check database first
        db_product = await db_service.get_product(barcode)
        if db_product:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_product_lookup(
                user_id, session_id, barcode, db_product['name'], 
                True, response_time, "Database"
            )
            await db_service.log_user_product_interaction(
                user_id, session_id, barcode, "lookup", "database_hit"
            )
            logger.info(f"Returning database product for barcode: {barcode}")
            
            # Convert to ProductResponse format
            return ProductResponse(
                source="Database",
                barcode=db_product['barcode'],
                name=db_product['name'],
                brand=db_product['brand'],
                nutriments=Nutriments(**db_product['nutriments']),
                serving_size=db_product['serving_size'],
                image_url=db_product['image_url'],
                fetched_at=datetime.now()
            )
        
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
    image: UploadFile = File(...),
    context: RequestContext = Depends(get_optional_request_context)
):
    """
    Scan nutrition label from uploaded image using OCR
    """
    # Validate file type
    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (JPEG, PNG, etc.)"
        )
    
    # Check file size (max 10MB)
    if image.size and image.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image file too large (max 10MB)"
        )
    
    # Extract user context
    user_id = context.user_id
    session_id = context.session_id
    
    temp_file_path = None
    start_time = datetime.now()
    
    try:
        # Save uploaded file to temporary storage
        suffix = os.path.splitext(image.filename or '')[1] or '.jpg'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file_path = temp_file.name
        
        # Write uploaded content to temp file
        content = await image.read()
        async with aiofiles.open(temp_file_path, 'wb') as f:
            await f.write(content)
        
        logger.info(f"Image saved to temp file: {temp_file_path}")
        
        # Extract nutrients using enhanced OCR service
        ocr_result = extract_nutrients_from_image(temp_file_path)
        
        if not ocr_result['raw_text'].strip():
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_ocr_scan(
                user_id, session_id, image.size, 0.0, processing_time_ms,
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
            user_id, session_id, image.size, confidence, processing_time_ms,
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
            user_id, session_id, image.size or 0, 0.0, processing_time_ms,
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
    image: UploadFile = File(...),
    context: RequestContext = Depends(get_optional_request_context)
):
    """
    Scan nutrition label using external OCR service (when available)
    Falls back to local OCR if external service is unavailable
    """
    # Similar validation as scan_label endpoint
    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Extract user context
    user_id = context.user_id
    session_id = context.session_id
    
    temp_file_path = None
    start_time = datetime.now()
    
    try:
        # Save uploaded file
        suffix = os.path.splitext(image.filename or '')[1] or '.jpg'
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file_path = temp_file.name
        
        content = await image.read()
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
            ocr_result = extract_nutrients_from_image(temp_file_path)
            source = "Local OCR (fallback)"
        
        if not ocr_result['raw_text'].strip():
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            await db_service.log_ocr_scan(
                user_id, session_id, image.size, 0.0, processing_time_ms,
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
            user_id, session_id, image.size, confidence, processing_time_ms,
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

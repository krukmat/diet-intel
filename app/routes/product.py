import logging
import os
import tempfile
from datetime import datetime
from typing import Union
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from app.models.product import (
    BarcodeRequest, ProductResponse, ErrorResponse,
    ScanResponse, LowConfidenceScanResponse, Nutriments
)
from app.services.openfoodfacts import openfoodfacts_service
from app.services.cache import cache_service
from app.services.nutrition_ocr import extract_nutrients_from_image, call_external_ocr
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
async def get_product_by_barcode(request: BarcodeRequest):
    barcode = request.barcode.strip()
    
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Barcode cannot be empty"
        )
    
    cache_key = f"product:{barcode}"
    
    try:
        cached_product = await cache_service.get(cache_key)
        if cached_product:
            logger.info(f"Returning cached product for barcode: {barcode}")
            return ProductResponse(**cached_product)
        
        product = await openfoodfacts_service.get_product(barcode)
        
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with barcode {barcode} not found"
            )
        
        product_dict = product.model_dump()
        await cache_service.set(cache_key, product_dict, ttl_hours=24)
        
        logger.info(f"Successfully fetched and cached product for barcode: {barcode}")
        return product
        
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching product for barcode: {barcode}")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Request timeout while fetching product data"
        )
    except httpx.RequestError as e:
        logger.error(f"Network error fetching product for barcode {barcode}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to connect to product database"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching product for barcode {barcode}: {e}")
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
async def scan_nutrition_label(image: UploadFile = File(...)):
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
        logger.info(f"OCR processing completed in {processing_time:.2f}s, confidence: {confidence:.2f}")
        
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
async def scan_label_with_external_ocr(image: UploadFile = File(...)):
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
        logger.info(f"External OCR processing completed in {processing_time:.2f}s, confidence: {confidence:.2f}")
        
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
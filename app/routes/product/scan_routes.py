"""
Local OCR scanning routes
Target: ~250 LOC, CC < 12
"""
import logging
import os
import tempfile
from datetime import datetime
from typing import Union
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from app.models.product import ScanResponse, LowConfidenceScanResponse, ErrorResponse, Nutriments
from app.services.ocr.ocr_factory import OCRFactory

logger = logging.getLogger(__name__)
router = APIRouter(tags=["scanning"])


async def _save_upload_to_temp(file: UploadFile) -> str:
    """Save uploaded file to temporary location"""
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await file.read()
    temp_file.write(content)
    temp_file.close()
    return temp_file.name


@router.post(
    "/scan-label",
    response_model=Union[ScanResponse, LowConfidenceScanResponse],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image file"},
        413: {"model": ErrorResponse, "description": "File too large"},
        500: {"model": ErrorResponse, "description": "Processing error"}
    }
)
async def scan_nutrition_label(file: UploadFile = File(...)):
    """
    Scan nutrition label using local Tesseract OCR
    CC target: 10

    Args:
        file: Image file (JPEG, PNG, etc.)

    Returns:
        ScanResponse or LowConfidenceScanResponse
    """
    # Validate image
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (JPEG, PNG, etc.)"
        )

    # Check file size (max 10MB)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image file too large (max 10MB)"
        )

    temp_path = None
    try:
        # Save upload to temp file
        temp_path = await _save_upload_to_temp(file)
        logger.info(f"Image saved to temp file: {temp_path}")

        # Extract nutrients using local OCR
        ocr_service = OCRFactory.create_local()
        result = await ocr_service.extract_nutrients(temp_path)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not extract nutrition information from image"
            )

        if not result.raw_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text could be extracted from the image"
            )

        # Check confidence level
        if result.is_high_confidence():
            # High confidence (>= 0.7)
            nutriments = Nutriments(
                energy_kcal_per_100g=result.parsed_nutriments.get("energy_kcal"),
                protein_g_per_100g=result.parsed_nutriments.get("protein_g"),
                fat_g_per_100g=result.parsed_nutriments.get("fat_g"),
                carbs_g_per_100g=result.parsed_nutriments.get("carbs_g"),
                sugars_g_per_100g=result.parsed_nutriments.get("sugars_g"),
                salt_g_per_100g=result.parsed_nutriments.get("salt_g")
            )

            logger.info(f"OCR scan successful (confidence: {result.confidence:.2f})")
            return ScanResponse(
                source="Local OCR",
                confidence=result.confidence,
                raw_text=result.raw_text,
                serving_size=result.serving_info.get("detected", "100g"),
                nutriments=nutriments,
                nutrients=nutriments,
                scanned_at=datetime.now()
            )
        else:
            # Low confidence (< 0.7)
            logger.info(f"OCR scan low confidence (confidence: {result.confidence:.2f})")
            return LowConfidenceScanResponse(
                low_confidence=True,
                confidence=result.confidence,
                raw_text=result.raw_text,
                partial_parsed=result.parsed_nutriments,
                suggest_external_ocr=True,
                scanned_at=datetime.now()
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR scan failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing image"
        )
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                logger.debug(f"Cleaned up temp file: {temp_path}")
            except OSError as e:
                logger.warning(f"Failed to clean up temp file {temp_path}: {e}")

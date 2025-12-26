"""
External OCR routes (Google Vision, AWS Textract, etc.)
Target: ~200 LOC, CC < 8
"""
import logging
import os
import tempfile
from typing import Union
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from app.models.product import ScanResponse, LowConfidenceScanResponse, ErrorResponse, Nutriments
from app.services.ocr.ocr_factory import OCRFactory

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/product", tags=["external-ocr"])


async def _save_upload_to_temp(file: UploadFile) -> str:
    """Save uploaded file to temporary location"""
    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await file.read()
    temp_file.write(content)
    temp_file.close()
    return temp_file.name


@router.post(
    "/scan-label-external",
    response_model=Union[ScanResponse, LowConfidenceScanResponse],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image file"},
        503: {"model": ErrorResponse, "description": "External OCR service unavailable"}
    }
)
async def scan_label_with_external_ocr(
    file: UploadFile = File(...),
    provider: str = "google"
):
    """
    Scan nutrition label using external OCR API
    CC target: 8 (down from 30!)

    Args:
        file: Image file (JPEG, PNG, etc.)
        provider: OCR provider (google, aws, azure, etc.)

    Returns:
        ScanResponse or LowConfidenceScanResponse
    """
    # Validate image
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    temp_path = None
    try:
        # Save upload to temp file
        temp_path = await _save_upload_to_temp(file)
        logger.info(f"Image saved to temp file for external OCR: {temp_path}")

        # Extract using external service
        ocr_service = OCRFactory.create_external(provider=provider)
        result = await ocr_service.extract_nutrients(temp_path)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"External OCR service ({provider}) unavailable"
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

            logger.info(
                f"External OCR ({provider}) successful (confidence: {result.confidence:.2f})"
            )
            return ScanResponse(
                source=f"External OCR ({provider})",
                confidence=result.confidence,
                raw_text=result.raw_text,
                serving_size=result.serving_info.get("detected", "100g"),
                nutriments=nutriments,
                nutrients=nutriments
            )
        else:
            # Low confidence (< 0.7)
            logger.info(
                f"External OCR ({provider}) low confidence (confidence: {result.confidence:.2f})"
            )
            return LowConfidenceScanResponse(
                low_confidence=True,
                confidence=result.confidence,
                raw_text=result.raw_text,
                partial_parsed=result.parsed_nutriments,
                suggest_external_ocr=False  # Already used external
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"External OCR ({provider}) failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error with external OCR service ({provider})"
        )
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                logger.debug(f"Cleaned up temp file: {temp_path}")
            except OSError as e:
                logger.warning(f"Failed to clean up temp file {temp_path}: {e}")

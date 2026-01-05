"""
OCR Processing Service

Handles nutrition label scanning and OCR processing with local and external services.
Task: Phase 1 Tarea 3 - Product Helpers Refactoring
"""

import logging
import os
import tempfile
import inspect
from datetime import datetime
from typing import Optional, Tuple, Union

from fastapi import Depends, File, UploadFile, status
from app.models.product import ScanResponse, LowConfidenceScanResponse, ErrorResponse, Nutriments
from app.services import nutrition_ocr
from app.services.auth import RequestContext, get_optional_request_context
from app.services.database import db_service
from app.services.analytics_service import AnalyticsService

from .adapters import (
    _ensure_request_context,
    _raise_http_exception,
    _is_http_exception,
    _write_bytes_to_tempfile,
    _route_post
)
from .legacy_ocr_compat import (
    _import_legacy_ocr,
    _get_legacy_service,
    _normalize_legacy_ocr_result,
    _run_legacy_text_pipeline,
    _normalize_external_payload,
)

logger = logging.getLogger(__name__)

# Initialize analytics service for logging
analytics_service = AnalyticsService(db_service)


# ─────────────────────────────────────────────────────────────
# OCR Service Proxies
# ─────────────────────────────────────────────────────────────


def extract_nutrients_from_image(*args, **kwargs):
    """Proxy to nutrition_ocr.extract_nutrients_from_image to ease patching in tests."""
    return nutrition_ocr.extract_nutrients_from_image(*args, **kwargs)


def call_external_ocr(*args, **kwargs):
    """Proxy to nutrition_ocr.call_external_ocr to ease patching in tests."""
    return nutrition_ocr.call_external_ocr(*args, **kwargs)


# ─────────────────────────────────────────────────────────────
# Local OCR Processing
# ─────────────────────────────────────────────────────────────


async def _run_local_ocr(image_path: str, *, debug: bool = False) -> dict:
    """
    Execute local OCR processing on image.

    Strategy:
    1. Try enhanced OCR service (nutrition_ocr)
    2. Fall back to legacy OCR if available
    3. Fall back to legacy service's extract_nutrients method

    Returns normalized OCR result dict.
    """
    proxied_result = extract_nutrients_from_image(image_path, debug=debug)
    if inspect.isawaitable(proxied_result):
        proxied_result = await proxied_result
    if proxied_result:
        return proxied_result

    legacy_ocr = _import_legacy_ocr()
    if legacy_ocr is not None:
        normalized = await _run_legacy_text_pipeline(legacy_ocr, image_path)
        if normalized:
            return normalized

        legacy_service = _get_legacy_service(legacy_ocr)
        legacy_callable = getattr(legacy_service, 'extract_nutrients', None) if legacy_service else None
        if legacy_callable:
            legacy_output = legacy_callable(image_path)
            if inspect.isawaitable(legacy_output):
                legacy_output = await legacy_output
            normalized = _normalize_legacy_ocr_result(legacy_output or {}, default_engine='legacy_ocr') if legacy_output else None
            if normalized:
                return normalized

    return proxied_result


def _is_empty_ocr_result(result: Optional[dict]) -> bool:
    """Check if OCR result contains any meaningful data."""
    if not isinstance(result, dict):
        return True
    raw_text = (result.get('raw_text') or '').strip()
    parsed = result.get('parsed_nutriments') or {}
    has_parsed = any(value is not None for value in parsed.values()) if isinstance(parsed, dict) else False
    return not raw_text and not has_parsed


# ─────────────────────────────────────────────────────────────
# Scan Routes
# ─────────────────────────────────────────────────────────────


@_route_post(
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
    Scan nutrition label from uploaded image using local OCR.

    Processes the image and returns:
    - ScanResponse with high confidence (≥0.7)
    - LowConfidenceScanResponse with low confidence (<0.7)
    """
    upload = image or legacy_file

    if upload is None:
        raise _raise_http_exception(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="field required"
        )

    # Validate file type
    if not upload.content_type or not upload.content_type.startswith('image/'):
        raise _raise_http_exception(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (JPEG, PNG, etc.)"
        )

    # Check file size (max 10MB)
    if upload.size and upload.size > 10 * 1024 * 1024:
        raise _raise_http_exception(
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
        await _write_bytes_to_tempfile(temp_file_path, content)

        logger.info(f"Image saved to temp file: {temp_file_path}")

        # Extract nutrients using local OCR service
        ocr_result = await _run_local_ocr(temp_file_path)

        if not ocr_result['raw_text'].strip():
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            await analytics_service.log_ocr_scan(
                user_id, session_id, upload.size, 0.0, processing_time_ms,
                ocr_result.get('processing_details', {}).get('ocr_engine', 'tesseract'),
                0, False, "No text extracted"
            )
            raise _raise_http_exception(
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
        await analytics_service.log_ocr_scan(
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

    except Exception as exc:
        if _is_http_exception(exc):
            raise exc
        processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        await analytics_service.log_ocr_scan(
            user_id, session_id, upload.size or 0, 0.0, processing_time_ms,
            "tesseract", 0, False, f"Processing error: {str(exc)}"
        )
        logger.error(f"Error processing image: {exc}")
        raise _raise_http_exception(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing image"
        )

    finally:
        # Clean up temp file
        if temp_file_path:
            try:
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temp file: {temp_file_path}")
            except FileNotFoundError:
                logger.debug(f"Temp file already removed: {temp_file_path}")
            except OSError as e:
                logger.warning(f"Failed to clean up temp file {temp_file_path}: {e}")


@_route_post(
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
    Scan nutrition label using external OCR service with local fallback.

    Strategy:
    1. Try external OCR service if available
    2. Fall back to local OCR if external fails or unavailable
    3. Return result with confidence scoring
    """
    upload = _validate_upload_file(image, legacy_file=legacy_file)
    using_legacy_upload = legacy_file is not None and image is None

    context = _ensure_request_context(context)
    user_id = context.user_id
    session_id = context.session_id

    temp_file_path = None
    start_time = datetime.now()

    try:
        temp_file_path = await _process_upload_file(upload)
        legacy_ocr = _import_legacy_ocr()
        ocr_result, source, external_used = await _try_external_ocr(temp_file_path, legacy_ocr, using_legacy_upload)

        if not ocr_result['raw_text'].strip():
            processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            await _log_ocr_analytics(user_id, session_id, upload.size or 0, 0.0, processing_time_ms, source, 0, False, "No text extracted")
            raise _raise_http_exception(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text could be extracted from the image"
            )

        nutrition_data, serving_size, confidence, raw_text = _extract_nutrition_data(ocr_result)
        processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        logger.info(f"External OCR processing completed in {(processing_time_ms / 1000):.2f}s, confidence: {confidence:.2f}")

        nutrients_extracted = len([v for v in nutrition_data.values() if v is not None])
        await _log_ocr_analytics(user_id, session_id, upload.size or 0, confidence, processing_time_ms, source, nutrients_extracted, True)

        scan_timestamp = datetime.now()
        return _build_scan_response(nutrition_data, serving_size, confidence, raw_text, source, scan_timestamp, external_used)

    except Exception as exc:
        await _handle_ocr_error(exc, user_id, session_id, upload.size or 0, start_time)

    finally:
        await _cleanup_temp_file(temp_file_path)


def _validate_upload_file(upload, *, legacy_file: UploadFile = None) -> UploadFile:
    """
    Validate uploaded image file and return normalized upload.
    """
    final_upload = upload or legacy_file

    if final_upload is None:
        raise _raise_http_exception(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="field required"
        )

    if not final_upload.content_type or not final_upload.content_type.startswith('image/'):
        raise _raise_http_exception(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    return final_upload


async def _process_upload_file(upload: UploadFile) -> str:
    """
    Process uploaded file and return temporary file path.
    """
    suffix = os.path.splitext(upload.filename or '')[1] or '.jpg'
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_file_path = temp_file.name

    try:
        content = await upload.read()
        await _write_bytes_to_tempfile(temp_file_path, content)
        logger.info(f"Image saved to temp file: {temp_file_path}")
        return temp_file_path
    except Exception as exc:
        try:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        except OSError:
            pass
        raise _raise_http_exception(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing upload: {str(exc)}"
        )


async def _try_external_ocr(temp_file_path: str, legacy_ocr, using_legacy_upload: bool) -> Tuple[Optional[dict], str, bool]:
    """
    Try external OCR service with fallback logic.
    """
    external_callable = getattr(legacy_ocr, 'call_external_ocr', None) if legacy_ocr else None
    ocr_result = None

    if external_callable:
        try:
            external_payload = external_callable(temp_file_path)
            if inspect.isawaitable(external_payload):
                external_payload = await external_payload
            ocr_result = await _normalize_external_payload(external_payload, legacy_ocr, engine_label='external_ocr')
            if _is_empty_ocr_result(ocr_result):
                ocr_result = None
        except Exception as exc:
            logger.warning(f"External OCR failed, falling back to local OCR: {exc}")
            ocr_result = None

    if ocr_result is None:
        try:
            fallback_payload = call_external_ocr(temp_file_path)
            if inspect.isawaitable(fallback_payload):
                fallback_payload = await fallback_payload
            ocr_result = await _normalize_external_payload(fallback_payload, legacy_ocr, engine_label='external_ocr')
            if _is_empty_ocr_result(ocr_result):
                ocr_result = None
        except Exception as exc:
            logger.warning(f"External OCR hook failed, falling back to local OCR: {exc}")
            ocr_result = None

    if ocr_result:
        source = "external_ocr" if using_legacy_upload else "External OCR"
        external_used = True
    else:
        logger.info("External OCR unavailable, falling back to local OCR")
        ocr_result = await _run_local_ocr(temp_file_path)
        source = "local_ocr_fallback" if using_legacy_upload else "Local OCR (fallback)"
        external_used = False

    return ocr_result, source, external_used


def _extract_nutrition_data(ocr_result: dict) -> tuple[dict, str, float, str]:
    """
    Extract nutrition data from OCR result.
    """
    nutrition_data = ocr_result['parsed_nutriments']
    serving_size = ocr_result.get('serving_size', '100g')
    confidence = ocr_result['confidence']
    raw_text = ocr_result['raw_text']

    return nutrition_data, serving_size, confidence, raw_text


async def _log_ocr_analytics(
    user_id: str,
    session_id: str,
    file_size: int,
    confidence: float,
    processing_time_ms: int,
    source: str,
    nutrients_extracted: int,
    success: bool,
    error_message: str = None
):
    """
    Log OCR processing analytics.
    """
    engine_label = source.replace(" OCR", "").replace(" ", "_").lower()
    if not engine_label.endswith("_api"):
        engine_label += "_api"

    await analytics_service.log_ocr_scan(
        user_id, session_id, file_size, confidence, processing_time_ms,
        engine_label, nutrients_extracted, success, error_message
    )


async def _handle_ocr_error(
    exc: Exception,
    user_id: str,
    session_id: str,
    file_size: int,
    start_time: datetime
) -> None:
    """
    Handle OCR processing errors with logging and cleanup.
    """
    if _is_http_exception(exc):
        raise exc

    processing_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    await _log_ocr_analytics(
        user_id, session_id, file_size or 0, 0.0, processing_time_ms,
        "external_api", 0, False, f"Processing error: {str(exc)}"
    )

    logger.error(f"Error in external OCR processing: {exc}")
    raise _raise_http_exception(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Error processing image with external OCR"
    )


async def _cleanup_temp_file(temp_file_path: str) -> None:
    """
    Clean up temporary file with error handling.
    """
    if temp_file_path:
        try:
            os.unlink(temp_file_path)
            logger.info(f"Cleaned up temp file: {temp_file_path}")
        except FileNotFoundError:
            logger.debug(f"Temp file already removed: {temp_file_path}")
        except OSError as e:
            logger.warning(f"Failed to clean up temp file: {e}")


def _build_scan_response(
    nutrition_data: dict,
    serving_size: str,
    confidence: float,
    raw_text: str,
    source: str,
    scan_timestamp: datetime,
    external_used: bool
) -> Union[ScanResponse, LowConfidenceScanResponse]:
    """
    Build appropriate scan response based on confidence.
    """
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
            suggest_external_ocr=not external_used,
            scanned_at=scan_timestamp
        )

"""
Métodos de refactorización para scan_label_with_external_ocr
Fase 4: Reducción de Complejidad Cíclica
"""

# Métodos de refactorización para scan_label_with_external_ocr

def _validate_upload_file(upload, *, legacy_file: UploadFile = None) -> UploadFile:
    """
    Validate uploaded image file and return normalized upload.
    
    Args:
        upload: Primary upload file
        legacy_file: Legacy file parameter
        
    Returns:
        Validated upload file
        
    Raises:
        HTTPException: If validation fails
    """
    # Handle file selection logic
    final_upload = upload or legacy_file
    
    if final_upload is None:
        raise _raise_http_exception(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="field required"
        )
    
    # Validate content type
    if not final_upload.content_type or not final_upload.content_type.startswith('image/'):
        raise _raise_http_exception(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    return final_upload


async def _process_upload_file(upload: UploadFile) -> str:
    """
    Process uploaded file and return temporary file path.
    
    Args:
        upload: Uploaded file to process
        
    Returns:
        Path to temporary file
        
    Raises:
        HTTPException: If processing fails
    """
    # Create temporary file
    suffix = os.path.splitext(upload.filename or '')[1] or '.jpg'
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_file_path = temp_file.name
    
    try:
        # Write content to temp file
        content = await upload.read()
        await _write_bytes_to_tempfile(temp_file_path, content)
        logger.info(f"Image saved to temp file: {temp_file_path}")
        return temp_file_path
    except Exception as exc:
        # Clean up on error
        try:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        except OSError:
            pass
        raise _raise_http_exception(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing upload: {str(exc)}"
        )


async def _try_external_ocr(temp_file_path: str, legacy_ocr, using_legacy_upload: bool) -> tuple[dict | None, str, bool]:
    """
    Try external OCR service with fallback logic.
    
    Args:
        temp_file_path: Path to image file
        legacy_ocr: Legacy OCR module
        using_legacy_upload: Whether using legacy upload format
        
    Returns:
        Tuple of (ocr_result, source_label, external_used)
    """
    # Try legacy external OCR first
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
    
    # Try fallback external OCR
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
    
    # Determine source and external usage
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
    
    Args:
        ocr_result: OCR processing result
        
    Returns:
        Tuple of (nutrition_data, serving_size, confidence, raw_text)
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
    
    Args:
        user_id: User identifier
        session_id: Session identifier
        file_size: Size of processed file
        confidence: OCR confidence score
        processing_time_ms: Processing time in milliseconds
        source: OCR source used
        nutrients_extracted: Number of nutrients extracted
        success: Whether processing was successful
        error_message: Error message if processing failed
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
    
    Args:
        exc: Exception that occurred
        user_id: User identifier
        session_id: Session identifier
        file_size: Size of processed file
        start_time: Processing start time
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
    
    Args:
        temp_file_path: Path to temporary file
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
    
    Args:
        nutrition_data: Parsed nutrition data
        serving_size: Serving size information
        confidence: OCR confidence score
        raw_text: Extracted raw text
        source: OCR source used
        scan_timestamp: When scan was performed
        external_used: Whether external OCR was used
        
    Returns:
        Appropriate response model
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

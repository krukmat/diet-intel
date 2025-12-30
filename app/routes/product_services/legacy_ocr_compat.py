"""
Legacy OCR Compatibility Layer

Provides support for legacy OCR implementations and text parsing.
Task: Phase 1 Tarea 3 - Product Helpers Refactoring
"""

import logging
import inspect
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Legacy OCR Import and Service Access
# ─────────────────────────────────────────────────────────────


def _import_legacy_ocr():
    """Import the legacy OCR service module if available."""
    try:
        from app.services import ocr as legacy_ocr
        return legacy_ocr
    except ImportError:
        return None


def _get_legacy_service(legacy_ocr):
    """Get the OCR service instance from legacy OCR module."""
    return getattr(legacy_ocr, 'ocr_service', None) if legacy_ocr else None


def _get_legacy_parser_callable(legacy_ocr):
    """Get the nutrition text parser callable from legacy OCR module."""
    parser_module = getattr(legacy_ocr, 'nutrition_parser', None) if legacy_ocr else None
    return getattr(parser_module, 'parse_nutrition_text', None) if parser_module else None


def _get_legacy_text_extractor(legacy_ocr):
    """Get the text extractor function from legacy OCR service."""
    service = _get_legacy_service(legacy_ocr)
    return getattr(service, 'extract_text', None) if service else None


# ─────────────────────────────────────────────────────────────
# Legacy OCR Result Normalization
# ─────────────────────────────────────────────────────────────


def _normalize_legacy_ocr_result(payload: dict, *, default_engine: str) -> Optional[dict]:
    """
    Normalize OCR result from various sources into a standard format.

    Handles:
    - Missing or malformed fields
    - Different field names from different OCR backends
    - Confidence scoring
    - Processing metadata
    """
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


# ─────────────────────────────────────────────────────────────
# Legacy OCR Pipeline Functions
# ─────────────────────────────────────────────────────────────


async def _parse_text_with_legacy_parser(legacy_ocr, raw_text: str, *, engine_label: str) -> Optional[dict]:
    """
    Parse extracted text using legacy nutrition parser.

    Handles both sync and async parsers.
    """
    parser_callable = _get_legacy_parser_callable(legacy_ocr)
    if parser_callable is None:
        return None
    parsed = parser_callable(raw_text or '')
    if inspect.isawaitable(parsed):
        parsed = await parsed
    if not isinstance(parsed, dict):
        parsed = {}
    return await _normalize_parsed_payload(raw_text, parsed, engine_label=engine_label)


async def _normalize_parsed_payload(raw_text: str, parsed_payload: Optional[dict], *, engine_label: str) -> Optional[dict]:
    """
    Normalize a parsed nutrition payload into standard format.

    Creates intermediate payload structure and applies normalization rules.
    """
    parsed_payload = parsed_payload or {}
    payload = {
        'raw_text': raw_text or '',
        'parsed_nutriments': parsed_payload.get('nutrition_data') or parsed_payload.get('parsed_nutriments') or {},
        'serving_size': parsed_payload.get('serving_size'),
        'confidence': parsed_payload.get('confidence', 0.0),
        'processing_details': parsed_payload.get('processing_details') or {}
    }
    return _normalize_legacy_ocr_result(payload, default_engine=engine_label)


async def _run_legacy_text_pipeline(legacy_ocr, image_path: str) -> Optional[dict]:
    """
    Execute the legacy OCR text extraction and parsing pipeline.

    Steps:
    1. Extract text from image
    2. Parse text for nutrition information
    3. Normalize result

    Returns normalized nutrition data or None if extraction fails.
    """
    extractor = _get_legacy_text_extractor(legacy_ocr)
    if extractor is None:
        return None
    raw_text = extractor(image_path)
    if inspect.isawaitable(raw_text):
        raw_text = await raw_text
    return await _parse_text_with_legacy_parser(legacy_ocr, raw_text or '', engine_label='legacy_ocr')


async def _normalize_external_payload(result, legacy_ocr, *, engine_label: str) -> Optional[dict]:
    """
    Normalize a result from external OCR service.

    Handles both dict (structured) and string (raw text) results.
    """
    if not result:
        return None
    if isinstance(result, dict):
        payload = dict(result)
        return _normalize_legacy_ocr_result(payload, default_engine=engine_label)
    if isinstance(result, str):
        return await _parse_text_with_legacy_parser(legacy_ocr, result, engine_label=engine_label)
    return None

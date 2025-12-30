"""
Product Services Package

Specialized modules for product operations:
- ocr_processor: OCR scanning and processing
- barcode_lookup: Barcode and OpenFoodFacts integration
- legacy_ocr_compat: Legacy OCR compatibility
- adapters: HTTP and backend adapters

Task: Phase 1 Tarea 3 - Product Helpers Refactoring
"""

# Import from adapters (HTTP and backend utilities)
from .adapters import (
    _coerce_exception_class,
    _ensure_request_context,
    _get_cache_backend,
    _get_httpx_attr,
    _get_httpx_exceptions,
    _get_openfoodfacts_backend,
    _is_http_exception,
    _raise_http_exception,
    _route_post,
)

# Import from barcode_lookup
from .barcode_lookup import get_product_by_barcode

# Import from legacy_ocr_compat
from .legacy_ocr_compat import (
    _get_legacy_parser_callable,
    _get_legacy_service,
    _get_legacy_text_extractor,
    _import_legacy_ocr,
    _normalize_external_payload,
    _normalize_legacy_ocr_result,
    _normalize_parsed_payload,
    _parse_text_with_legacy_parser,
    _run_legacy_text_pipeline,
)

# Import from ocr_processor
from .ocr_processor import (
    call_external_ocr,
    extract_nutrients_from_image,
    scan_label_with_external_ocr,
    scan_nutrition_label,
)

__all__ = [
    # Adapters
    "_coerce_exception_class",
    "_ensure_request_context",
    "_get_cache_backend",
    "_get_httpx_attr",
    "_get_httpx_exceptions",
    "_get_openfoodfacts_backend",
    "_is_http_exception",
    "_raise_http_exception",
    "_route_post",
    # Barcode
    "get_product_by_barcode",
    # Legacy OCR Compat
    "_get_legacy_parser_callable",
    "_get_legacy_service",
    "_get_legacy_text_extractor",
    "_import_legacy_ocr",
    "_normalize_external_payload",
    "_normalize_legacy_ocr_result",
    "_normalize_parsed_payload",
    "_parse_text_with_legacy_parser",
    "_run_legacy_text_pipeline",
    # OCR Processor
    "call_external_ocr",
    "extract_nutrients_from_image",
    "scan_label_with_external_ocr",
    "scan_nutrition_label",
]

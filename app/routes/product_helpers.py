"""
Product Helpers - Main Route Module

Orchestrates product operations by importing from specialized service modules.
Maintains backward compatibility with existing tests and route registration.

Task: Phase 1 Tarea 3 - Product Helpers Refactoring

Module Structure:
- product_services.ocr_processor: OCR scanning and processing
- product_services.barcode_lookup: Barcode and OpenFoodFacts integration
- product_services.legacy_ocr_compat: Legacy OCR compatibility
- product_services.adapters: HTTP and backend adapters
"""

# Try to import aiofiles for backward compatibility with tests
try:
    import aiofiles
except ImportError:
    aiofiles = None

# ─────────────────────────────────────────────────────────────
# Import from Specialized Modules
# ─────────────────────────────────────────────────────────────

# Legacy OCR Compatibility
from .product_services.legacy_ocr_compat import (
    _import_legacy_ocr,
    _get_legacy_service,
    _get_legacy_parser_callable,
    _get_legacy_text_extractor,
    _normalize_legacy_ocr_result,
    _normalize_parsed_payload,
    _parse_text_with_legacy_parser,
    _run_legacy_text_pipeline,
)

# OCR Processor
from .product_services.ocr_processor import (
    _run_local_ocr,
    extract_nutrients_from_image,
    call_external_ocr,
    scan_nutrition_label,
    scan_label_with_external_ocr,
)

# Barcode Lookup
from .product_services.barcode_lookup import (
    get_product_by_barcode,
)

# Backend Adapters
from .product_services.adapters import (
    _get_cache_backend,
    _get_openfoodfacts_backend,
    _coerce_exception_class,
    _get_httpx_attr,
    _get_httpx_exceptions,
    _raise_http_exception,
    _is_http_exception,
    _route_post,
    _ensure_request_context,
    _write_bytes_to_tempfile,
)

# Auth context re-exports for backward compatibility with tests
from app.services.auth import RequestContext, get_optional_request_context

# Database service re-export for backward compatibility with tests
from app.services.database import db_service


# ─────────────────────────────────────────────────────────────
# Re-exports for Backward Compatibility
# ─────────────────────────────────────────────────────────────

__all__ = [
    # Legacy OCR functions
    "_normalize_legacy_ocr_result",
    "_run_local_ocr",
    "extract_nutrients_from_image",
    "call_external_ocr",
    "_get_cache_backend",
    "_get_openfoodfacts_backend",
    "_coerce_exception_class",
    "_get_httpx_attr",
    "_get_httpx_exceptions",
    "_raise_http_exception",
    "_is_http_exception",
    "_route_post",
    "_ensure_request_context",
    "_write_bytes_to_tempfile",
    "_import_legacy_ocr",
    "_get_legacy_service",
    "_get_legacy_parser_callable",
    "_get_legacy_text_extractor",
    "_normalize_parsed_payload",
    "_parse_text_with_legacy_parser",
    "_run_legacy_text_pipeline",
    # Main routes
    "get_product_by_barcode",
    "scan_nutrition_label",
    "scan_label_with_external_ocr",
    # Utilities
    "aiofiles",
    # Auth context re-exports for backward compatibility with tests
    "RequestContext",
    "get_optional_request_context",
    # Database service re-export for backward compatibility with tests
    "db_service",
]

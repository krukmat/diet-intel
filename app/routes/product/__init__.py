"""
Product routes module
Combines product lookup, local scan, and external OCR routes
"""
from fastapi import APIRouter
from app.routes.product.product_routes import router as product_router
from app.routes.product.scan_routes import router as scan_router
from app.routes.product.ocr_routes import router as ocr_router

# Re-export everything from product_helpers for backward compatibility with tests
from app.routes.product_helpers import *

# Import specific route functions for re-export
from app.routes.product.product_routes import lookup_product_by_barcode as get_product_by_barcode
from app.routes.product.scan_routes import scan_nutrition_label
from app.routes.product.ocr_routes import scan_label_with_external_ocr

router = APIRouter()

# Include all sub-routers
router.include_router(product_router)
router.include_router(scan_router)
router.include_router(ocr_router)

__all__ = ["router", "get_product_by_barcode", "scan_nutrition_label", "scan_label_with_external_ocr"]

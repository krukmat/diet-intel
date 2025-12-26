"""
Product routes module
Combines product lookup, local scan, and external OCR routes
"""
from fastapi import APIRouter
from app.routes.product import product_routes, scan_routes, ocr_routes

router = APIRouter()

# Include all sub-routers
router.include_router(product_routes.router)
router.include_router(scan_routes.router)
router.include_router(ocr_routes.router)

__all__ = ["router"]

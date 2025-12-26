"""
Product lookup routes (barcode search)
Target: ~200 LOC, CC < 10
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from app.models.product import BarcodeRequest, ProductResponse, ErrorResponse
from app.services.openfoodfacts import openfoodfacts_service
from app.services.cache import cache_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/product", tags=["products"])


@router.post(
    "/by-barcode",
    response_model=ProductResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Product not found"},
        408: {"model": ErrorResponse, "description": "Request timeout"},
        503: {"model": ErrorResponse, "description": "Service unavailable"}
    }
)
async def lookup_product_by_barcode(request: BarcodeRequest):
    """
    Lookup product by barcode using OpenFoodFacts API
    CC target: 5

    Args:
        request: BarcodeRequest with barcode field

    Returns:
        ProductResponse with product data
    """
    barcode = (request.barcode or "").strip()

    # Validate barcode
    if not barcode:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Barcode cannot be empty",
        )

    if len(barcode) > 256:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Barcode exceeds maximum length",
        )

    # Try cache first
    cache_key = f"product:{barcode}"
    cached_product = await cache_service.get(cache_key)
    if cached_product:
        logger.info(f"Cache hit for barcode {barcode}")
        return ProductResponse(**cached_product)

    # Fetch from OpenFoodFacts
    try:
        product_data = await openfoodfacts_service.get_product(barcode)

        if not product_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with barcode {barcode} not found"
            )

        # Cache result (24 hours)
        await cache_service.set(cache_key, product_data, ttl_hours=24)
        logger.info(f"Successfully fetched and cached product for barcode: {barcode}")
        return ProductResponse(**product_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product {barcode}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch product"
        )

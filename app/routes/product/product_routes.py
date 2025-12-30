"""
Product lookup routes (barcode search)
Target: ~200 LOC, CC < 10
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from httpx import TimeoutException, RequestError
from app.models.product import BarcodeRequest, ProductResponse, ErrorResponse
from app.services.openfoodfacts import openfoodfacts_service
from app.services.cache import cache_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["products"])


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
        # Deserialize if it's a JSON string
        if isinstance(cached_product, str):
            import json
            try:
                cached_product = json.loads(cached_product)
            except (json.JSONDecodeError, ValueError):
                # If deserialization fails, treat as cache miss
                cached_product = None
        if cached_product and isinstance(cached_product, dict):
            return ProductResponse(**cached_product)

    # Fetch from OpenFoodFacts
    try:
        product_data = await openfoodfacts_service.get_product(barcode)

        if not product_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with barcode {barcode} not found"
            )

        # Cache result (24 hours) - convert to dict for caching
        product_dict = product_data.model_dump(mode="json") if hasattr(product_data, "model_dump") else product_data
        await cache_service.set(cache_key, product_dict, ttl_hours=24)
        logger.info(f"Successfully fetched and cached product for barcode: {barcode}")
        return product_data

    except HTTPException:
        raise
    except TimeoutException as e:
        logger.error(f"Timeout fetching product {barcode}: {e}")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Request timeout while fetching product"
        )
    except RequestError as e:
        logger.error(f"Network error fetching product {barcode}: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Network error while fetching product"
        )
    except Exception as e:
        logger.error(f"Error fetching product {barcode}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch product"
        )

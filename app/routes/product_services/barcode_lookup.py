"""
Barcode Lookup Service

Handles product lookup by barcode using OpenFoodFacts API with caching.
Task: Phase 1 Tarea 3 - Product Helpers Refactoring
"""

import logging
import re
from datetime import datetime
from typing import Optional

from fastapi import Depends, File, UploadFile, status
from app.models.product import BarcodeRequest, ProductResponse, ErrorResponse
from app.services.auth import RequestContext, get_optional_request_context
from app.services.database import db_service
from app.repositories.product_repository import ProductRepository
from app.models.product import Product
from app.services.analytics_service import AnalyticsService

from .adapters import (
    _get_cache_backend,
    _get_openfoodfacts_backend,
    _ensure_request_context,
    _raise_http_exception,
    _is_http_exception,
    _get_httpx_exceptions,
    _route_post
)

logger = logging.getLogger(__name__)

# Initialize analytics service for logging
analytics_service = AnalyticsService(db_service)


# ─────────────────────────────────────────────────────────────
# Barcode Lookup Route
# ─────────────────────────────────────────────────────────────


@_route_post(
    "/by-barcode",
    response_model=ProductResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Product not found"},
        408: {"model": ErrorResponse, "description": "Request timeout"},
        503: {"model": ErrorResponse, "description": "Service unavailable"}
    }
)
async def get_product_by_barcode(
    request: BarcodeRequest,
    context: RequestContext = Depends(get_optional_request_context)
):
    """
    Look up product by barcode using OpenFoodFacts API.

    - Validates barcode format
    - Checks cache first
    - Fetches from OpenFoodFacts if not cached
    - Stores result in database and cache
    - Logs analytics events
    """
    context = _ensure_request_context(context)
    raw_barcode = request.barcode or ""
    barcode = raw_barcode.strip()
    cache = _get_cache_backend()
    product_client = _get_openfoodfacts_backend()

    # Validate barcode
    if not barcode:
        raise _raise_http_exception(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Barcode cannot be empty",
        )

    if len(barcode) > 256:
        raise _raise_http_exception(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Barcode exceeds maximum length",
        )

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", barcode):
        raise _raise_http_exception(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Barcode contains invalid characters",
        )

    start_time = datetime.now()
    user_id = context.user_id
    session_id = context.session_id
    timeout_exc, request_error_exc = _get_httpx_exceptions()

    try:
        # Check cache
        cache_key = f"product:{barcode}"
        cached_product = await cache.get(cache_key)
        if cached_product:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await analytics_service.log_product_lookup(
                user_id, session_id, barcode, cached_product.get('name'),
                True, response_time, "Cache"
            )
            logger.info(f"Returning cached product for barcode: {barcode}")
            return ProductResponse(**cached_product)

        # Fetch from external API
        try:
            product = await product_client.get_product(barcode)
        except timeout_exc:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await analytics_service.log_product_lookup(
                user_id, session_id, barcode, None,
                False, response_time, "OpenFoodFacts", "Timeout"
            )
            logger.error(f"Timeout fetching product for barcode: {barcode}")
            raise _raise_http_exception(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail="Request timeout while fetching product data"
            )
        except request_error_exc as e:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await analytics_service.log_product_lookup(
                user_id, session_id, barcode, None,
                False, response_time, "OpenFoodFacts", f"Network error: {str(e)}"
            )
            logger.error(f"Network error fetching product for barcode {barcode}: {e}")
            raise _raise_http_exception(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to connect to product database"
            )
        except Exception as api_error:
            # Log API error and convert to appropriate HTTP status
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await analytics_service.log_product_lookup(
                user_id, session_id, barcode, None,
                False, response_time, "OpenFoodFacts", f"API error: {str(api_error)}"
            )
            logger.warning(f"OpenFoodFacts API error for barcode {barcode}: {api_error}")
            raise _raise_http_exception(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Product lookup service temporarily unavailable"
            )

        if product is None:
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            await analytics_service.log_product_lookup(
                user_id, session_id, barcode, None,
                False, response_time, "OpenFoodFacts", "Product not found"
            )
            raise _raise_http_exception(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with barcode {barcode} not found"
            )

        # Store in database and cache
        product_dict = product.model_dump()
        await cache.set(cache_key, product_dict, ttl_hours=24)

        # Store in database for future lookups using Repository Pattern
        try:
            product_repo = ProductRepository()
            product_entity = Product(
                barcode=product.barcode,
                name=product.name,
                brand=product.brand,
                serving_size=product.serving_size,
                nutriments=product_dict.get('nutriments', {})
            )
            await product_repo.create(product_entity)
        except Exception as e:
            # Log but don't fail if database storage fails - cache is sufficient
            logger.warning(f"Failed to store product {product.barcode} in database: {e}")

        response_time = int((datetime.now() - start_time).total_seconds() * 1000)
        await analytics_service.log_product_lookup(
            user_id, session_id, barcode, product.name,
            True, response_time, "OpenFoodFacts"
        )
        await analytics_service.log_user_product_interaction(
            user_id, session_id, barcode, "lookup", "api_fetch"
        )

        logger.info(f"Successfully fetched, stored, and cached product for barcode: {barcode}")
        return product
    except Exception as exc:
        if _is_http_exception(exc):
            raise exc
        response_time = int((datetime.now() - start_time).total_seconds() * 1000)
        await analytics_service.log_product_lookup(
            user_id, session_id, barcode, None,
            False, response_time, "System", f"Unexpected error: {str(exc)}"
        )
        logger.error(f"Unexpected error fetching product for barcode {barcode}: {exc}", exc_info=True)
        raise _raise_http_exception(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

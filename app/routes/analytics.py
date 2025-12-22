import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query
from app.services.database import db_service
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)
router = APIRouter()

# Task: Phase 2 Batch 6 - Analytics Service Extraction
analytics_service = AnalyticsService(db_service)


@router.get("/summary")
async def get_analytics_summary(
    user_id: Optional[str] = Query(None, description="User ID for user-specific analytics"),
    days: int = Query(7, description="Number of days to analyze", ge=1, le=365)
):
    """
    Get analytics summary for product lookups and OCR scans
    """
    try:
        summary = await analytics_service.get_analytics_summary(user_id=user_id, days=days)
        return summary
        
    except Exception as e:
        logger.error(f"Error fetching analytics summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching analytics data"
        )


@router.get("/product-lookups")
async def get_product_lookup_stats(
    user_id: Optional[str] = Query(None, description="User ID for user-specific stats"),
    limit: int = Query(100, description="Maximum number of records", ge=1, le=1000)
):
    """
    Get recent product lookup statistics
    """
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT barcode, product_name, success, response_time_ms, 
                       source, timestamp, error_message
                FROM user_product_lookups 
            """
            params = []
            
            if user_id:
                query += "WHERE user_id = ? "
                params.append(user_id)
                
            query += "ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return {
                "lookups": [dict(row) for row in rows],
                "total_returned": len(rows)
            }
            
    except Exception as e:
        logger.error(f"Error fetching product lookup stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching lookup statistics"
        )


@router.get("/ocr-scans")
async def get_ocr_scan_stats(
    user_id: Optional[str] = Query(None, description="User ID for user-specific stats"),
    limit: int = Query(100, description="Maximum number of records", ge=1, le=1000)
):
    """
    Get recent OCR scan statistics
    """
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT image_size, confidence_score, processing_time_ms, 
                       ocr_engine, nutrients_extracted, success, timestamp, error_message
                FROM ocr_scan_analytics 
            """
            params = []
            
            if user_id:
                query += "WHERE user_id = ? "
                params.append(user_id)
                
            query += "ORDER BY timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return {
                "scans": [dict(row) for row in rows],
                "total_returned": len(rows)
            }
            
    except Exception as e:
        logger.error(f"Error fetching OCR scan stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching scan statistics"
        )


@router.get("/top-products")
async def get_top_products(
    limit: int = Query(20, description="Maximum number of products", ge=1, le=100)
):
    """
    Get most frequently accessed products
    """
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT barcode, name, brand, access_count, last_updated
                FROM products 
                ORDER BY access_count DESC 
                LIMIT ?
            """, (limit,))
            
            rows = cursor.fetchall()
            return {
                "products": [dict(row) for row in rows],
                "total_returned": len(rows)
            }
            
    except Exception as e:
        logger.error(f"Error fetching top products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching top products"
        )


@router.get("/user-interactions")
async def get_user_interactions(
    user_id: Optional[str] = Query(None, description="User ID for user-specific interactions"),
    barcode: Optional[str] = Query(None, description="Filter by specific product barcode"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, description="Maximum number of records", ge=1, le=1000)
):
    """
    Get user product interaction history
    """
    try:
        with db_service.get_connection() as conn:
            cursor = conn.cursor()
            
            query = """
                SELECT uph.barcode, uph.action, uph.context, uph.timestamp,
                       p.name as product_name, p.brand
                FROM user_product_history uph
                LEFT JOIN products p ON uph.barcode = p.barcode
            """
            params = []
            conditions = []
            
            if user_id:
                conditions.append("uph.user_id = ?")
                params.append(user_id)
            
            if barcode:
                conditions.append("uph.barcode = ?")
                params.append(barcode)
                
            if action:
                conditions.append("uph.action = ?")
                params.append(action)
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
                
            query += " ORDER BY uph.timestamp DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return {
                "interactions": [dict(row) for row in rows],
                "total_returned": len(rows)
            }
            
    except Exception as e:
        logger.error(f"Error fetching user interactions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error fetching user interactions"
        )
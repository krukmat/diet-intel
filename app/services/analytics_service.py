"""Analytics Service - Handles analytics and logging operations.

Task: Phase 2 Batch 6 - Database refactoring (extracted from database.py)
Coverage Goal: 88%+ (target: 80%+)
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import uuid
import logging
from app.services.database import DatabaseService


logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for managing analytics and user interaction tracking.

    Handles:
    - Product lookup logging (barcode searches, success/failure tracking)
    - OCR scan logging (image processing, confidence scoring)
    - User-product interaction logging (view, add_to_cart, purchase)
    - Analytics summary aggregation (lookup stats, OCR stats, top products)
    """

    def __init__(self, db_service: DatabaseService):
        """Initialize AnalyticsService with database dependency.

        Args:
            db_service: DatabaseService instance for database operations

        Task: Phase 2 Batch 6 - Analytics Service Extraction
        """
        self.db = db_service

    async def log_product_lookup(
        self,
        user_id: Optional[str],
        session_id: Optional[str],
        barcode: str,
        product_name: Optional[str],
        success: bool,
        response_time_ms: Optional[int],
        source: Optional[str],
        error_message: Optional[str] = None
    ) -> str:
        """Log a product lookup for analytics.

        Args:
            user_id: User identifier (optional for anonymous lookups)
            session_id: Session identifier
            barcode: Product barcode
            product_name: Product name (if found)
            success: Whether the lookup was successful
            response_time_ms: Response time in milliseconds
            source: API source (e.g., 'OpenFoodFacts')
            error_message: Error message if lookup failed

        Returns:
            Created lookup record ID

        Coverage Goal: Test successful/failed lookups, response time tracking, anonymous users

        Task: Phase 2 Batch 6 - Analytics Service Extraction
        """
        lookup_id = str(uuid.uuid4())

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_product_lookups
                (id, user_id, session_id, barcode, product_name, success, response_time_ms, source, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    lookup_id,
                    user_id,
                    session_id,
                    barcode,
                    product_name,
                    success,
                    response_time_ms,
                    source,
                    error_message,
                ),
            )
            conn.commit()

        logger.info(
            f"Logged product lookup {lookup_id}: barcode={barcode}, success={success}, response_time_ms={response_time_ms}"
        )
        return lookup_id

    async def log_ocr_scan(
        self,
        user_id: Optional[str],
        session_id: Optional[str],
        image_size: Optional[int],
        confidence_score: Optional[float],
        processing_time_ms: Optional[int],
        ocr_engine: Optional[str],
        nutrients_extracted: int,
        success: bool,
        error_message: Optional[str] = None,
    ) -> str:
        """Log an OCR scan for analytics.

        Args:
            user_id: User identifier
            session_id: Session identifier
            image_size: Size of the image in bytes
            confidence_score: Confidence score of OCR extraction (0.0-1.0)
            processing_time_ms: Processing time in milliseconds
            ocr_engine: OCR engine used (e.g., 'Tesseract', 'external')
            nutrients_extracted: Number of nutrients successfully extracted
            success: Whether the OCR scan was successful
            error_message: Error message if scan failed

        Returns:
            Created OCR scan record ID

        Coverage Goal: Test successful/failed scans, confidence tracking, processing metrics

        Task: Phase 2 Batch 6 - Analytics Service Extraction
        """
        scan_id = str(uuid.uuid4())

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO ocr_scan_analytics
                (id, user_id, session_id, image_size, confidence_score, processing_time_ms,
                 ocr_engine, nutrients_extracted, success, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    scan_id,
                    user_id,
                    session_id,
                    image_size,
                    confidence_score,
                    processing_time_ms,
                    ocr_engine,
                    nutrients_extracted,
                    success,
                    error_message,
                ),
            )
            conn.commit()

        logger.info(
            f"Logged OCR scan {scan_id}: success={success}, confidence={confidence_score}, processing_time_ms={processing_time_ms}"
        )
        return scan_id

    async def log_user_product_interaction(
        self,
        user_id: Optional[str],
        session_id: Optional[str],
        barcode: str,
        action: str,
        context: Optional[str] = None,
    ) -> str:
        """Log a user's interaction with a product.

        Args:
            user_id: User identifier
            session_id: Session identifier
            barcode: Product barcode
            action: Action type (e.g., 'view', 'add_to_cart', 'purchase')
            context: Additional context about the interaction (optional)

        Returns:
            Created interaction record ID

        Coverage Goal: Test different action types, context serialization

        Task: Phase 2 Batch 6 - Analytics Service Extraction
        """
        interaction_id = str(uuid.uuid4())

        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_product_history
                (id, user_id, session_id, barcode, action, context)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (interaction_id, user_id, session_id, barcode, action, context),
            )
            conn.commit()

        logger.info(
            f"Logged user interaction {interaction_id}: user={user_id}, action={action}, barcode={barcode}"
        )
        return interaction_id

    async def get_analytics_summary(
        self, user_id: Optional[str] = None, days: int = 7
    ) -> dict:
        """Get analytics summary for the specified period.

        Args:
            user_id: Optional user identifier for user-specific analytics. If None, returns global analytics.
            days: Number of days to look back (default: 7)

        Returns:
            Dictionary with:
            - period_days: Number of days in the summary period
            - product_lookups: Dict with total, successful, success_rate, avg_response_time_ms
            - ocr_scans: Dict with total, successful, success_rate, avg_confidence, avg_processing_time_ms
            - top_products: List of top 10 most accessed products

        Coverage Goal: Test global vs user-specific, period calculations, empty data handling, success rate math

        Task: Phase 2 Batch 6 - Analytics Service Extraction
        """
        since_date = (datetime.now() - timedelta(days=days)).isoformat()

        with self.db.get_connection() as conn:
            cursor = conn.cursor()

            # Product lookup stats
            lookup_filter = (
                "WHERE timestamp >= ?"
                if user_id is None
                else "WHERE user_id = ? AND timestamp >= ?"
            )
            lookup_params = (
                (since_date,) if user_id is None else (user_id, since_date)
            )

            cursor.execute(
                f"""
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
                       AVG(response_time_ms) as avg_response_time
                FROM user_product_lookups {lookup_filter}
            """,
                lookup_params,
            )
            lookup_stats = cursor.fetchone()

            # OCR scan stats
            ocr_filter = (
                "WHERE timestamp >= ?"
                if user_id is None
                else "WHERE user_id = ? AND timestamp >= ?"
            )
            ocr_params = (
                (since_date,) if user_id is None else (user_id, since_date)
            )

            cursor.execute(
                f"""
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
                       AVG(confidence_score) as avg_confidence,
                       AVG(processing_time_ms) as avg_processing_time
                FROM ocr_scan_analytics {ocr_filter}
            """,
                ocr_params,
            )
            ocr_stats = cursor.fetchone()

            # Most accessed products
            cursor.execute(
                """
                SELECT name, brand, access_count
                FROM products
                ORDER BY access_count DESC
                LIMIT 10
            """
            )
            top_products = cursor.fetchall()

            return {
                "period_days": days,
                "product_lookups": {
                    "total": lookup_stats["total"] or 0,
                    "successful": lookup_stats["successful"] or 0,
                    "success_rate": (lookup_stats["successful"] or 0)
                    / max(lookup_stats["total"] or 1, 1),
                    "avg_response_time_ms": lookup_stats["avg_response_time"] or 0,
                },
                "ocr_scans": {
                    "total": ocr_stats["total"] or 0,
                    "successful": ocr_stats["successful"] or 0,
                    "success_rate": (ocr_stats["successful"] or 0)
                    / max(ocr_stats["total"] or 1, 1),
                    "avg_confidence": ocr_stats["avg_confidence"] or 0,
                    "avg_processing_time_ms": ocr_stats["avg_processing_time"] or 0,
                },
                "top_products": [dict(row) for row in top_products],
            }

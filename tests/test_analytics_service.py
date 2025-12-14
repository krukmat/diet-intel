"""Analytics Service Tests - Phase 2 Batch 6 refactoring.

Coverage Goal: 88%+ on analytics_service.py
Task: Phase 2 Batch 6 - Database refactoring
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, Mock
from datetime import datetime, timedelta
from typing import Dict, Any

from app.services.analytics_service import AnalyticsService
from app.services.database import DatabaseService


@pytest.mark.asyncio
class TestAnalyticsService:
    """Test suite for AnalyticsService."""

    @pytest.fixture
    def mock_db_service(self):
        """Create a mock DatabaseService."""
        mock = MagicMock(spec=DatabaseService)
        mock.get_connection = MagicMock()
        return mock

    @pytest.fixture
    def analytics_service(self, mock_db_service):
        """Create an AnalyticsService instance with mocked database."""
        return AnalyticsService(mock_db_service)

    def _mock_row(self, data: Dict[str, Any]) -> Dict:
        """Create a dict-like mock row."""
        class MockRow(dict):
            pass
        return MockRow(data)

    # ===== LOG PRODUCT LOOKUP TESTS =====

    async def test_log_product_lookup_success(self, analytics_service, mock_db_service):
        """Test successful product lookup logging."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_product_lookup(
            user_id="user_123",
            session_id="session_456",
            barcode="1234567890",
            product_name="Test Product",
            success=True,
            response_time_ms=150,
            source="OpenFoodFacts"
        )

        assert result is not None
        assert len(result) == 36  # UUID4 length
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_log_product_lookup_failed(self, analytics_service, mock_db_service):
        """Test logging of failed product lookup."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_product_lookup(
            user_id="user_123",
            session_id="session_456",
            barcode="9999999999",
            product_name=None,
            success=False,
            response_time_ms=500,
            source="OpenFoodFacts",
            error_message="Product not found"
        )

        assert result is not None
        assert len(result) == 36
        assert mock_cursor.execute.called

    async def test_log_product_lookup_anonymous(self, analytics_service, mock_db_service):
        """Test logging product lookup for anonymous user."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_product_lookup(
            user_id=None,
            session_id="session_789",
            barcode="1234567890",
            product_name="Test Product",
            success=True,
            response_time_ms=200,
            source="OpenFoodFacts"
        )

        assert result is not None
        assert len(result) == 36

    async def test_log_product_lookup_response_time_tracking(self, analytics_service, mock_db_service):
        """Test that response times are tracked correctly."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        await analytics_service.log_product_lookup(
            user_id="user_123",
            session_id="session_456",
            barcode="1234567890",
            product_name="Test Product",
            success=True,
            response_time_ms=350,
            source="OpenFoodFacts"
        )

        # Verify the response time is recorded
        args, kwargs = mock_cursor.execute.call_args
        # Check that 350 is in the SQL parameters
        assert 350 in args[1] or any(arg == 350 for arg in args[1] if arg is not None)

    # ===== LOG OCR SCAN TESTS =====

    async def test_log_ocr_scan_success(self, analytics_service, mock_db_service):
        """Test successful OCR scan logging."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_ocr_scan(
            user_id="user_123",
            session_id="session_456",
            image_size=50000,
            confidence_score=0.92,
            processing_time_ms=300,
            ocr_engine="Tesseract",
            nutrients_extracted=6,
            success=True
        )

        assert result is not None
        assert len(result) == 36
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_log_ocr_scan_failed(self, analytics_service, mock_db_service):
        """Test logging of failed OCR scan."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_ocr_scan(
            user_id="user_123",
            session_id="session_456",
            image_size=100000,
            confidence_score=0.35,
            processing_time_ms=800,
            ocr_engine="Tesseract",
            nutrients_extracted=2,
            success=False,
            error_message="Low confidence score"
        )

        assert result is not None
        assert len(result) == 36

    async def test_log_ocr_scan_confidence_tracking(self, analytics_service, mock_db_service):
        """Test that confidence scores are tracked correctly."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        await analytics_service.log_ocr_scan(
            user_id="user_123",
            session_id="session_456",
            image_size=50000,
            confidence_score=0.88,
            processing_time_ms=250,
            ocr_engine="Tesseract",
            nutrients_extracted=6,
            success=True
        )

        args, kwargs = mock_cursor.execute.call_args
        # Verify confidence_score is in parameters
        assert 0.88 in args[1] or any(arg == 0.88 for arg in args[1] if arg is not None)

    async def test_log_ocr_scan_processing_time_tracking(self, analytics_service, mock_db_service):
        """Test that processing times are tracked correctly."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        await analytics_service.log_ocr_scan(
            user_id="user_123",
            session_id="session_456",
            image_size=50000,
            confidence_score=0.90,
            processing_time_ms=450,
            ocr_engine="Tesseract",
            nutrients_extracted=6,
            success=True
        )

        args, kwargs = mock_cursor.execute.call_args
        assert 450 in args[1] or any(arg == 450 for arg in args[1] if arg is not None)

    # ===== LOG USER PRODUCT INTERACTION TESTS =====

    async def test_log_user_product_interaction_view(self, analytics_service, mock_db_service):
        """Test logging a product view interaction."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_user_product_interaction(
            user_id="user_123",
            session_id="session_456",
            barcode="1234567890",
            action="view"
        )

        assert result is not None
        assert len(result) == 36
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    async def test_log_user_product_interaction_add_to_cart(self, analytics_service, mock_db_service):
        """Test logging an add to cart interaction."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_user_product_interaction(
            user_id="user_123",
            session_id="session_456",
            barcode="1234567890",
            action="add_to_cart",
            context="quantity=2"
        )

        assert result is not None
        assert len(result) == 36

    async def test_log_user_product_interaction_purchase(self, analytics_service, mock_db_service):
        """Test logging a purchase interaction."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.log_user_product_interaction(
            user_id="user_123",
            session_id="session_456",
            barcode="1234567890",
            action="purchase",
            context="transaction_id=txn_789"
        )

        assert result is not None
        assert len(result) == 36

    # ===== GET ANALYTICS SUMMARY TESTS =====

    async def test_get_analytics_summary_global(self, analytics_service, mock_db_service):
        """Test getting global analytics summary."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # Mock lookup stats
        lookup_stats = self._mock_row({
            'total': 100,
            'successful': 85,
            'avg_response_time': 250.5
        })

        # Mock OCR stats
        ocr_stats = self._mock_row({
            'total': 50,
            'successful': 45,
            'avg_confidence': 0.88,
            'avg_processing_time': 350.0
        })

        # Mock top products
        top_products = [
            self._mock_row({'name': 'Product A', 'brand': 'Brand A', 'access_count': 500}),
            self._mock_row({'name': 'Product B', 'brand': 'Brand B', 'access_count': 300}),
        ]

        mock_cursor.fetchone.side_effect = [lookup_stats, ocr_stats]
        mock_cursor.fetchall.return_value = top_products
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.get_analytics_summary()

        assert result is not None
        assert result['period_days'] == 7
        assert result['product_lookups']['total'] == 100
        assert result['product_lookups']['successful'] == 85
        assert result['ocr_scans']['total'] == 50
        assert len(result['top_products']) == 2

    async def test_get_analytics_summary_user_specific(self, analytics_service, mock_db_service):
        """Test getting user-specific analytics summary."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        lookup_stats = self._mock_row({
            'total': 20,
            'successful': 18,
            'avg_response_time': 220.0
        })

        ocr_stats = self._mock_row({
            'total': 10,
            'successful': 9,
            'avg_confidence': 0.91,
            'avg_processing_time': 300.0
        })

        top_products = [
            self._mock_row({'name': 'Product A', 'brand': 'Brand A', 'access_count': 50}),
        ]

        mock_cursor.fetchone.side_effect = [lookup_stats, ocr_stats]
        mock_cursor.fetchall.return_value = top_products
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.get_analytics_summary(user_id="user_123")

        assert result is not None
        assert result['product_lookups']['total'] == 20
        assert result['product_lookups']['successful'] == 18

    async def test_get_analytics_summary_custom_period(self, analytics_service, mock_db_service):
        """Test getting analytics summary for custom time period."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        lookup_stats = self._mock_row({
            'total': 500,
            'successful': 450,
            'avg_response_time': 240.0
        })

        ocr_stats = self._mock_row({
            'total': 200,
            'successful': 180,
            'avg_confidence': 0.85,
            'avg_processing_time': 360.0
        })

        mock_cursor.fetchone.side_effect = [lookup_stats, ocr_stats]
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.get_analytics_summary(days=30)

        assert result is not None
        assert result['period_days'] == 30
        assert result['product_lookups']['total'] == 500

    async def test_get_analytics_summary_success_rate_calculation(self, analytics_service, mock_db_service):
        """Test that success rates are calculated correctly."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        lookup_stats = self._mock_row({
            'total': 100,
            'successful': 85,
            'avg_response_time': 250.0
        })

        ocr_stats = self._mock_row({
            'total': 100,
            'successful': 90,
            'avg_confidence': 0.88,
            'avg_processing_time': 350.0
        })

        mock_cursor.fetchone.side_effect = [lookup_stats, ocr_stats]
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.get_analytics_summary()

        # Test success rate calculations
        assert result['product_lookups']['success_rate'] == 0.85  # 85/100
        assert result['ocr_scans']['success_rate'] == 0.90  # 90/100

    async def test_get_analytics_summary_empty_data(self, analytics_service, mock_db_service):
        """Test analytics summary with empty data (division by zero handling)."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        lookup_stats = self._mock_row({
            'total': 0,
            'successful': 0,
            'avg_response_time': None
        })

        ocr_stats = self._mock_row({
            'total': 0,
            'successful': 0,
            'avg_confidence': None,
            'avg_processing_time': None
        })

        mock_cursor.fetchone.side_effect = [lookup_stats, ocr_stats]
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.get_analytics_summary()

        # Should not raise division by zero error
        assert result is not None
        assert result['product_lookups']['total'] == 0
        assert result['product_lookups']['success_rate'] == 0.0  # 0/1 due to max() guard
        assert result['ocr_scans']['total'] == 0
        assert result['ocr_scans']['success_rate'] == 0.0

    async def test_get_analytics_summary_top_products_ordering(self, analytics_service, mock_db_service):
        """Test that top products are ordered by access count."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        lookup_stats = self._mock_row({
            'total': 100,
            'successful': 85,
            'avg_response_time': 250.0
        })

        ocr_stats = self._mock_row({
            'total': 50,
            'successful': 45,
            'avg_confidence': 0.88,
            'avg_processing_time': 350.0
        })

        top_products = [
            self._mock_row({'name': 'Product A', 'brand': 'Brand A', 'access_count': 1000}),
            self._mock_row({'name': 'Product B', 'brand': 'Brand B', 'access_count': 800}),
            self._mock_row({'name': 'Product C', 'brand': 'Brand C', 'access_count': 600}),
        ]

        mock_cursor.fetchone.side_effect = [lookup_stats, ocr_stats]
        mock_cursor.fetchall.return_value = top_products
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        result = await analytics_service.get_analytics_summary()

        assert len(result['top_products']) == 3
        assert result['top_products'][0]['access_count'] == 1000
        assert result['top_products'][1]['access_count'] == 800
        assert result['top_products'][2]['access_count'] == 600

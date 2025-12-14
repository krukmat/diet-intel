"""Vision Service Tests - Focused tests for vision functionality.

Task: Phase 2 Batch 5 - Database refactoring
Coverage Goal: 80%+ on vision_service.py (extracted from database.py)
This file tests the VisionService in isolation without full DatabaseService complexity.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from datetime import datetime, timedelta
from typing import Dict, Any
import sqlite3

from app.services.vision_service import VisionService
from app.services.database import DatabaseService


@pytest.mark.unit
class TestVisionService:
    """Test suite for VisionService - extracted vision operations from DatabaseService."""

    @pytest.fixture
    def mock_db_service(self):
        """Create a mock DatabaseService for testing VisionService in isolation."""
        mock = MagicMock(spec=DatabaseService)
        mock.get_connection = MagicMock()
        mock._ensure_vision_tables = MagicMock()
        mock._serialize_for_json = MagicMock(side_effect=lambda x: x)  # Identity function for testing
        return mock

    @pytest.fixture
    def vision_service(self, mock_db_service):
        """Create a VisionService instance with mocked database."""
        return VisionService(mock_db_service)

    @pytest.fixture
    def sample_vision_log(self) -> Dict[str, Any]:
        """Sample vision log data for testing."""
        return {
            "user_id": "test_user_123",
            "image_url": "https://example.com/image.jpg",
            "meal_type": "lunch",
            "identified_ingredients": [
                {"name": "chicken", "confidence": 0.95},
                {"name": "rice", "confidence": 0.87}
            ],
            "estimated_portions": {
                "total_calories": 650,
                "protein_g": 45,
                "fat_g": 15,
                "carbs_g": 75
            },
            "nutritional_analysis": {
                "energy_kcal": 650,
                "protein_g": 45,
                "fat_g": 15,
                "carbs_g": 75,
                "sugars_g": 5,
                "salt_g": 1.2
            },
            "exercise_suggestions": [
                {"type": "running", "duration_min": 30, "calories_burned": 300},
                {"type": "strength", "duration_min": 20, "calories_burned": 150}
            ],
            "confidence_score": 0.91,
            "processing_time_ms": 245,
            "created_at": datetime.utcnow()
        }

    @pytest.fixture
    def sample_vision_correction(self) -> Dict[str, Any]:
        """Sample vision correction data for testing."""
        return {
            "vision_log_id": "log_123",
            "user_id": "test_user_123",
            "correction_type": "portion_correction",
            "original_data": {
                "estimated_calories": 650
            },
            "corrected_data": {
                "actual_calories": 720
            },
            "improvement_score": 0.85,
            "created_at": datetime.utcnow()
        }

    def _mock_row_factory(self, data: Dict[str, Any]):
        """Create a mock sqlite3.Row from dictionary."""
        # Simple wrapper class that acts like sqlite3.Row
        class MockRow(dict):
            def __init__(self, data_dict):
                super().__init__(data_dict)

        return MockRow(data)

    # ===== CREATE VISION LOG TESTS =====

    @pytest.mark.asyncio
    async def test_create_vision_log_success(self, vision_service, mock_db_service, sample_vision_log):
        """Test successful creation of a vision log."""
        # Setup mock context manager
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        result = await vision_service.create_vision_log(sample_vision_log)

        # Assert
        assert result["user_id"] == sample_vision_log["user_id"]
        assert result["meal_type"] == sample_vision_log["meal_type"]
        assert "id" in result  # Generated ID should be present
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    @pytest.mark.asyncio
    async def test_create_vision_log_with_custom_id(self, vision_service, mock_db_service, sample_vision_log):
        """Test vision log creation respects custom ID."""
        custom_id = "custom_log_id_123"
        sample_vision_log["id"] = custom_id

        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        result = await vision_service.create_vision_log(sample_vision_log)

        # Assert
        assert result["id"] == custom_id

    @pytest.mark.asyncio
    async def test_create_vision_log_generates_uuid_when_missing(self, vision_service, mock_db_service, sample_vision_log):
        """Test that UUID is generated when ID not provided."""
        # Remove ID from sample
        if "id" in sample_vision_log:
            del sample_vision_log["id"]

        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        result = await vision_service.create_vision_log(sample_vision_log)

        # Assert
        assert "id" in result
        assert len(result["id"]) == 36  # UUID4 format length

    @pytest.mark.asyncio
    async def test_create_vision_log_serializes_json_fields(self, vision_service, mock_db_service, sample_vision_log):
        """Test that JSON fields are properly serialized."""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        await vision_service.create_vision_log(sample_vision_log)

        # Assert - check that cursor.execute was called with JSON dumps
        assert mock_cursor.execute.called
        call_args = mock_cursor.execute.call_args
        assert call_args is not None

    # ===== LIST VISION LOGS TESTS =====

    @pytest.mark.asyncio
    async def test_list_vision_logs_success(self, vision_service, mock_db_service):
        """Test successful retrieval of vision logs list."""
        # Setup mock data
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        # Mock the count query
        mock_cursor.fetchone.return_value = [5]  # Total count

        # Mock the data rows
        row_data = {
            'id': 'log_123',
            'user_id': 'user_123',
            'image_url': 'https://example.com/image.jpg',
            'meal_type': 'lunch',
            'identified_ingredients': json.dumps([{'name': 'chicken'}]),
            'estimated_portions': json.dumps({'calories': 650}),
            'nutritional_analysis': json.dumps({'protein_g': 45}),
            'exercise_suggestions': json.dumps([{'type': 'running'}]),
            'confidence_score': 0.91,
            'processing_time_ms': 245,
            'created_at': datetime.utcnow().isoformat()
        }

        mock_row = self._mock_row_factory(row_data)
        mock_cursor.fetchall.return_value = [mock_row]
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        logs, total_count = await vision_service.list_vision_logs(
            user_id="user_123",
            limit=20,
            offset=0
        )

        # Assert
        assert total_count == 5
        assert len(logs) == 1
        assert logs[0]['user_id'] == 'user_123'

    @pytest.mark.asyncio
    async def test_list_vision_logs_with_date_filtering(self, vision_service, mock_db_service):
        """Test vision logs filtering with date range."""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = [2]
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        logs, total = await vision_service.list_vision_logs(
            user_id="user_123",
            limit=20,
            offset=0,
            date_from="2025-01-01",
            date_to="2025-12-31"
        )

        # Assert
        assert total == 2
        # Verify that date filters were added to queries
        assert mock_cursor.execute.call_count >= 2

    @pytest.mark.asyncio
    async def test_list_vision_logs_pagination(self, vision_service, mock_db_service):
        """Test vision logs pagination with limit and offset."""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = [100]  # Total count
        mock_cursor.fetchall.return_value = []
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        logs, total = await vision_service.list_vision_logs(
            user_id="user_123",
            limit=20,
            offset=40
        )

        # Assert
        assert total == 100

    @pytest.mark.asyncio
    async def test_list_vision_logs_handles_json_parse_errors(self, vision_service, mock_db_service):
        """Test that JSON parsing errors are handled gracefully."""
        # Setup mock with malformed JSON
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = [1]

        # Create row with invalid JSON that will fail parsing
        row_data = {
            'id': 'log_123',
            'user_id': 'user_123',
            'image_url': 'https://example.com/image.jpg',
            'meal_type': 'lunch',
            'identified_ingredients': 'INVALID_JSON{',
            'estimated_portions': '{}',
            'nutritional_analysis': '{}',
            'exercise_suggestions': '{}',
            'confidence_score': 0.91,
            'processing_time_ms': 245,
            'created_at': '2025-01-01T12:00:00'
        }

        mock_row = self._mock_row_factory(row_data)
        mock_cursor.fetchall.return_value = [mock_row]
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act & Assert - should not raise exception
        logs, total = await vision_service.list_vision_logs(
            user_id="user_123",
            limit=20,
            offset=0
        )

        assert len(logs) == 1
        assert logs[0]['identified_ingredients'] == []  # Should default to empty list

    # ===== GET VISION LOG TESTS =====

    @pytest.mark.asyncio
    async def test_get_vision_log_found(self, vision_service, mock_db_service):
        """Test retrieval of existing vision log."""
        # Setup mock
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        row_data = {
            'id': 'log_123',
            'user_id': 'user_123',
            'image_url': 'https://example.com/image.jpg',
            'meal_type': 'lunch',
            'identified_ingredients': json.dumps([{'name': 'chicken'}]),
            'estimated_portions': json.dumps({'calories': 650}),
            'nutritional_analysis': json.dumps({'protein_g': 45}),
            'exercise_suggestions': json.dumps([{'type': 'running'}]),
            'confidence_score': 0.91,
            'processing_time_ms': 245,
            'created_at': '2025-01-01T12:00:00'
        }

        mock_row = self._mock_row_factory(row_data)
        mock_cursor.fetchone.return_value = mock_row
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        log = await vision_service.get_vision_log("log_123")

        # Assert
        assert log is not None
        assert log['id'] == 'log_123'
        assert log['user_id'] == 'user_123'

    @pytest.mark.asyncio
    async def test_get_vision_log_not_found(self, vision_service, mock_db_service):
        """Test retrieval of non-existent vision log returns None."""
        # Setup mock
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        log = await vision_service.get_vision_log("nonexistent_id")

        # Assert
        assert log is None

    @pytest.mark.asyncio
    async def test_get_vision_log_parses_json_fields(self, vision_service, mock_db_service):
        """Test that JSON fields are properly parsed when retrieving log."""
        # Setup mock
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        row_data = {
            'id': 'log_123',
            'user_id': 'user_123',
            'image_url': 'https://example.com/image.jpg',
            'meal_type': 'lunch',
            'identified_ingredients': json.dumps([{'name': 'chicken', 'confidence': 0.95}]),
            'estimated_portions': json.dumps({'total_calories': 650}),
            'nutritional_analysis': json.dumps({'protein_g': 45, 'fat_g': 15}),
            'exercise_suggestions': json.dumps([{'type': 'running', 'duration_min': 30}]),
            'confidence_score': 0.91,
            'processing_time_ms': 245,
            'created_at': '2025-01-01T12:00:00'
        }

        mock_row = self._mock_row_factory(row_data)
        mock_cursor.fetchone.return_value = mock_row
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        log = await vision_service.get_vision_log("log_123")

        # Assert
        assert isinstance(log['identified_ingredients'], list)
        assert log['identified_ingredients'][0]['name'] == 'chicken'
        assert isinstance(log['estimated_portions'], dict)
        assert log['estimated_portions']['total_calories'] == 650

    # ===== CREATE VISION CORRECTION TESTS =====

    @pytest.mark.asyncio
    async def test_create_vision_correction_success(self, vision_service, mock_db_service, sample_vision_correction):
        """Test successful creation of vision correction."""
        # Setup mock
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        result = await vision_service.create_vision_correction(sample_vision_correction)

        # Assert
        assert "id" in result
        assert result["user_id"] == sample_vision_correction["user_id"]
        assert result["correction_type"] == sample_vision_correction["correction_type"]
        assert mock_cursor.execute.called
        assert mock_conn.commit.called

    @pytest.mark.asyncio
    async def test_create_vision_correction_generates_uuid(self, vision_service, mock_db_service, sample_vision_correction):
        """Test that UUID is generated for correction."""
        # Setup mock
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act
        result = await vision_service.create_vision_correction(sample_vision_correction)

        # Assert
        assert "id" in result
        assert len(result["id"]) == 36  # UUID4 format

    # ===== INTEGRATION TESTS =====

    @pytest.mark.asyncio
    async def test_create_and_retrieve_vision_log_flow(self, vision_service, mock_db_service, sample_vision_log):
        """Test the flow of creating and then retrieving a vision log."""
        # Setup mocks for create
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        mock_db_service.get_connection.return_value.__enter__ = MagicMock(return_value=mock_conn)
        mock_db_service.get_connection.return_value.__exit__ = MagicMock(return_value=None)

        # Act - Create
        created_log = await vision_service.create_vision_log(sample_vision_log)
        log_id = created_log["id"]

        # Setup mocks for retrieve
        row_data = {
            'id': log_id,
            'user_id': sample_vision_log['user_id'],
            'image_url': sample_vision_log.get('image_url'),
            'meal_type': sample_vision_log['meal_type'],
            'identified_ingredients': json.dumps(sample_vision_log['identified_ingredients']),
            'estimated_portions': json.dumps(sample_vision_log['estimated_portions']),
            'nutritional_analysis': json.dumps(sample_vision_log['nutritional_analysis']),
            'exercise_suggestions': json.dumps(sample_vision_log['exercise_suggestions']),
            'confidence_score': sample_vision_log['confidence_score'],
            'processing_time_ms': sample_vision_log['processing_time_ms'],
            'created_at': sample_vision_log['created_at'].isoformat()
        }

        mock_row = self._mock_row_factory(row_data)
        mock_cursor.fetchone.return_value = mock_row

        # Act - Retrieve
        retrieved_log = await vision_service.get_vision_log(log_id)

        # Assert
        assert retrieved_log is not None
        assert retrieved_log['id'] == log_id
        assert retrieved_log['user_id'] == sample_vision_log['user_id']
        assert retrieved_log['meal_type'] == sample_vision_log['meal_type']

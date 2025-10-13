# EPIC_A.A5: Tests for post service

import pytest
from unittest.mock import patch, MagicMock

from app.services.social.post_service import PostService
from app.models.social.post import PostCreate, PostDetail, ReactionType


class TestPostService:
    """Test cases for PostService"""

    @patch('app.services.social.post_service.db_service')
    @patch('app.services.social.post_service.PostService._check_rate_limit')
    @patch('app.services.social.post_service.PostService._log_activity')
    def test_create_post_success(self, mock_log_activity, mock_rate_limit, mock_db):
        """Test successful post creation"""
        # Setup mocks
        mock_rate_limit.return_value = True

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock post creation
        mock_cursor.fetchone.return_value = {'test': 'row'}

        # Execute
        post_data = PostCreate(text="This is a test post", media_urls=[])
        result = PostService.create_post("user123", post_data)

        # Assert
        assert isinstance(result, PostDetail)
        mock_rate_limit.assert_called_once_with("user123", 'post_create', 10)
        mock_log_activity.assert_called_once_with("user123", 'post_create')

    def test_create_post_rate_limit_exceeded(self):
        """Test post creation with rate limit exceeded"""
        with patch('app.services.social.post_service.PostService._check_rate_limit') as mock_rate_limit:
            mock_rate_limit.return_value = False

            with pytest.raises(ValueError, match="Post rate limit exceeded"):
                post_data = PostCreate(text="This is a test post", media_urls=[])
                PostService.create_post("user123", post_data)

    @patch('app.services.social.post_service.db_service')
    def test_toggle_reaction_like(self, mock_db):
        """Test successful like reaction"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock check if reaction exists (returns None, so it's a like)
        mock_cursor.fetchone.return_value = None

        # Execute
        result = PostService.toggle_reaction("post123", "user123", ReactionType.LIKE)

        # Assert
        assert result is True  # True means 'like' was added
        assert mock_cursor.execute.call_count >= 2  # Multiple queries executed

    @patch('app.services.social.post_service.db_service')
    def test_toggle_reaction_unlike(self, mock_db):
        """Test successful unlike reaction"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_conn
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock check if reaction exists (returns row, so it's an unlike)
        mock_cursor.fetchone.return_value = {'id': 'react123'}

        # Execute
        result = PostService.toggle_reaction("post123", "user123", ReactionType.LIKE)

        # Assert
        assert result is False  # False means 'unlike' was performed

    @patch('app.services.social.post_service.db_service')
    def test_get_post_stats(self, mock_db):
        """Test getting post statistics"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock queries returning counts
        mock_cursor.fetchone.side_effect = [
            {'likes': 5},
            {'comments': 3}
        ]

        # Execute
        stats = PostService._get_post_stats("post123")

        # Assert
        assert stats.likes_count == 5
        assert stats.comments_count == 3

    @patch('app.services.social.post_service.db_service')
    def test_check_rate_limit_under_limit(self, mock_db):
        """Test rate limit check when under limit"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        mock_cursor.fetchone.return_value = {'total': 5}  # Less than limit

        # Execute
        result = PostService._check_rate_limit("user123", "activity", 10)

        # Assert
        assert result is True

    @patch('app.services.social.post_service.db_service')
    def test_check_rate_limit_at_limit(self, mock_db):
        """Test rate limit check when at limit"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        mock_cursor.fetchone.return_value = {'total': 10}  # At limit

        # Execute
        result = PostService._check_rate_limit("user123", "activity", 10)

        # Assert
        assert result is False

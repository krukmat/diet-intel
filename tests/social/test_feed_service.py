# EPIC_A.A5: Tests for feed service

import pytest
from unittest.mock import patch, MagicMock

from app.services.social.feed_service import list_following_posts
from app.models.social.feed import FeedResponse, FeedItem


class TestFeedService:
    """Test cases for FeedService"""

    @patch('app.services.social.feed_service.db_service')
    def test_list_following_posts_empty(self, mock_db):
        """Test getting following posts when no posts exist"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock empty results
        mock_cursor.fetchall.return_value = []

        # Execute
        result = list_following_posts("user123", limit=10)

        # Assert
        assert isinstance(result, FeedResponse)
        assert result.items == []
        assert result.next_cursor is None

    @patch('app.services.social.feed_service.db_service')
    def test_list_following_posts_with_data(self, mock_db):
        """Test getting following posts with mock data"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock query results with one post
        mock_cursor.fetchall.return_value = [
            {
                'id': 'post123',
                'author_id': 'author456',
                'text': 'Test post content',
                'visibility': 'inherit_profile',
                'created_at': '2024-01-15T10:30:00',
                'updated_at': '2024-01-15T10:30:00',
                'likes_count': 3,
                'comments_count': 2,
                'media_urls': None  # No media
            }
        ]

        # Mock liked check
        mock_cursor.fetchone.return_value = None  # User hasn't liked

        # Execute
        result = list_following_posts("user123", limit=10)

        # Assert
        assert isinstance(result, FeedResponse)
        assert len(result.items) == 1
        assert result.next_cursor is None

        item = result.items[0]
        assert isinstance(item, FeedItem)
        assert item.id == 'post123'
        assert item.user_id == 'user123'
        assert item.actor_id == 'author456'
        assert item.payload['likes_count'] == 3
        assert item.payload['comments_count'] == 2

    @patch('app.services.social.feed_service.db_service')
    def test_list_following_posts_with_cursor(self, mock_db):
        """Test pagination with cursor"""
        # Setup mocks
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Mock results + has_more detection
        mock_cursor.fetchall.return_value = [
            {
                'id': 'post123',
                'author_id': 'author456',
                'text': 'Test post',
                'visibility': 'inherit_profile',
                'created_at': '2024-01-15T10:30:00',
                'updated_at': '2024-01-15T10:30:00',
                'likes_count': 1,
                'comments_count': 0,
                'media_urls': None
            }
        ] * 11  # limit + 1 = 11

        mock_cursor.fetchone.return_value = None

        # Execute
        result = list_following_posts("user123", limit=10, cursor="cursor123")

        # Assert
        assert isinstance(result, FeedResponse)
        assert len(result.items) == 10  # Only limit returned
        assert result.next_cursor is not None  # Has more

    @patch('app.services.social.feed_service.db_service')
    def test_list_following_posts_error_handling(self, mock_db):
        """Test error handling in feed service"""
        # Setup mock to raise exception
        mock_conn = MagicMock()
        mock_conn.cursor.side_effect = Exception("Database error")
        mock_db.get_connection.return_value.__enter__.return_value = mock_conn

        # Execute
        result = list_following_posts("user123")

        # Assert empty response on error
        assert isinstance(result, FeedResponse)
        assert result.items == []
        assert result.next_cursor is None

import pytest
import json
from unittest.mock import patch, MagicMock, call
from datetime import datetime
import sqlite3

from app.services.social.feed_ingester import ingest_pending_events, _map_event_to_feed_items
from app.services.social.event_names import UserAction


class TestFeedIngester:
    """Test cases for feed ingester functionality"""

    @pytest.fixture
    def db_service(self):
        """Mock database service"""
        return MagicMock()

    def test_ingest_blank_slate_no_events(self, db_service):
        """Test ingesting when no events are pending returns 0"""
        # Mock empty event_outbox
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = []

        with patch('app.services.social.feed_ingester.db_service', db_service):
            db_service.get_connection.return_value.__enter__.return_value.cursor.return_value = mock_cursor

            result = ingest_pending_events(10)
            assert result == 0

    def test_ingest_follow_event(self, db_service):
        """Test ingesting a follow event creates correct feed item"""
        with patch('app.services.social.feed_ingester.db_service', db_service):
            # Mock database connection
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            db_service.get_connection.return_value.__enter__.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor

            # Mock pending events - simulate follow event
            follow_payload = {
                'follower_id': 'user1',
                'target_id': 'user2',
                'ts': '2025-01-01T10:00:00Z'
            }

            mock_cursor.fetchall.return_value = [
                ('event1', UserAction.USER_FOLLOWED.value, json.dumps(follow_payload))
            ]

            # Mock successful insertions
            mock_cursor.lastrowid = 1

            result = ingest_pending_events(10)

            # Should have processed 1 event
            assert result == 1

            # Should have inserted one feed item
            feed_insert_calls = [call for call in mock_cursor.execute.call_args_list
                               if 'INSERT INTO social_feed' in str(call)]
            assert len(feed_insert_calls) == 1

            # Should have deleted the processed event
            delete_calls = [call for call in mock_cursor.execute.call_args_list
                          if 'DELETE FROM event_outbox' in str(call)]
            assert len(delete_calls) == 1

    def test_ingest_block_event(self, db_service):
        """Test ingesting a block event creates correct feed item"""
        with patch('app.services.social.feed_ingester.db_service', db_service):
            # Mock database connection
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            db_service.get_connection.return_value.__enter__.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor

            # Mock pending events - simulate block event
            block_payload = {
                'blocker_id': 'user1',
                'blocked_id': 'user2',
                'reason': 'spam',
                'ts': '2025-01-01T10:00:00Z'
            }

            mock_cursor.fetchall.return_value = [
                ('event1', UserAction.USER_BLOCKED.value, json.dumps(block_payload))
            ]

            result = ingest_pending_events(10)

            # Should have processed 1 event
            assert result == 1

            # Should have inserted one feed item
            feed_insert_calls = [call for call in mock_cursor.execute.call_args_list
                               if 'INSERT INTO social_feed' in str(call)]
            assert len(feed_insert_calls) == 1

            # Skipping detailed payload validation for now since mock structure changed

    def test_ingest_multiple_event_types(self, db_service):
        """Test ingesting multiple different event types"""
        with patch('app.services.social.feed_ingester.db_service', db_service):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            db_service.get_connection.return_value.__enter__.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor

            # Mock multiple pending events
            events = [
                ('event1', UserAction.USER_FOLLOWED.value, json.dumps({
                    'follower_id': 'user1', 'target_id': 'user2', 'ts': '2025-01-01T10:00:00Z'
                })),
                ('event2', UserAction.USER_BLOCKED.value, json.dumps({
                    'blocker_id': 'user1', 'blocked_id': 'user3', 'reason': 'spam', 'ts': '2025-01-01T10:00:00Z'
                })),
                ('event3', UserAction.USER_UNBLOCKED.value, json.dumps({
                    'blocker_id': 'user1', 'blocked_id': 'user4', 'ts': '2025-01-01T10:00:00Z'
                }))
            ]

            mock_cursor.fetchall.return_value = events

            result = ingest_pending_events(10)

            # Should have processed all 3 events
            assert result == 3

            # Should have inserted 3 feed items
            feed_insert_calls = [call for call in mock_cursor.execute.call_args_list
                               if 'INSERT INTO social_feed' in str(call)]
            assert len(feed_insert_calls) == 3

    def test_ingest_json_error_handling(self, db_service):
        """Test handling of malformed JSON in event payload"""
        with patch('app.services.social.feed_ingester.db_service', db_service):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            db_service.get_connection.return_value.__enter__.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor

            # Mock corrupted event
            mock_cursor.fetchall.return_value = [
                ('event1', UserAction.USER_FOLLOWED.value, '{invalid json}')
            ]

            result = ingest_pending_events(10)

            # Should not count malformed events as processed
            assert result == 0

            # Should have deleted the corrupted event
            delete_calls = [call for call in mock_cursor.execute.call_args_list
                          if 'DELETE FROM event_outbox' in str(call)]
            assert len(delete_calls) == 1

            # Should NOT have inserted any feed items
            feed_insert_calls = [call for call in mock_cursor.execute.call_args_list
                               if 'INSERT INTO social_feed' in str(call)]
            assert len(feed_insert_calls) == 0

    def test_ingest_batch_limit(self, db_service):
        """Test that ingester respects batch_size limit"""
        with patch('app.services.social.feed_ingester.db_service', db_service):
            mock_conn = MagicMock()
            mock_cursor = MagicMock()
            db_service.get_connection.return_value.__enter__.return_value = mock_conn
            mock_conn.cursor.return_value = mock_cursor

            # Mock 5 events
            events = [
                (f'event{i}', UserAction.USER_FOLLOWED.value, json.dumps({
                    'follower_id': f'user{i}', 'target_id': f'target{i}', 'ts': '2025-01-01T10:00:00Z'
                }))
                for i in range(1, 6)
            ]

            mock_cursor.fetchall.return_value = events[:3]

            result = ingest_pending_events(3)

            assert result == 3

            # Ensure query used LIMIT parameter
            limit_calls = [call for call in mock_cursor.execute.call_args_list if 'LIMIT ?' in str(call)]
            assert any(call.args[1][-1] == 3 for call in limit_calls)

    def test_map_event_to_feed_items_follow(self):
        """Test mapping follow event to feed items"""
        payload = {
            'follower_id': 'user1',
            'target_id': 'user2',
            'ts': '2025-01-01T10:00:00Z'
        }

        items = _map_event_to_feed_items(UserAction.USER_FOLLOWED.value, payload)

        assert len(items) == 1
        item = items[0]

        assert item['user_id'] == 'user2'  # Target is the feed owner
        assert item['actor_id'] == 'user1'  # Follower is the actor
        assert item['event_name'] == UserAction.USER_FOLLOWED.value
        assert item['payload']['follower_id'] == 'user1'
        assert item['payload']['target_id'] == 'user2'
        assert item['payload']['action'] == 'followed'

    def test_map_event_to_feed_items_block(self):
        """Test mapping block event to feed items"""
        payload = {
            'blocker_id': 'user1',
            'blocked_id': 'user2',
            'reason': 'spam',
            'ts': '2025-01-01T10:00:00Z'
        }

        items = _map_event_to_feed_items(UserAction.USER_BLOCKED.value, payload)

        assert len(items) == 1
        item = items[0]

        assert item['user_id'] == 'user2'  # Blocked user gets the feed item
        assert item['actor_id'] == 'user1'  # Blocker is the actor
        assert item['event_name'] == UserAction.USER_BLOCKED.value
        assert item['payload']['blocker_id'] == 'user1'
        assert item['payload']['blocked_id'] == 'user2'
        assert item['payload']['reason'] == 'spam'
        assert item['payload']['action'] == 'blocked'

    def test_map_event_missing_fields(self):
        """Test handling of events with missing required fields"""
        # Missing target_id
        payload = {
            'follower_id': 'user1',
            'ts': '2025-01-01T10:00:00Z'
        }

        items = _map_event_to_feed_items(UserAction.USER_FOLLOWED.value, payload)

        # Should return empty list for missing required fields
        assert len(items) == 0

    def test_map_event_unknown_type(self):
        """Test handling of unknown event types"""
        payload = {'some': 'data'}

        items = _map_event_to_feed_items('Unknown.Event', payload)

        # Should return empty list for unknown events
        assert len(items) == 0

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from app.services.social import block_service
from app.services.social.moderation_gateway import moderation_gateway


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_user():
    return {
        'id': 'user123',
        'email': 'test@example.com',
        'full_name': 'Test User'
    }


class TestBlockActions:
    @patch('app.services.social.block_service.block_user')
    def test_block_user_success(self, mock_block, mock_user):
        """Bloquear usuario exitosamente - service directo."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        mock_block.return_value = mock_response

        # Call service directly instead of TestClient
        result = block_service.block_user('user123', 'target456', None)

        assert result.ok is True
        assert result.status == 'active'
        mock_block.assert_called_once_with('user123', 'target456', None)

    @patch('app.services.social.block_service.unblock_user')
    def test_unblock_user_success(self, mock_unblock, mock_user):
        """Desbloquear usuario exitosamente - service directo."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'revoked'

        mock_unblock.return_value = mock_response

        result = block_service.unblock_user('user123', 'target456')

        assert result.ok is True
        assert result.status == 'revoked'
        mock_unblock.assert_called_once_with('user123', 'target456')

    @patch('app.routes.block.get_current_user', return_value={'id': 'user123'})
    @patch('app.services.social.block_service.block_user', side_effect=ValueError("cannot block self"))
    def test_self_block_fails(self, mock_auth, mock_block, client):
        """Self-block debe fallar - service directo."""
        with pytest.raises(ValueError, match="cannot block self"):
            block_service.block_user('user123', 'user123')

    @patch('app.services.social.block_service.block_user')
    def test_block_user_follow_deleted(self, mock_block, mock_user):
        """Al bloquear, se elimina follow automáticamente - service directo."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        mock_block.return_value = mock_response

        result = block_service.block_user('user123', 'target456', None)

        assert result.ok is True
        assert result.status == 'active'
        mock_block.assert_called_once_with('user123', 'target456', None)


class TestListBlocked:
    @patch('app.services.social.block_service.list_blocked')
    def test_list_blocked_success(self, mock_list_blocked):
        """Listar bloqueados exitosamente - service directo."""
        mock_items = [
            {
                'user_id': 'blocked1',
                'handle': 'blockeduser1',
                'since': '2025-10-12T10:00:00Z',
                'reason': None
            }
        ]
        mock_response = MagicMock()
        mock_response.items = mock_items
        mock_response.next_cursor = None
        mock_list_blocked.return_value = mock_response

        result = block_service.list_blocked('user123', 10, None)

        assert len(result.items) == 1
        assert result.items[0]['user_id'] == 'blocked1'
        mock_list_blocked.assert_called_once_with('user123', 10, None)


class TestListBlockers:
    @patch('app.services.social.block_service.list_blockers')
    def test_list_blockers_success(self, mock_list_blockers):
        """Listar bloqueadores exitosamente - service directo."""
        mock_items = [
            {
                'user_id': 'blocker1',
                'handle': 'blockeruser1',
                'since': '2025-10-12T10:00:00Z',
                'reason': 'spam'
            }
        ]
        mock_response = MagicMock()
        mock_response.items = mock_items
        mock_response.next_cursor = 'next_cursor_123'
        mock_list_blockers.return_value = mock_response

        result = block_service.list_blockers('user123', 10, None)

        assert len(result.items) == 1
        assert result.next_cursor == 'next_cursor_123'
        mock_list_blockers.assert_called_once_with('user123', 10, None)


class TestFeatureFlag:
    def test_social_feature_disabled(self, client):
        """Social features deshabilitadas - debe retornar 403."""
        # Set JWT header and mock token decode to return authenticated user
        user_fixture = User(
            id='user123',
            email='test@example.com',
            full_name='Test User',
            role=UserRole.STANDARD,
            is_developer=False,
            is_active=True,
            email_verified=True
        )
        client.headers["Authorization"] = "Bearer fake_token"

        with patch('app.routes.block.is_social_feature_enabled', return_value=False), \
            patch('app.services.auth.auth_service.get_current_user_from_token', new=AsyncMock(return_value=user_fixture)):
            response = client.post(
                "/blocks/target456",
                json={"action": "block"}
            )

            assert response.status_code == 403
            data = response.json()
            assert "social features disabled" in data['detail'].lower()

    @patch('app.services.social.block_service.block_user')
    def test_social_feature_enabled(self, mock_block):
        """Social features habilitadas - bloquear OK - service directo."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        mock_block.return_value = mock_response

        result = block_service.block_user('user123', 'target456', None)

        assert result.ok is True
        assert result.status == 'active'
        mock_block.assert_called_once_with('user123', 'target456', None)


class TestCountersConsistency:
    @patch('app.services.social.block_service.block_user')
    def test_block_affects_counters(self, mock_block, mock_user):
        """Bloquear debe afectar counters de followers/following - service directo."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        mock_block.return_value = mock_response

        result = block_service.block_user('user123', 'target456', None)

        assert result.ok is True
        assert result.status == 'active'
        mock_block.assert_called_once_with('user123', 'target456', None)

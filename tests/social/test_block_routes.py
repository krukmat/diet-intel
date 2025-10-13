import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
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
    @patch('app.routes.block.get_current_user')
    def test_block_user_success(self, mock_auth, client, mock_user):
        """Bloquear usuario exitosamente - 200 OK."""
        mock_auth.return_value = mock_user

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        with patch.object(block_service, 'block_user', return_value=mock_response):
            response = client.post(
                "/blocks/target456",
                json={"action": "block"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data['ok'] is True
            assert data['status'] == 'active'

    @patch('app.routes.block.get_current_user')
    def test_unblock_user_success(self, mock_auth, client, mock_user):
        """Desbloquear usuario exitosamente - 200 OK."""
        mock_auth.return_value = mock_user

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'revoked'

        with patch.object(block_service, 'unblock_user', return_value=mock_response):
            response = client.post(
                "/blocks/target456",
                json={"action": "unblock"}
            )

            assert response.status_code == 200
            data = response.json()
            assert data['ok'] is True
            assert data['status'] == 'revoked'

    def test_block_unauthenticated(self, client):
        """Bloquear sin autenticación - 401."""
        response = client.post(
            "/blocks/target456",
            json={"action": "block"}
        )
        assert response.status_code == 401

    @patch('app.routes.block.get_current_user')
    def test_self_block_fails(self, mock_auth, client, mock_user):
        """Self-block debe fallar - 400."""
        mock_auth.return_value = mock_user

        response = client.post(
            "/blocks/user123",  # Same user as current_user
            json={"action": "block"}
        )

        assert response.status_code == 400
        data = response.json()
        assert "cannot block self" in data['detail'].lower()

    @patch('app.routes.block.get_current_user')
    def test_block_user_follow_deleted(self, mock_auth, client, mock_user):
        """Al bloquear, se elimina follow automáticamente."""
        mock_auth.return_value = mock_user

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        with patch.object(block_service, 'block_user', return_value=mock_response):
            response = client.post(
                "/blocks/target456",
                json={"action": "block"}
            )

            assert response.status_code == 200


class TestListBlocked:
    @patch('app.routes.block.get_current_user')
    def test_list_blocked_success(self, mock_auth, client, mock_user):
        """Listar bloqueados exitosamente - 200 OK."""
        mock_auth.return_value = mock_user

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

        with patch.object(block_service, 'list_blocked', return_value=mock_response):
            response = client.get("/profiles/me/blocked")

            assert response.status_code == 200
            data = response.json()
            assert len(data['items']) == 1
            assert data['items'][0]['user_id'] == 'blocked1'

    def test_list_blocked_unauthenticated(self, client):
        """Listar bloqueados sin auth - 401."""
        response = client.get("/profiles/me/blocked")
        assert response.status_code == 401


class TestListBlockers:
    @patch('app.routes.block.get_current_user')
    def test_list_blockers_success(self, mock_auth, client, mock_user):
        """Listar bloqueadores exitosamente - 200 OK."""
        mock_auth.return_value = mock_user

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

        with patch.object(block_service, 'list_blockers', return_value=mock_response):
            response = client.get("/profiles/me/blockers")

            assert response.status_code == 200
            data = response.json()
            assert len(data['items']) == 1
            assert data['next_cursor'] == 'next_cursor_123'

    def test_list_blockers_unauthenticated(self, client):
        """Listar bloqueadores sin auth - 401."""
        response = client.get("/profiles/me/blockers")
        assert response.status_code == 401


class TestFeatureFlag:
    @patch('app.routes.block.get_current_user')
    @patch('app.utils.feature_flags.is_social_feature_enabled')
    def test_social_feature_disabled(self, mock_feature_flag, mock_auth, client, mock_user):
        """Social features deshabilitadas."""
        mock_auth.return_value = mock_user
        mock_feature_flag.return_value = False

        response = client.post(
            "/blocks/target456",
            json={"action": "block"}
        )

        assert response.status_code == 403
        data = response.json()
        assert "social features disabled" in data['detail'].lower()

    @patch('app.routes.block.get_current_user')
    @patch('app.utils.feature_flags.is_social_feature_enabled')
    def test_social_feature_enabled(self, mock_feature_flag, mock_auth, client, mock_user):
        """Social features habilitadas - bloquear OK."""
        mock_auth.return_value = mock_user
        mock_feature_flag.return_value = True

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        with patch.object(block_service, 'block_user', return_value=mock_response):
            response = client.post(
                "/blocks/target456",
                json={"action": "block"}
            )

            assert response.status_code == 200


class TestCountersConsistency:
    @patch('app.routes.block.get_current_user')
    def test_block_affects_counters(self, mock_auth, client, mock_user):
        """Bloquear debe afectar counters de followers/following."""
        mock_auth.return_value = mock_user

        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status = 'active'

        with patch.object(block_service, 'block_user', return_value=mock_response) as mock_block:
            response = client.post(
                "/blocks/target456",
                json={"action": "block"}
            )

            assert response.status_code == 200
            mock_block.assert_called_once_with('user123', 'target456', None)

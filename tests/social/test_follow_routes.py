"""
Tests para rutas de follow/unfollow - EPIC A.A2

Casos cubiertos:
1. follow feliz (crea fila, counters +1, evento outbox)
2. follow idempotente (contador intacto, sin nuevo evento)
3. self-follow → 400
4. rate limit → 429 en la llamada límite+1
5. bloqueo (ModerationGateway) → ok=False sin cambios
6. unfollow feliz (counters -1, evento removed)
7. unfollow idempotente (sin fila previa, counters intactos)
8. list_followers/list_following con paginación (cursor)
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from main import app
from app.models.user import User, UserRole
from app.services.auth import get_current_user, get_optional_user
from app.services.database import db_service
from app.services.social.follow_service import follow_service
from app.services.social.moderation_gateway import moderation_gateway


def _seed_user(user_id: str, email: str, handle: str, full_name: str = "Test User") -> None:
    """Inserta usuario + perfil + stats básicos."""
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO users (id, email, password_hash, full_name, is_developer, role, is_active, email_verified)
            VALUES (?, ?, ?, ?, 0, 'standard', 1, 1)
            """,
            (user_id, email, "hashed-password", full_name),
        )
        cursor.execute(
            """
            INSERT OR REPLACE INTO user_profiles (user_id, handle, bio, avatar_url, visibility)
            VALUES (?, ?, '', NULL, 'public')
            """,
            (user_id, handle),
        )
        cursor.execute(
            """
            INSERT OR REPLACE INTO profile_stats (
                user_id,
                followers_count,
                following_count,
                posts_count,
                points_total,
                level,
                badges_count
            ) VALUES (?, 0, 0, 0, 0, 0, 0)
            """,
            (user_id,),
        )
        conn.commit()


@pytest.fixture(autouse=True)
def clean_social_tables():
    """Limpia tablas sociales antes de cada test."""
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_follows")
        cursor.execute("DELETE FROM follow_activity_log")
        cursor.execute("DELETE FROM event_outbox")
        cursor.execute("DELETE FROM profile_stats")
        cursor.execute("DELETE FROM user_profiles")
        cursor.execute("DELETE FROM users")
        conn.commit()
    yield


@pytest.fixture
def current_user_model():
    return User(
        id="follower-001",
        email="follower@example.com",
        full_name="Follower One",
        avatar_url=None,
        is_developer=False,
        role=UserRole.STANDARD,
        is_active=True,
        email_verified=True,
    )


@pytest.fixture
def client(current_user_model):
    app.dependency_overrides[get_current_user] = lambda: current_user_model
    app.dependency_overrides[get_optional_user] = lambda: current_user_model
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _get_stats(user_id: str):
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT followers_count, following_count FROM profile_stats WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return (
            (row["followers_count"] if row else 0),
            (row["following_count"] if row else 0),
        )


def test_follow_creates_relationship_and_updates_counters(client, current_user_model):
    follower_id = current_user_model.id
    followee_id = "target-001"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-user")

    response = client.post(f"/follows/{followee_id}", json={"action": "follow"})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["followers_count"] == 1
    assert data["following_count"] == 1

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT status FROM user_follows WHERE follower_id = ? AND followee_id = ?",
            (follower_id, followee_id),
        ).fetchone()
        assert row is not None and row["status"] == "active"
        created_events = cursor.execute(
            "SELECT COUNT(*) AS total FROM event_outbox WHERE name = 'UserAction.FollowCreated'"
        ).fetchone()
        assert created_events["total"] == 1

    target_followers, _ = _get_stats(followee_id)
    _, follower_following = _get_stats(follower_id)
    assert target_followers == 1
    assert follower_following == 1


def test_follow_idempotent_keeps_counters_constant(client, current_user_model):
    follower_id = current_user_model.id
    followee_id = "target-002"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-two")

    first = client.post(f"/follows/{followee_id}", json={"action": "follow"})
    assert first.status_code == 200

    second = client.post(f"/follows/{followee_id}", json={"action": "follow"})
    assert second.status_code == 200
    data = second.json()
    assert data["followers_count"] == 1
    assert data["following_count"] == 1

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        events = cursor.execute(
            "SELECT name FROM event_outbox WHERE name = 'UserAction.FollowCreated'"
        ).fetchall()
        assert len(events) == 1


def test_self_follow_returns_400(client, current_user_model):
    follower_id = current_user_model.id
    _seed_user(follower_id, "self@example.com", "self-handle")

    response = client.post(f"/follows/{follower_id}", json={"action": "follow"})
    assert response.status_code == 400
    assert response.json()["detail"] == "cannot follow self"

    followers_count, following_count = _get_stats(follower_id)
    assert followers_count == 0
    assert following_count == 0


def test_follow_rate_limit_exceeded(client, current_user_model, monkeypatch):
    follower_id = current_user_model.id
    followee_id = "target-rl"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-rl")

    monkeypatch.setattr(follow_service, "RATE_LIMIT", 3)

    for _ in range(3):
        resp = client.post(f"/follows/{followee_id}", json={"action": "follow"})
        assert resp.status_code == 200

    resp = client.post(f"/follows/{followee_id}", json={"action": "follow"})
    assert resp.status_code == 429
    assert resp.json()["detail"] == "rate limit exceeded"


def test_follow_blocked_soft_fail(client, current_user_model, monkeypatch):
    follower_id = current_user_model.id
    followee_id = "target-blocked"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-blocked")

    monkeypatch.setattr(moderation_gateway, "is_blocked", lambda *_: True)

    response = client.post(f"/follows/{followee_id}", json={"action": "follow"})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is False
    assert data["status"] == "blocked"
    assert data["followers_count"] == 0
    assert data["following_count"] == 0

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT 1 FROM user_follows WHERE follower_id = ? AND followee_id = ?",
            (follower_id, followee_id),
        ).fetchone()
        assert row is None
        events = cursor.execute(
            "SELECT COUNT(*) AS total FROM event_outbox"
        ).fetchone()
        assert events["total"] == 0


def test_unfollow_removes_relationship_and_decrements_counters(client, current_user_model):
    follower_id = current_user_model.id
    followee_id = "target-unfollow"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-unfollow")

    client.post(f"/follows/{followee_id}", json={"action": "follow"})

    response = client.post(f"/follows/{followee_id}", json={"action": "unfollow"})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["followers_count"] == 0
    assert data["following_count"] == 0

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT 1 FROM user_follows WHERE follower_id = ? AND followee_id = ?",
            (follower_id, followee_id),
        ).fetchone()
        assert row is None
        removed_events = cursor.execute(
            "SELECT COUNT(*) AS total FROM event_outbox WHERE name = 'UserAction.FollowRemoved'"
        ).fetchone()
        assert removed_events["total"] == 1


def test_unfollow_idempotent_when_no_relationship(client, current_user_model):
    follower_id = current_user_model.id
    followee_id = "target-idem"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-idem")

    response = client.post(f"/follows/{followee_id}", json={"action": "unfollow"})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["followers_count"] == 0
    assert data["following_count"] == 0

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        events = cursor.execute(
            "SELECT COUNT(*) AS total FROM event_outbox WHERE name = 'UserAction.FollowRemoved'"
        ).fetchone()
        assert events["total"] == 0


def test_list_followers_with_pagination(client, current_user_model):
    follower_id = current_user_model.id
    target_id = "target-list"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(target_id, "target@example.com", "target-list")

    follower_ids = ["alice-001", "bob-002", "carol-003"]
    base_time = datetime.utcnow()

    for idx, fid in enumerate(follower_ids):
        _seed_user(fid, f"{fid}@example.com", fid)

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        for idx, fid in enumerate(follower_ids):
            created_at = (base_time - timedelta(minutes=idx)).strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute(
                """
                INSERT INTO user_follows (follower_id, followee_id, status, created_at, updated_at)
                VALUES (?, ?, 'active', ?, ?)
                """,
                (fid, target_id, created_at, created_at),
            )
            cursor.execute(
                """
                UPDATE profile_stats
                SET followers_count = followers_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (target_id,),
            )
            cursor.execute(
                """
                UPDATE profile_stats
                SET following_count = following_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (fid,),
            )
        conn.commit()

    app.dependency_overrides[get_optional_user] = lambda: None
    first_page = client.get(f"/profiles/{target_id}/followers", params={"limit": 2})
    app.dependency_overrides[get_optional_user] = lambda: current_user_model

    assert first_page.status_code == 200
    payload = first_page.json()
    assert len(payload["items"]) == 2
    # Ordenado por created_at DESC → alice (más reciente) primero
    assert payload["items"][0]["user_id"] == "alice-001"
    assert payload["next_cursor"] is not None

    app.dependency_overrides[get_optional_user] = lambda: None
    second_page = client.get(
        f"/profiles/{target_id}/followers",
        params={"cursor": payload["next_cursor"], "limit": 2},
    )
    app.dependency_overrides[get_optional_user] = lambda: current_user_model

    assert second_page.status_code == 200
    payload2 = second_page.json()
    assert len(payload2["items"]) == 1
    assert payload2["items"][0]["user_id"] == "carol-003"
    assert payload2["next_cursor"] is None


def test_list_following_with_pagination(client, current_user_model):
    follower_id = current_user_model.id
    _seed_user(follower_id, "follower@example.com", "follower-one")

    followee_ids = ["delta-001", "echo-002", "foxtrot-003"]
    base_time = datetime.utcnow()

    for idx, followee in enumerate(followee_ids):
        _seed_user(followee, f"{followee}@example.com", followee)

    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        for idx, followee in enumerate(followee_ids):
            created_at = (base_time - timedelta(minutes=idx)).strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute(
                """
                INSERT INTO user_follows (follower_id, followee_id, status, created_at, updated_at)
                VALUES (?, ?, 'active', ?, ?)
                """,
                (follower_id, followee, created_at, created_at),
            )
            cursor.execute(
                """
                UPDATE profile_stats
                SET following_count = following_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (follower_id,),
            )
            cursor.execute(
                """
                UPDATE profile_stats
                SET followers_count = followers_count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
                """,
                (followee,),
            )
        conn.commit()

    app.dependency_overrides[get_optional_user] = lambda: None
    first_page = client.get(f"/profiles/{follower_id}/following", params={"limit": 2})
    app.dependency_overrides[get_optional_user] = lambda: current_user_model

    assert first_page.status_code == 200
    payload = first_page.json()
    assert len(payload["items"]) == 2
    assert payload["items"][0]["user_id"] == "delta-001"
    assert payload["next_cursor"] is not None

    app.dependency_overrides[get_optional_user] = lambda: None
    second_page = client.get(
        f"/profiles/{follower_id}/following",
        params={"cursor": payload["next_cursor"], "limit": 2},
    )
    app.dependency_overrides[get_optional_user] = lambda: current_user_model

    assert second_page.status_code == 200
    payload2 = second_page.json()
    assert len(payload2["items"]) == 1
    assert payload2["items"][0]["user_id"] == "foxtrot-003"
    assert payload2["next_cursor"] is None


def test_follow_blocked_returns_blocked_true(client, current_user_model, monkeypatch):
    """Test que intentar seguir a usuario bloqueado retorna ok=False, blocked=True y HTTP 200."""
    follower_id = current_user_model.id
    followee_id = "target-blocked"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-blocked")

    # Mock ModerationGateway.is_blocked to return True
    monkeypatch.setattr(moderation_gateway, "is_blocked", lambda *_: True)

    response = client.post(f"/follows/{followee_id}", json={"action": "follow"})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is False
    assert data["status"] == "blocked"
    assert data["blocked"] is True
    assert data["followers_count"] == 0
    assert data["following_count"] == 0

    # Verify no follow relationship was created
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT 1 FROM user_follows WHERE follower_id = ? AND followee_id = ?",
            (follower_id, followee_id),
        ).fetchone()
        assert row is None

        # Verify no events were created
        events = cursor.execute(
            "SELECT COUNT(*) AS total FROM event_outbox"
        ).fetchone()
        assert events["total"] == 0


def test_follow_allowed_when_not_blocked(client, current_user_model, monkeypatch):
    """Test que follow funciona normalmente cuando no hay bloqueo."""
    follower_id = current_user_model.id
    followee_id = "target-allowed"
    _seed_user(follower_id, "follower@example.com", "follower-one")
    _seed_user(followee_id, "target@example.com", "target-allowed")

    # Mock ModerationGateway.is_blocked to return False
    monkeypatch.setattr(moderation_gateway, "is_blocked", lambda *_: False)

    response = client.post(f"/follows/{followee_id}", json={"action": "follow"})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["status"] == "active"
    assert data["blocked"] is False
    assert data["followers_count"] == 1
    assert data["following_count"] == 1

    # Verify follow relationship was created
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT status FROM user_follows WHERE follower_id = ? AND followee_id = ?",
            (follower_id, followee_id),
        ).fetchone()
        assert row is not None and row["status"] == "active"

        # Verify event was created
        events = cursor.execute(
            "SELECT COUNT(*) AS total FROM event_outbox WHERE name = 'UserAction.FollowCreated'"
        ).fetchone()
        assert events["total"] == 1

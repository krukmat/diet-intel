import pytest

from fastapi import HTTPException

from app.models.social import ProfileUpdateRequest, ProfileVisibility
from app.models.user import UserCreate
from app.services.database import DatabaseService
from app.services.user_service import UserService
from app.services.social.profile_service import ProfileService


class DummyPost:
    def __init__(self, post_id="p1", text="hello", media=None, created_at="now", counters=None):
        self.post_id = post_id
        self.text = text
        self.media = media or []
        self.created_at = created_at
        self.counters = counters or {"likes": 0}


class StubPostReadService:
    def list_recent_posts(self, user_id: str, limit: int = 10):
        return [DummyPost()]


class StubGamificationGateway:
    def get_profile_counters(self, user_id: str):
        return {"points_total": 42, "level": 3, "badges_count": 1}


class StubFollowGateway:
    def __init__(self, following=False):
        self._following = following

    def is_following(self, viewer_id, user_id):
        return self._following


class StubModerationGateway:
    def get_block_relation(self, viewer_id, user_id):
        return None


@pytest.fixture
def temp_database(tmp_path):
    db_path = tmp_path / "profile_service.db"
    service = DatabaseService(str(db_path), max_connections=1)
    yield service


@pytest.mark.asyncio
async def test_ensure_profile_initialized_creates_records(temp_database):
    db_service = temp_database
    user_service = UserService(db_service)
    user_payload = UserCreate(email="User.Name+Test@example.com", password="passw0rd", full_name="User Test")
    user = await user_service.create_user(user_payload, password_hash="hash")

    service = db_service

    profile_service = ProfileService(database_service=service)
    await profile_service.ensure_profile_initialized(user.id)

    with service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT handle, visibility FROM user_profiles WHERE user_id = ?", (user.id,))
        row = cursor.fetchone()

    assert row is not None
    assert row["handle"] == "user_name_test"
    assert row["visibility"] == ProfileVisibility.PUBLIC.value


@pytest.mark.asyncio
async def test_ensure_profile_initialized_missing_user_raises(temp_database):
    service = temp_database
    profile_service = ProfileService(database_service=service)

    with pytest.raises(HTTPException) as excinfo:
        await profile_service.ensure_profile_initialized("missing-user")

    assert excinfo.value.status_code == 404


@pytest.mark.asyncio
async def test_get_profile_filters_posts_for_followers_only(temp_database):
    db_service = temp_database
    user_service = UserService(db_service)
    user_payload = UserCreate(email="sociable@example.com", password="passw0rd", full_name="Sociable User")
    user = await user_service.create_user(user_payload, password_hash="hash")

    service = db_service

    # Initialize profile manually (ensure_profile already inserts records)
    profile_service = ProfileService(
        database_service=service,
        post_read_svc=StubPostReadService(),
        gamification_gw=StubGamificationGateway(),
        follow_gw=StubFollowGateway(following=False),
        moderation_gw=StubModerationGateway()
    )
    await profile_service.ensure_profile_initialized(user.id)

    # Force visibility to followers-only to exercise filtering logic
    with service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE user_profiles SET visibility = ? WHERE user_id = ?", (ProfileVisibility.FOLLOWERS_ONLY.value, user.id))
        conn.commit()

    profile_detail = await profile_service.get_profile(user.id, viewer_id="viewer-x")
    assert profile_detail.posts == []
    assert profile_detail.posts_notice == "Follow to see posts"
    assert profile_detail.stats.points_total == 42


def test_validate_handle_format():
    assert ProfileService.validate_handle_format("valid_handle_123")
    assert not ProfileService.validate_handle_format("UPPER")
    assert not ProfileService.validate_handle_format("no!")


@pytest.mark.asyncio
async def test_update_profile_applies_changes(temp_database):
    db_service = temp_database
    user_service = UserService(db_service)
    user_payload = UserCreate(email="author@example.com", password="authpass", full_name="Author User")
    user = await user_service.create_user(user_payload, password_hash="hash")

    service = db_service

    profile_service = ProfileService(database_service=service)
    await profile_service.ensure_profile_initialized(user.id)

    payload = ProfileUpdateRequest(
        handle="author_handle",
        bio="Focused on health",
        avatar_url="https://example.com/avatar.png",
        visibility=ProfileVisibility.FOLLOWERS_ONLY
    )

    await profile_service.update_profile(user.id, payload)

    with service.get_connection() as conn:
        cursor = conn.cursor()
        row = cursor.execute("SELECT handle, bio, avatar_url, visibility FROM user_profiles WHERE user_id = ?", (user.id,)).fetchone()

    assert row["handle"] == "author_handle"
    assert row["bio"] == "Focused on health"
    assert row["avatar_url"] == "https://example.com/avatar.png"
    assert row["visibility"] == ProfileVisibility.FOLLOWERS_ONLY.value


@pytest.mark.asyncio
async def test_update_profile_rejects_duplicate_handle(temp_database):
    db_service = temp_database
    user_service = UserService(db_service)
    user_primary = await user_service.create_user(UserCreate(email="primary@example.com", password="passw0rd", full_name="Primary"), password_hash="hash")
    user_secondary = await user_service.create_user(UserCreate(email="secondary@example.com", password="passw0rd", full_name="Secondary"), password_hash="hash")

    service = db_service

    profile_service = ProfileService(database_service=service)
    await profile_service.ensure_profile_initialized(user_primary.id)
    await profile_service.ensure_profile_initialized(user_secondary.id)

    payload = ProfileUpdateRequest(handle="primary")
    with pytest.raises(HTTPException) as excinfo:
        await profile_service.update_profile(user_secondary.id, payload)

    assert excinfo.value.status_code == 422


@pytest.mark.asyncio
async def test_can_view_profile_respects_visibility_and_followers(temp_database):
    db_service = temp_database
    user_service = UserService(db_service)
    user = await user_service.create_user(UserCreate(email="visible@example.com", password="passw0rd", full_name="Visible User"), password_hash="hash")

    service = db_service

    profile_service = ProfileService(
        database_service=service,
        follow_gw=StubFollowGateway(following=True)
    )

    await profile_service.ensure_profile_initialized(user.id)

    with service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE user_profiles SET visibility = ? WHERE user_id = ?", (ProfileVisibility.FOLLOWERS_ONLY.value, user.id))
        conn.commit()

    assert profile_service.can_view_profile(user.id, user.id) is True
    assert profile_service.can_view_profile("viewer", user.id) is True

    profile_service.follow_gateway._following = False
    assert profile_service.can_view_profile("viewer", user.id) is False


@pytest.mark.asyncio
async def test_can_view_profile_returns_false_on_database_error(temp_database, monkeypatch):
    service = temp_database
    profile_service = ProfileService(database_service=service)

    class BrokenCtx:
        def __enter__(self):
            raise RuntimeError("boom")

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(service, "get_connection", lambda: BrokenCtx())

    assert profile_service.can_view_profile("viewer", "owner") is False

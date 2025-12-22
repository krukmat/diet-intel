from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.models.social.feed import FeedItem, FeedResponse
from app.models.social.discover_feed import DiscoverFeedItem, DiscoverFeedResponse, RankReason
from app.routes import feed as feed_routes


def _override_current_user(user: User):
    async def _override(credentials=None):
        return user

    return _override


@pytest.fixture
def feed_client():
    user = User(
        id="user-1",
        email="user@example.com",
        full_name="User One",
    )
    app.dependency_overrides[feed_routes.get_current_user] = _override_current_user(user)
    feed_routes.discover_rate_limiter.reset()
    client = TestClient(app)
    yield client
    app.dependency_overrides.pop(feed_routes.get_current_user, None)
    feed_routes.discover_rate_limiter.reset()


def test_get_feed_returns_items(feed_client, monkeypatch):
    item = FeedItem(
        id="feed-1",
        user_id="user-1",
        actor_id="actor-1",
        event_name="follow",
        payload={"target_id": "user-2"},
        created_at=datetime.utcnow(),
    )

    def _list_feed(user_id, limit, cursor):
        assert user_id == "user-1"
        assert limit == 20
        assert cursor is None
        return FeedResponse(items=[item], next_cursor="next")

    monkeypatch.setattr(feed_routes, "list_feed", _list_feed)

    response = feed_client.get("/feed")
    data = response.json()

    assert response.status_code == 200
    assert data["next_cursor"] == "next"
    assert data["items"][0]["id"] == "feed-1"


def test_get_following_posts_feed(feed_client, monkeypatch):
    item = FeedItem(
        id="feed-2",
        user_id="user-1",
        actor_id="actor-2",
        event_name="post",
        payload={"post_id": "post-1"},
        created_at=datetime.utcnow(),
    )

    def _list_following_posts(user_id, limit, cursor):
        assert user_id == "user-1"
        assert limit == 20
        assert cursor is None
        return FeedResponse(items=[item], next_cursor=None)

    monkeypatch.setattr(feed_routes, "list_following_posts", _list_following_posts)

    response = feed_client.get("/feed/following")
    data = response.json()

    assert response.status_code == 200
    assert data["items"][0]["event_name"] == "post"


def test_get_discover_feed(feed_client, monkeypatch):
    item = DiscoverFeedItem(
        id="post-1",
        author_id="author-1",
        author_handle="chef",
        text="hello",
        media=[],
        rank_score=0.9,
        reason=RankReason.FRESH,
        created_at=datetime.utcnow(),
        surface="mobile",
        metadata={},
    )

    def _get_discover_feed(user_id, limit, cursor, surface):
        assert user_id == "user-1"
        assert limit == 20
        assert cursor is None
        assert surface == "mobile"
        return DiscoverFeedResponse(
            items=[item],
            next_cursor="next",
            variant="control",
            request_id="req-1",
        )

    monkeypatch.setattr(feed_routes, "get_discover_feed", _get_discover_feed)

    response = feed_client.get("/feed/discover?surface=mobile")
    data = response.json()

    assert response.status_code == 200
    assert data["next_cursor"] == "next"
    assert data["items"][0]["id"] == "post-1"


def test_get_discover_feed_rate_limited(feed_client, monkeypatch):
    feed_routes.discover_rate_limiter._max_requests = 1
    feed_routes.discover_rate_limiter.reset()

    monkeypatch.setattr(
        feed_routes,
        "get_discover_feed",
        lambda **kwargs: DiscoverFeedResponse(items=[], next_cursor=None),
    )

    first = feed_client.get("/feed/discover")
    second = feed_client.get("/feed/discover")

    assert first.status_code == 200
    assert second.status_code == 429


def test_record_discover_interaction(feed_client, monkeypatch):
    calls = {}

    def _publish_discover_interaction_event(
        user_id,
        post_id,
        action,
        surface,
        variant,
        request_id,
        rank_score=0.0,
        reason="unknown",
    ):
        calls["payload"] = {
            "user_id": user_id,
            "post_id": post_id,
            "action": action,
            "surface": surface,
            "variant": variant,
            "request_id": request_id,
            "rank_score": rank_score,
            "reason": reason,
        }

    monkeypatch.setattr(
        feed_routes,
        "publish_discover_interaction_event",
        _publish_discover_interaction_event,
    )

    response = feed_client.post(
        "/feed/discover/interactions",
        json={
            "post_id": "post-99",
            "action": "click",
            "surface": "mobile",
            "variant": "A",
            "request_id": "req-99",
            "rank_score": 1.25,
            "reason": "fresh",
        },
    )

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert calls["payload"]["user_id"] == "user-1"
    assert calls["payload"]["post_id"] == "post-99"

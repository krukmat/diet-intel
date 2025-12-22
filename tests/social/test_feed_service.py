import json
import sqlite3
import uuid
from datetime import datetime, timedelta

import pytest

from app.services.database import db_service
from app.services.social import discover_feed_service
from app.services.social.feed_service import list_discover_feed, list_feed, list_following_posts


def _insert_feed_item(user_id: str, actor_id: str, payload, created_at: str):
    item_id = str(uuid.uuid4())
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO social_feed (id, user_id, actor_id, event_name, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                item_id,
                user_id,
                actor_id,
                "test.event",
                json.dumps(payload) if isinstance(payload, dict) else payload,
                created_at,
            ),
        )
        conn.commit()
    return item_id


def _cleanup_feed_items(item_ids):
    if not item_ids:
        return
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany("DELETE FROM social_feed WHERE id = ?", [(item_id,) for item_id in item_ids])
        conn.commit()


def _seed_following_feed_data(post_texts=None):
    follower_id = str(uuid.uuid4())
    followee_id = str(uuid.uuid4())
    post_ids = []
    now = datetime.utcnow()
    with db_service.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO users (id, email, password_hash, full_name, avatar_url, is_developer, role, is_active, email_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (follower_id, f"{follower_id}@example.com", "hash", "Follower User", None, False, "standard", True, True),
        )
        cursor.execute(
            """
            INSERT INTO users (id, email, password_hash, full_name, avatar_url, is_developer, role, is_active, email_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (followee_id, f"{followee_id}@example.com", "hash", "Followee User", None, False, "standard", True, True),
        )
        cursor.execute(
            """
            INSERT INTO user_profiles (user_id, handle, bio, avatar_url, visibility)
            VALUES (?, ?, ?, ?, ?)
            """,
            (followee_id, f"profile_{followee_id[:6]}", None, None, "public"),
        )
        cursor.execute(
            "INSERT INTO user_follows (follower_id, followee_id, status) VALUES (?, ?, 'active')",
            (follower_id, followee_id),
        )

        for idx, text in enumerate(post_texts or ["First post", "Second post"]):
            created_at = (now - timedelta(minutes=idx)).isoformat()
            post_id = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO posts (id, author_id, text, visibility, created_at, updated_at)
                VALUES (?, ?, ?, 'inherit_profile', ?, ?)
                """,
                (post_id, followee_id, text, created_at, created_at),
            )
            post_ids.append(post_id)

        if post_ids:
            cursor.execute(
                "INSERT INTO post_reactions (post_id, user_id) VALUES (?, ?)",
                (post_ids[0], follower_id),
            )

        conn.commit()

    return {"follower_id": follower_id, "followee_id": followee_id, "post_ids": post_ids}


def _cleanup_following_feed_data(data):
    if not data:
        return

    with db_service.get_connection() as conn:
        cursor = conn.cursor()

        if data["post_ids"]:
            cursor.executemany(
                "DELETE FROM post_reactions WHERE post_id = ?",
                [(post_id,) for post_id in data["post_ids"]],
            )
            cursor.executemany(
                "DELETE FROM posts WHERE id = ?",
                [(post_id,) for post_id in data["post_ids"]],
            )

        cursor.execute(
            "DELETE FROM user_follows WHERE follower_id = ? AND followee_id = ?",
            (data["follower_id"], data["followee_id"]),
        )
        cursor.execute(
            "DELETE FROM user_profiles WHERE user_id IN (?, ?)",
            (data["followee_id"], data["follower_id"]),
        )
        cursor.execute(
            "DELETE FROM users WHERE id IN (?, ?)",
            (data["follower_id"], data["followee_id"]),
        )
        conn.commit()


@pytest.fixture
def following_db(monkeypatch):
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            email TEXT,
            password_hash TEXT,
            full_name TEXT,
            avatar_url TEXT,
            is_developer BOOLEAN,
            role TEXT,
            is_active BOOLEAN,
            email_verified BOOLEAN
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE user_profiles (
            user_id TEXT PRIMARY KEY,
            handle TEXT,
            bio TEXT,
            avatar_url TEXT,
            visibility TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE user_follows (
            follower_id TEXT NOT NULL,
            followee_id TEXT NOT NULL,
            status TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE posts (
            id TEXT PRIMARY KEY,
            author_id TEXT NOT NULL,
            text TEXT NOT NULL,
            visibility TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE post_media (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            type TEXT NOT NULL,
            url TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE post_reactions (
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            reaction_type TEXT DEFAULT 'like'
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE post_comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            text TEXT NOT NULL
        )
        """
    )
    conn.commit()

    class _InMemoryCtx:
        def __init__(self, connection):
            self._connection = connection

        def __enter__(self_inner):
            return self_inner._connection

        def __exit__(self_inner, exc_type, exc, tb):
            pass

    monkeypatch.setattr(db_service, "get_connection", lambda: _InMemoryCtx(conn))
    yield conn
    conn.close()


def test_list_feed_handles_invalid_cursor_gracefully():
    user_id = "batch5_feed_user"
    item_ids = []
    try:
        now = datetime.utcnow().isoformat()
        item_ids.append(_insert_feed_item(user_id, "actor1", {"event": "first"}, now))
        item_ids.append(_insert_feed_item(user_id, "actor2", {"event": "second"}, now))

        response = list_feed(user_id, limit=1, cursor="not_a_cursor")
        assert len(response.items) == 1
        assert response.next_cursor is not None
        assert response.items[0].payload["event"] in {"first", "second"}
    finally:
        _cleanup_feed_items(item_ids)


def test_list_feed_skips_invalid_payload():
    user_id = "batch8_feed_user"
    item_ids = []
    try:
        now = datetime.utcnow().isoformat()
        item_ids.append(_insert_feed_item(user_id, "actor-invalid", "not-json", now))
        item_ids.append(_insert_feed_item(user_id, "actor-valid", {"event": "valid"}, now))

        response = list_feed(user_id, limit=2)
        assert len(response.items) == 1
        assert response.items[0].payload["event"] == "valid"
    finally:
        _cleanup_feed_items(item_ids)


def test_list_following_posts_paginates_with_cursor(following_db):
    data = _seed_following_feed_data(["Newest post", "Older post"])
    try:
        first_page = list_following_posts(data["follower_id"], limit=1)
        assert len(first_page.items) == 1
        assert first_page.next_cursor is not None
        first_post_id = first_page.items[0].payload["post_id"]

        second_page = list_following_posts(data["follower_id"], limit=1, cursor=first_page.next_cursor)
        assert len(second_page.items) == 1
        assert second_page.items[0].payload["post_id"] != first_post_id
    finally:
        _cleanup_following_feed_data(data)


def test_list_following_posts_ignores_invalid_cursor(following_db):
    data = _seed_following_feed_data(["Page one", "Page two"])
    try:
        response = list_following_posts(data["follower_id"], limit=2, cursor="invalid_cursor")
        assert len(response.items) == 2
        assert response.next_cursor is None or isinstance(response.next_cursor, str)
    finally:
        _cleanup_following_feed_data(data)


def test_list_following_posts_handles_db_error(monkeypatch):
    class BrokenConn:
        def __enter__(self):
            raise sqlite3.OperationalError("boom")

        def __exit__(self, exc_type, exc, tb):
            pass

    monkeypatch.setattr(db_service, "get_connection", lambda: BrokenConn())

    response = list_following_posts("user-error", limit=1)
    assert response.items == []
    assert response.next_cursor is None


def test_list_discover_feed_returns_transformed_items(monkeypatch):
    class DummyReason:
        value = "test_reason"

    class DummyDiscoveryItem:
        def __init__(self):
            self.id = "discover-1"
            self.author_id = "author-1"
            self.text = "Curated post"
            self.rank_score = 42
            self.reason = DummyReason()
            self.surface = "web"
            self.metadata = {"likes_count": 3, "comments_count": 1}
            self.created_at = datetime.utcnow()

    class DummyResponse:
        variant = "control"
        request_id = "req-1"
        next_cursor = "next-cursor"

        def __init__(self):
            self.items = [DummyDiscoveryItem()]

    def fake_discover(*args, **kwargs):
        return DummyResponse()

    monkeypatch.setattr(discover_feed_service, "get_discover_feed", fake_discover)

    response = list_discover_feed("user-123", limit=1)
    assert response.items
    assert response.items[0].payload["rank_score"] == 42
    assert response.next_cursor == "next-cursor"


def test_list_discover_feed_handles_errors(monkeypatch):
    def raise_error(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(discover_feed_service, "get_discover_feed", raise_error)

    response = list_discover_feed("user-error", limit=1)
    assert response.items == []
    assert response.next_cursor is None

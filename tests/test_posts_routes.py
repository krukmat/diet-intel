from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from app.models.social.post import (
    CommentDetail,
    CommentCreate,
    PostDetail,
    PostMedia,
    PostStats,
    ReactionType,
)
from app.routes import posts as posts_routes


class _FakeUser:
    def __init__(self, id: str):
        self.id = id


def _build_post_detail(author_id="user1"):
    return PostDetail(
        id="post-1",
        author_id=author_id,
        text="hello world",
        media=[],
        stats=PostStats(likes_count=2, comments_count=1),
        visibility="inherit_profile",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        is_liked_by_user=False,
    )


class _FakePostService:
    @staticmethod
    def create_post(author_id, post):
        return _build_post_detail(author_id=author_id)

    @staticmethod
    def get_post(post_id, user_id):
        return _build_post_detail(author_id=user_id)

    @staticmethod
    def list_user_posts(user_id, limit, cursor):
        return [_build_post_detail(author_id=user_id)]


class _FakeReactionService:
    @staticmethod
    def toggle_reaction(post_id, user_id, reaction_type):
        return {"liked": True, "likes_count": 5}


class _FakeCommentService:
    @staticmethod
    def create_comment(post_id, author_id, comment):
        detail = CommentDetail(
            id="c-1",
            post_id=post_id,
            author_id=author_id,
            text=comment.text,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        return {"comment": detail.dict(), "comments_count": 1}

    @staticmethod
    def get_comments(post_id, limit, cursor):
        return [
            CommentDetail(
                id="c-2",
                post_id=post_id,
                author_id="author",
                text="comment",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        ]


@pytest.fixture
def posts_client(monkeypatch):
    monkeypatch.setattr(posts_routes, "PostService", _FakePostService)
    monkeypatch.setattr(posts_routes, "ReactionService", _FakeReactionService)
    monkeypatch.setattr(posts_routes, "CommentService", _FakeCommentService)
    monkeypatch.setattr(posts_routes, "assert_feature_enabled", lambda _: None)

    app = FastAPI()
    app.include_router(posts_routes.router)
    app.dependency_overrides[posts_routes.get_current_user] = lambda: _FakeUser(id="user1")
    yield TestClient(app)


def test_create_post_success(posts_client):
    response = posts_client.post("/posts", json={"text": "quick update"})
    assert response.status_code == 200
    assert response.json()["post"]["author_id"] == "user1"


def test_create_post_feature_disabled(posts_client, monkeypatch):
    def _disabled(feature_name):
        raise HTTPException(status_code=404, detail="Feature disabled")

    monkeypatch.setattr(posts_routes, "assert_feature_enabled", _disabled)
    response = posts_client.post("/posts", json={"text": "blocked"})
    assert response.status_code == 404


def test_get_post_not_found(posts_client, monkeypatch):
    def _raise(post_id, user_id):
        raise ValueError("missing")

    monkeypatch.setattr(posts_routes.PostService, "get_post", staticmethod(_raise))
    response = posts_client.get("/posts/post-1")
    assert response.status_code == 404


def test_get_user_posts_limit_validation(posts_client):
    response = posts_client.get("/users/user1/posts?limit=0")
    assert response.status_code == 422


def test_toggle_reaction_value_error(posts_client, monkeypatch):
    def _fail(post_id, user_id, reaction_type):
        raise ValueError("bad reaction")

    monkeypatch.setattr(posts_routes.ReactionService, "toggle_reaction", staticmethod(_fail))
    response = posts_client.post("/posts/post-1/react", json={})
    assert response.status_code == 400


def test_create_comment_success(posts_client):
    response = posts_client.post(
        "/posts/post-1/comments", json={"text": "nice post"}
    )
    assert response.status_code == 200
    assert response.json()["comments_count"] == 1


def test_create_comment_value_error(posts_client, monkeypatch):
    def _fail(post_id, author_id, comment):
        raise ValueError("invalid comment")

    monkeypatch.setattr(posts_routes.CommentService, "create_comment", staticmethod(_fail))
    response = posts_client.post(
        "/posts/post-1/comments", json={"text": "bad"}
    )
    assert response.status_code == 400


def test_get_comments_success(posts_client):
    response = posts_client.get("/posts/post-1/comments")
    assert response.status_code == 200
    assert response.json()["comments"][0]["post_id"] == "post-1"


def test_get_user_posts_success(posts_client):
    response = posts_client.get("/users/user1/posts")
    assert response.status_code == 200
    assert response.json()["posts"][0]["author_id"] == "user1"


def test_get_user_posts_value_error(posts_client, monkeypatch):
    def _fail(user_id, limit, cursor):
        raise ValueError("bad cursor")

    monkeypatch.setattr(posts_routes.PostService, "list_user_posts", staticmethod(_fail))
    response = posts_client.get("/users/user1/posts")
    assert response.status_code == 400


def test_toggle_reaction_success(posts_client):
    response = posts_client.post("/posts/post-1/react", json={})
    assert response.status_code == 200
    assert response.json()["liked"] is True


def test_get_comments_value_error(posts_client, monkeypatch):
    def _fail(post_id, limit, cursor):
        raise ValueError("db")

    monkeypatch.setattr(posts_routes.CommentService, "get_comments", staticmethod(_fail))
    response = posts_client.get("/posts/post-1/comments")
    assert response.status_code == 400


def test_create_post_value_error(posts_client, monkeypatch):
    def _fail(author_id, post):
        raise ValueError("blocked")

    monkeypatch.setattr(posts_routes.PostService, "create_post", staticmethod(_fail))
    response = posts_client.post("/posts", json={"text": "blocked"})
    assert response.status_code == 400

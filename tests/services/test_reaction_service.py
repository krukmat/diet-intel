from types import SimpleNamespace

import pytest

from app.services.social import reaction_service as reaction_module
from app.services.social.reaction_service import ReactionService


class _DummyCursor:
    def __init__(self, row_data):
        self.row_data = row_data

    def execute(self, *args, **kwargs):
        return None

    def fetchone(self):
        return self.row_data


class _DummyConnection:
    def __init__(self, row_data, fail_on_enter=False):
        self.row_data = row_data
        self.fail_on_enter = fail_on_enter

    def __enter__(self):
        if self.fail_on_enter:
            raise RuntimeError("db fail")
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return _DummyCursor(self.row_data)


class _DummyDBService:
    def __init__(self, row_data, fail_on_enter=False):
        self.row_data = row_data
        self.fail_on_enter = fail_on_enter

    def get_connection(self):
        return _DummyConnection(self.row_data, self.fail_on_enter)


def _set_posts(monkeypatch, likes_count=3, author_id="author"):
    stats = SimpleNamespace(likes_count=likes_count)
    monkeypatch.setattr(
        reaction_module.PostService, "_get_post_stats", lambda post_id: stats
    )
    monkeypatch.setattr(
        reaction_module.PostService, "toggle_reaction", lambda *args, **kwargs: True
    )
    monkeypatch.setattr(
        "app.services.database.db_service",
        _DummyDBService(row_data={"author_id": author_id})
    )
    return stats


def _patch_notification(monkeypatch, call_log):
    def _fake_enqueue(user, notification_type, payload):
        call_log.append((user, notification_type, payload))

    monkeypatch.setattr(
        "app.services.notifications.notification_service.NotificationService.enqueue_notification",
        _fake_enqueue
    )


def test_toggle_reaction_notifies_author(monkeypatch):
    call_log: list = []
    stats = _set_posts(monkeypatch, likes_count=5, author_id="author-123")
    _patch_notification(monkeypatch, call_log)

    result = ReactionService.toggle_reaction("post-1", "actor-1")
    assert result["liked"] is True
    assert result["likes_count"] == stats.likes_count
    assert call_log
    assert call_log[0][0] == "author-123"


def test_toggle_reaction_skips_self_notifications(monkeypatch):
    call_log: list = []
    stats = _set_posts(monkeypatch, likes_count=2, author_id="actor-1")
    _patch_notification(monkeypatch, call_log)

    result = ReactionService.toggle_reaction("post-2", "actor-1")
    assert result["liked"] is True
    assert result["likes_count"] == stats.likes_count
    assert not call_log


def test_toggle_reaction_handles_db_failure(monkeypatch):
    call_log: list = []
    monkeypatch.setattr(
        reaction_module.PostService, "_get_post_stats", lambda *_: SimpleNamespace(likes_count=1)
    )
    monkeypatch.setattr(
        reaction_module.PostService, "toggle_reaction", lambda *args, **kwargs: True
    )
    monkeypatch.setattr(
        "app.services.database.db_service",
        _DummyDBService(row_data={"author_id": "ghost"}, fail_on_enter=True)
    )
    _patch_notification(monkeypatch, call_log)

    result = ReactionService.toggle_reaction("post-3", "actor-2")
    assert result["liked"] is True
    assert result["likes_count"] == 1
    assert not call_log

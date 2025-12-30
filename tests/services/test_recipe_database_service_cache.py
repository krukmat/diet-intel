import sqlite3

import pytest

from app.services.recipe_database import RecipeDatabaseService


class _BrokenConnection:
    def __enter__(self):
        raise sqlite3.OperationalError("simulated DB outage")

    def __exit__(self, exc_type, exc, tb):
        return False


@pytest.fixture
def recipe_db(tmp_path):
    return RecipeDatabaseService(str(tmp_path / "recipe-cache.db"))


@pytest.mark.asyncio
async def test_search_recipes_returns_empty_on_connection_error(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    results = await recipe_db.search_recipes(user_id="any", limit=1)

    assert results == []


@pytest.mark.asyncio
async def test_get_recipe_returns_none_on_connection_error(recipe_db, monkeypatch):
    monkeypatch.setattr(recipe_db, "get_connection", lambda *args, **kwargs: _BrokenConnection())

    assert await recipe_db.get_recipe("missing-id") is None

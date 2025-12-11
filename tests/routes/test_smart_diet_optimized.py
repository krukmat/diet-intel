import asyncio
from datetime import datetime
from types import SimpleNamespace
from typing import List

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.smart_diet import (
    SmartDietContext,
    SmartDietResponse,
    SuggestionFeedback
)
from app.routes import smart_diet_optimized as route_module


def _make_response() -> SmartDietResponse:
    return SmartDietResponse(
        user_id="user-1",
        context_type=SmartDietContext.TODAY,
        suggestions=[],
        today_highlights=[],
        optimizations=[],
        discoveries=[],
        insights=[],
        nutritional_summary={"calories": 120},
        personalization_factors=["starter"],
        total_suggestions=1,
        avg_confidence=0.91,
        generation_time_ms=42.3
    )


class DummyMonitor:
    def measure_api_call(self, *args, **kwargs):
        class _Ctx:
            async def __aenter__(self_inner):
                return self_inner

            async def __aexit__(self_inner, exc_type, exc, tb):
                return False

        return _Ctx()

    def get_performance_summary(self, hours, metric_type):
        return [
            SimpleNamespace(
                metric_type="suggestions",
                operation="get",
                total_calls=1,
                avg_duration_ms=28.4,
                p95_duration_ms=45.3,
                success_rate=0.98,
                error_count=0
            )
        ]

    def get_cache_hit_rate(self, hours):
        return [{"period_hours": hours, "hit_rate": 92.0}]

    def get_recent_alerts(self, hours):
        return [{"severity": "info", "message": "healthy"}]

    def get_performance_health_score(self):
        return 0.96


class DummyRedis:
    def __init__(self):
        self.invalidations: List[str] = []

    async def invalidate_pattern(self, pattern: str):
        self.invalidations.append(pattern)

    def get_cache_stats(self):
        return {"hits": 5, "misses": 1}

    async def health_check(self):
        return {"healthy": True, "details": {}}


class DummyEngine:
    def __init__(self):
        self.optimized_cache = SimpleNamespace(
            memory_cache={"warm": True},
            max_memory_cache_size=16
        )

    async def get_smart_suggestions_optimized(self, user_id, request):
        return _make_response()

    async def process_suggestion_feedback(self, feedback):
        return True

    def get_performance_metrics(self):
        return {
            "engine_version": "1.0",
            "cache_size": len(self.optimized_cache.memory_cache)
        }


def _feedback_payload(**kwargs):
    payload = SuggestionFeedback(**kwargs).model_dump()
    if isinstance(payload.get("feedback_at"), datetime):
        payload["feedback_at"] = payload["feedback_at"].isoformat()
    return payload


@pytest.fixture
def optimized_env(monkeypatch):
    monitor = DummyMonitor()
    redis = DummyRedis()
    engine = DummyEngine()

    async def _fake_session(req):
        return "user-1"

    monkeypatch.setattr(route_module, "performance_monitor", monitor)
    monkeypatch.setattr(route_module, "redis_cache_service", redis)
    monkeypatch.setattr(route_module, "smart_diet_engine_optimized", engine)
    monkeypatch.setattr(route_module, "get_session_user_id", _fake_session)

    test_app = FastAPI()
    test_app.include_router(route_module.router, prefix="/smart-diet/optimized")
    client = TestClient(test_app)
    return SimpleNamespace(
        client=client,
        redis=redis,
        monitor=monitor,
        engine=engine,
        user_id="user-1"
    )


@pytest.mark.parametrize("context", ["invalid-context", "none"])
def test_get_suggestions_invalid_context(optimized_env, context):
    response = optimized_env.client.get(f"/smart-diet/optimized/suggestions?context={context}")
    assert response.status_code == 400
    assert "Invalid context" in response.json()["detail"]


def test_get_suggestions_invalid_max_suggestions(optimized_env):
    response = optimized_env.client.get("/smart-diet/optimized/suggestions?max_suggestions=0")
    assert response.status_code == 400
    assert "max_suggestions" in response.json()["detail"]


def test_get_suggestions_requires_auth(monkeypatch, optimized_env):
    async def _none_session(req):
        return None

    monkeypatch.setattr(route_module, "get_session_user_id", _none_session)
    response = optimized_env.client.get("/smart-diet/optimized/suggestions")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_get_suggestions_success(optimized_env):
    response = optimized_env.client.get("/smart-diet/optimized/suggestions")
    assert response.status_code == 200
    assert response.json()["total_suggestions"] == 1
    assert response.json()["avg_confidence"] == pytest.approx(0.91)


def test_get_suggestions_invalid_min_confidence(optimized_env):
    response = optimized_env.client.get("/smart-diet/optimized/suggestions?min_confidence=1.5")
    assert response.status_code == 400
    assert "min_confidence" in response.json()["detail"]


def test_get_suggestions_engine_error(monkeypatch, optimized_env):
    async def _raise_engine(user_id, request):
        raise RuntimeError("engine fail")

    monkeypatch.setattr(
        route_module.smart_diet_engine_optimized,
        "get_smart_suggestions_optimized",
        _raise_engine
    )

    response = optimized_env.client.get("/smart-diet/optimized/suggestions")
    assert response.status_code == 500
    assert "Error generating Smart Diet" in response.json()["detail"]


def test_feedback_user_mismatch(optimized_env):
    payload = _feedback_payload(
        suggestion_id="calc-1",
        user_id="other-user",
        action="accepted"
    )
    response = optimized_env.client.post("/smart-diet/optimized/feedback", json=payload)
    assert response.status_code == 400
    assert "user_id must match" in response.json()["detail"]


def test_feedback_success_invalidate_cache(optimized_env):
    payload = _feedback_payload(
        suggestion_id="calc-2",
        user_id="user-1",
        action="accepted"
    )
    response = optimized_env.client.post("/smart-diet/optimized/feedback", json=payload)
    assert response.status_code == 200
    assert "Smart Diet feedback" in response.json()["message"]
    assert optimized_env.redis.invalidations


def test_feedback_invalid_action(monkeypatch, optimized_env):
    payload = _feedback_payload(
        suggestion_id="calc-3",
        user_id="user-1",
        action="invalid"
    )
    response = optimized_env.client.post("/smart-diet/optimized/feedback", json=payload)
    assert response.status_code == 400
    assert "action must be" in response.json()["detail"]


def test_feedback_engine_failure(monkeypatch, optimized_env):
    async def _fail_feedback(feedback):
        return False

    monkeypatch.setattr(
        route_module.smart_diet_engine_optimized,
        "process_suggestion_feedback",
        _fail_feedback
    )

    payload = _feedback_payload(
        suggestion_id="calc-4",
        user_id="user-1",
        action="accepted"
    )
    response = optimized_env.client.post("/smart-diet/optimized/feedback", json=payload)
    assert response.status_code == 500
    assert "Failed to process feedback" in response.json()["detail"]


def test_performance_and_cache_endpoints(optimized_env):
    metrics = optimized_env.client.get("/smart-diet/optimized/performance-metrics")
    assert metrics.status_code == 200
    assert "period_hours" in metrics.json()

    health = optimized_env.client.get("/smart-diet/optimized/cache-health")
    assert health.status_code == 200
    body = health.json()
    assert body["overall_healthy"] is True
    assert "memory_cache" in body

    warmup = optimized_env.client.post("/smart-diet/optimized/warmup-cache")
    assert warmup.status_code == 200
    assert "Cache warmup completed" in warmup.json()["message"]


def test_warmup_cache_handles_engine_errors(monkeypatch, optimized_env):
    async def _raise_warmup(user_id, request):
        raise RuntimeError("warmup fail")

    monkeypatch.setattr(
        route_module.smart_diet_engine_optimized,
        "get_smart_suggestions_optimized",
        _raise_warmup
    )
    response = optimized_env.client.post("/smart-diet/optimized/warmup-cache")
    assert response.status_code == 200
    results = response.json()["results"]
    assert any(result["status"] == "error" for result in results)

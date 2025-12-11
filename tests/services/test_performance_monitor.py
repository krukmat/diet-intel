import pytest
from datetime import datetime

from app.services.performance_monitor import PerformanceMonitor, PerformanceMetric


@pytest.mark.asyncio
async def test_measure_api_call_records_metric_and_summary():
    monitor = PerformanceMonitor()

    async with monitor.measure_api_call("smart_diet_suggestions"):
        pass

    assert monitor.metrics
    summary = monitor.get_performance_summary(metric_type="api_call")
    assert summary
    assert summary[0].total_calls == 1
    assert summary[0].success_rate == 1.0


@pytest.mark.asyncio
async def test_measure_api_call_failure_triggers_alert():
    monitor = PerformanceMonitor()

    for _ in range(4):
        async with monitor.measure_api_call("smart_diet_suggestions"):
            pass

    with pytest.raises(ValueError):
        async with monitor.measure_api_call("smart_diet_suggestions"):
            raise ValueError("boom")

    assert any(alert["type"] == "high_error_rate" for alert in monitor.alerts)


def test_record_mobile_metric_warns_when_slow():
    monitor = PerformanceMonitor()
    monitor.record_mobile_metric("screen_render", duration_ms=3000, metadata={"device": "android"})

    alerts = monitor.get_recent_alerts()
    assert any(alert["type"] == "mobile_performance" for alert in alerts)


def test_cache_hit_rate_calculates_percentage():
    monitor = PerformanceMonitor()
    now = datetime.now()

    hit_metric = PerformanceMetric(
        timestamp=now,
        metric_type="cache_operation",
        operation="redis_get",
        duration_ms=5.0,
        success=True,
        metadata={"cache_type": "redis", "operation": "get"}
    )
    miss_metric = PerformanceMetric(
        timestamp=now,
        metric_type="cache_operation",
        operation="redis_set",
        duration_ms=12.0,
        success=False,
        metadata={"cache_type": "redis", "operation": "set"}
    )

    monitor.record_metric(hit_metric)
    monitor.record_metric(miss_metric)

    hit_rates = monitor.get_cache_hit_rate()
    assert hit_rates["redis"] == 50.0


def test_get_performance_health_score_defaults_to_excellent():
    monitor = PerformanceMonitor()
    health = monitor.get_performance_health_score()

    assert health["status"] == "excellent"
    assert health["overall_score"] == 100

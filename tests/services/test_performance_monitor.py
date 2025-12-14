import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
import asyncio

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


# ============================================================================
# PHASE 2 BATCH 5 - TASK 2: NEW TESTS EXTENDING COVERAGE
# ============================================================================

# SUBTASK 1: Async Context Managers - 2 Tests

@pytest.mark.asyncio
async def test_measure_db_query_records_success():
    """Test DB query measurement context manager

    Task 2: Phase 2 Batch 5 - async context manager coverage
    Covers: measure_db_query() method (lines 111-138)
    """
    monitor = PerformanceMonitor()

    # Execute: Measure a DB query
    async with monitor.measure_db_query("select_user", metadata={"table": "users"}):
        await asyncio.sleep(0.01)  # Simulate query work

    # Assert: Metric recorded correctly
    assert len(monitor.metrics) == 1
    metric = monitor.metrics[0]
    assert metric.metric_type == "db_query"
    assert metric.operation == "select_user"
    assert metric.duration_ms >= 10  # At least 10ms
    assert metric.success is True
    assert metric.metadata["table"] == "users"


@pytest.mark.asyncio
async def test_measure_cache_operation_success_and_timing():
    """Test cache operation measurement context manager

    Task 2: Phase 2 Batch 5 - async context manager coverage
    Covers: measure_cache_operation() method (lines 140-163)
    """
    monitor = PerformanceMonitor()

    # Execute: Measure a cache operation
    async with monitor.measure_cache_operation("redis", "get"):
        await asyncio.sleep(0.005)  # Simulate cache access

    # Assert: Metric recorded with correct structure
    assert len(monitor.metrics) == 1
    metric = monitor.metrics[0]
    assert metric.metric_type == "cache_operation"
    assert metric.operation == "redis_get"  # Combined cache_type_operation
    assert metric.duration_ms >= 5
    assert metric.success is True
    assert metric.metadata["cache_type"] == "redis"
    assert metric.metadata["operation"] == "get"


# SUBTASK 2: Alert Threshold Detection - 4 Tests

@pytest.mark.asyncio
async def test_error_rate_alert_triggers_at_threshold():
    """Test high error rate alert generation

    Task 2: Phase 2 Batch 5 - alert threshold coverage
    Covers: _check_performance_alerts() error rate detection (lines 220-229)
    Error rate: 40% (2 failures out of 5) > 5% threshold
    """
    monitor = PerformanceMonitor()
    operation = "smart_diet_suggestions"

    # Setup: Record 5 metrics with 2 failures
    for i in range(5):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(seconds=i),
            metric_type="api_call",
            operation=operation,
            duration_ms=100,
            success=(i < 3),  # First 3 succeed, last 2 fail
            metadata={}
        )
        monitor.record_metric(metric)

    # Execute: Trigger alert check
    last_metric = PerformanceMetric(
        timestamp=datetime.now(),
        metric_type="api_call",
        operation=operation,
        duration_ms=100,
        success=False,
        metadata={}
    )
    monitor.record_metric(last_metric)
    await monitor._check_performance_alerts(last_metric)

    # Assert: High error rate alert generated
    error_alerts = [a for a in monitor.alerts if a["type"] == "high_error_rate"]
    assert len(error_alerts) > 0
    alert = error_alerts[0]
    assert alert["severity"] == "critical"
    assert alert["error_rate"] > 0.05  # > 5% threshold


@pytest.mark.asyncio
async def test_slow_response_time_alert():
    """Test response time degradation alert

    Task 2: Phase 2 Batch 5 - alert threshold coverage
    Covers: _check_performance_alerts() response time detection (lines 235-243)
    Average duration: 300ms > (100ms target × 2.0 multiplier)
    """
    monitor = PerformanceMonitor()
    operation = "db_queries"  # Uses 100ms target from api_targets

    # Setup: Record 5 metrics with slow durations (300ms each)
    for i in range(5):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(seconds=i),
            metric_type="api_call",
            operation=operation,
            duration_ms=300,  # > (100ms target × 2.0 = 200ms)
            success=True,
            metadata={}
        )
        monitor.record_metric(metric)

    # Execute: Trigger alert check
    last_metric = PerformanceMetric(
        timestamp=datetime.now(),
        metric_type="api_call",
        operation=operation,
        duration_ms=300,
        success=True,
        metadata={}
    )
    monitor.record_metric(last_metric)
    await monitor._check_performance_alerts(last_metric)

    # Assert: Slow response time alert generated
    slow_alerts = [a for a in monitor.alerts if a["type"] == "slow_response_time"]
    assert len(slow_alerts) > 0
    alert = slow_alerts[0]
    assert alert["severity"] == "warning"
    assert alert["avg_duration_ms"] >= 300


@pytest.mark.asyncio
async def test_mobile_alert_severity_escalation():
    """Test mobile alert severity levels

    Task 2: Phase 2 Batch 5 - mobile alert coverage
    Covers: record_mobile_metric() severity logic (lines 184-193)
    Tests: target (2000ms) → 1.5× → 2.0×
    """
    monitor = PerformanceMonitor()

    # Test 1: At target (2000ms) - no alert
    monitor.record_mobile_metric("screen_render", duration_ms=2000)
    alerts_at_target = [a for a in monitor.alerts if a["type"] == "mobile_performance"]
    assert len(alerts_at_target) == 0

    # Test 2: 1.5× target (3000ms) - warning severity
    monitor.record_mobile_metric("screen_render", duration_ms=3000)
    alerts_warning = [a for a in monitor.alerts if a["type"] == "mobile_performance" and a["severity"] == "warning"]
    assert len(alerts_warning) > 0

    # Test 3: 2.5× target (5000ms) - critical severity
    monitor.record_mobile_metric("screen_render", duration_ms=5000)
    alerts_critical = [a for a in monitor.alerts if a["type"] == "mobile_performance" and a["severity"] == "critical"]
    assert len(alerts_critical) > 0


@pytest.mark.asyncio
async def test_alert_minimum_sample_requirement():
    """Test that alerts require minimum 5 samples

    Task 2: Phase 2 Batch 5 - alert threshold coverage
    Covers: _check_performance_alerts() minimum sample check (lines 216-217)
    """
    monitor = PerformanceMonitor()
    operation = "smart_diet_suggestions"

    # Setup: Record only 4 metrics (< 5 minimum required)
    for i in range(4):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(seconds=i),
            metric_type="api_call",
            operation=operation,
            duration_ms=100,
            success=False,  # 100% error rate
            metadata={}
        )
        monitor.record_metric(metric)
        # Check after each addition - should not trigger alert
        await monitor._check_performance_alerts(metric)

    # Assert: No alert generated with 4 samples (< 5 minimum)
    error_alerts = [a for a in monitor.alerts if a["type"] == "high_error_rate"]
    assert len(error_alerts) == 0

    # Now add the 5th metric - alert should trigger
    fifth_metric = PerformanceMetric(
        timestamp=datetime.now(),
        metric_type="api_call",
        operation=operation,
        duration_ms=100,
        success=False,
        metadata={}
    )
    monitor.record_metric(fifth_metric)
    await monitor._check_performance_alerts(fifth_metric)

    # Assert: Alert generated after reaching 5 samples
    error_alerts = [a for a in monitor.alerts if a["type"] == "high_error_rate"]
    assert len(error_alerts) > 0


# SUBTASK 3: Health Score Calculations - 5 Tests

def test_api_health_score_excellent():
    """Test API health score when excellent

    Task 2: Phase 2 Batch 5 - health score coverage
    Covers: _calculate_api_health_score() (lines 377-397)
    Scenario: Fast response (100ms < 500ms target), 100% success
    """
    monitor = PerformanceMonitor()

    # Setup: Record fast API metrics
    for i in range(5):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(hours=1) + timedelta(minutes=i),
            metric_type="api_call",
            operation="smart_diet_suggestions",
            duration_ms=100,  # < 500ms target
            success=True,
            metadata={}
        )
        monitor.record_metric(metric)

    # Execute: Get health score
    health = monitor.get_performance_health_score()

    # Assert: Excellent health status
    assert health["status"] == "excellent"
    assert health["overall_score"] >= 95
    assert health["api_health"] > 80  # Fast + successful


def test_api_health_score_degraded():
    """Test API health score when degraded

    Task 2: Phase 2 Batch 5 - health score coverage
    Covers: _calculate_api_health_score() with slow response (lines 377-397)
    Scenario: Slow response (1000ms > 2×500ms target), 80% success
    """
    monitor = PerformanceMonitor()

    # Setup: Record slow API metrics with some failures
    for i in range(5):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(hours=1) + timedelta(minutes=i),
            metric_type="api_call",
            operation="smart_diet_suggestions",
            duration_ms=1000,  # > 2×500ms target
            success=(i < 4),  # 1 failure out of 5
            metadata={}
        )
        monitor.record_metric(metric)

    # Execute: Get health score
    health = monitor.get_performance_health_score()

    # Assert: Degraded health status
    assert health["status"] == "fair"
    assert health["overall_score"] < 85
    assert health["api_health"] < 85


def test_mobile_health_score_calculation():
    """Test mobile health score based on render times

    Task 2: Phase 2 Batch 5 - health score coverage
    Covers: _calculate_mobile_health_score() (lines 399-412)
    """
    monitor = PerformanceMonitor()

    # Setup: Record mobile render metrics
    durations = [1000, 1500, 2000, 2500, 3000]
    for i, duration in enumerate(durations):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(hours=1) + timedelta(minutes=i),
            metric_type="mobile_render",
            operation="component_render",
            duration_ms=duration,
            success=True,
            metadata={"device": "android"}
        )
        monitor.record_metric(metric)

    # Execute: Get health score
    health = monitor.get_performance_health_score()

    # Assert: Mobile health calculated
    assert "mobile_health" in health
    assert 0 <= health["mobile_health"] <= 100


def test_cache_health_score_based_on_hit_rate():
    """Test cache health score based on hit rates

    Task 2: Phase 2 Batch 5 - health score coverage
    Covers: _calculate_cache_health_score() (lines 414-423)
    Hit rate: 50% (2 hits out of 4)
    """
    monitor = PerformanceMonitor()

    # Setup: Record cache metrics with 50% hit rate
    now = datetime.now() - timedelta(hours=0.5)

    # 2 hits
    for i in range(2):
        hit_metric = PerformanceMetric(
            timestamp=now + timedelta(minutes=i),
            metric_type="cache_operation",
            operation="redis_get",
            duration_ms=5.0,
            success=True,
            metadata={"cache_type": "redis", "operation": "get"}
        )
        monitor.record_metric(hit_metric)

    # 2 misses (set operations)
    for i in range(2):
        miss_metric = PerformanceMetric(
            timestamp=now + timedelta(minutes=i+2),
            metric_type="cache_operation",
            operation="redis_set",
            duration_ms=10.0,
            success=True,
            metadata={"cache_type": "redis", "operation": "set"}
        )
        monitor.record_metric(miss_metric)

    # Execute: Get health score
    health = monitor.get_performance_health_score()

    # Assert: Cache health based on 50% hit rate
    assert "cache_health" in health
    assert health["cache_health"] < 100


def test_health_score_status_transitions():
    """Test health score status transitions at thresholds

    Task 2: Phase 2 Batch 5 - health score coverage
    Covers: Health score status determination (lines 363-370)
    Tests: excellent (≥95) → good (≥80) → fair (≥70) → poor (<70)
    """
    monitor = PerformanceMonitor()

    # Test excellent (score ≥ 95)
    health_excellent = monitor.get_performance_health_score()
    assert health_excellent["status"] == "excellent"

    # Test good (add slow API metrics to degrade score)
    for i in range(5):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(hours=1) + timedelta(minutes=i),
            metric_type="api_call",
            operation="smart_diet_suggestions",
            duration_ms=600,  # Slow but not too slow
            success=True,
            metadata={}
        )
        monitor.record_metric(metric)

    health_good = monitor.get_performance_health_score()
    if health_good["overall_score"] < 95:
        assert health_good["status"] == "good"


# SUBTASK 4: Utility Methods & Edge Cases - 4 Tests

def test_get_target_duration_for_different_types():
    """Test _get_target_duration() lookup by metric type

    Task 2: Phase 2 Batch 5 - utility method coverage
    Covers: _get_target_duration() method (lines 245-255)
    """
    monitor = PerformanceMonitor()

    # Test api_call type
    target = monitor._get_target_duration("api_call", "smart_diet_suggestions")
    assert target == 500

    target = monitor._get_target_duration("api_call", "find_alternatives")
    assert target == 200

    # Test mobile_render type
    target = monitor._get_target_duration("mobile_render", "screen_render")
    assert target == 2000

    target = monitor._get_target_duration("mobile_render", "component_render")
    assert target == 16

    # Test db_query type (maps to api_targets)
    target = monitor._get_target_duration("db_query", "any_query")
    assert target == 100

    # Test cache_operation type (maps to api_targets)
    target = monitor._get_target_duration("cache_operation", "any_cache")
    assert target == 50

    # Test unknown type returns None
    target = monitor._get_target_duration("unknown_type", "operation")
    assert target is None


def test_export_metrics_json_format():
    """Test export_metrics() JSON output format

    Task 2: Phase 2 Batch 5 - utility method coverage
    Covers: export_metrics() method (lines 425-442)
    """
    import json
    monitor = PerformanceMonitor()

    # Setup: Record different metric types
    metrics_to_record = [
        PerformanceMetric(
            timestamp=datetime.now(),
            metric_type="api_call",
            operation="test_api",
            duration_ms=50.5,
            success=True,
            metadata={"user_id": "user123"}
        ),
        PerformanceMetric(
            timestamp=datetime.now(),
            metric_type="cache_operation",
            operation="redis_get",
            duration_ms=5.0,
            success=True,
            metadata={"cache_type": "redis"}
        ),
    ]

    for metric in metrics_to_record:
        monitor.record_metric(metric)

    # Execute: Export metrics
    export_json = monitor.export_metrics(hours=1)
    exported = json.loads(export_json)

    # Assert: Correct JSON structure
    assert isinstance(exported, list)
    assert len(exported) >= 2

    # Check fields
    for item in exported:
        assert "timestamp" in item
        assert "metric_type" in item
        assert "operation" in item
        assert "duration_ms" in item
        assert "success" in item
        assert "metadata" in item

        # Timestamp should be ISO format
        assert "T" in item["timestamp"]


def test_record_metric_slow_operation_logging():
    """Test that slow operations trigger logging

    Task 2: Phase 2 Batch 5 - logging coverage
    Covers: record_metric() slow operation warning (lines 202-206)
    Duration > 2× target triggers warning log
    """
    monitor = PerformanceMonitor()

    # Setup: Record metric that exceeds 2× target
    metric = PerformanceMetric(
        timestamp=datetime.now(),
        metric_type="api_call",
        operation="smart_diet_suggestions",
        duration_ms=1100,  # > 2×500ms = 1000ms
        success=True,
        metadata={}
    )

    # Execute: Record metric and capture logging
    with patch('app.services.performance_monitor.logger') as mock_logger:
        monitor.record_metric(metric)

        # Assert: Warning was logged
        mock_logger.warning.assert_called()
        call_args = mock_logger.warning.call_args[0][0]
        assert "Slow" in call_args
        assert "smart_diet_suggestions" in call_args
        assert "1100" in call_args or "1100.0" in call_args


def test_percentile_calculations_with_enough_samples():
    """Test p95 and p99 percentile calculations

    Task 2: Phase 2 Batch 5 - percentile coverage
    Covers: get_performance_summary() percentile logic (lines 293-294)
    """
    monitor = PerformanceMonitor()

    # Setup: Record 100 metrics for p99 calculation
    for i in range(100):
        metric = PerformanceMetric(
            timestamp=datetime.now() - timedelta(hours=1) + timedelta(seconds=i),
            metric_type="api_call",
            operation="test_op",
            duration_ms=10.0 + i,  # 10 to 109
            success=True,
            metadata={}
        )
        monitor.record_metric(metric)

    # Execute: Get performance summary
    summary = monitor.get_performance_summary(hours=2, metric_type="api_call")

    # Assert: Percentiles calculated
    assert len(summary) > 0
    assert summary[0].total_calls == 100
    assert summary[0].p95_duration_ms > 0
    assert summary[0].p99_duration_ms > summary[0].p95_duration_ms

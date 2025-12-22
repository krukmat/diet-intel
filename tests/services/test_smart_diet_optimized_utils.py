import pytest

from app.services.smart_diet_optimized import OptimizedDatabaseService, PerformanceMonitor


def test_calculate_improvement_score_triggers_all_conditions():
    service = OptimizedDatabaseService()
    current = {'calories': 500, 'protein': 20, 'fat': 30}
    alternative = {'calories': 300, 'protein': 28, 'fat': 20}

    score = service._calculate_improvement_score(current, alternative)

    assert score == pytest.approx(1.0, abs=1e-6)


def test_calculate_improvement_score_defaults_to_zero():
    service = OptimizedDatabaseService()
    current = {'calories': 400, 'protein': 20, 'fat': 30}
    alternative = {'calories': 450, 'protein': 18, 'fat': 32}

    score = service._calculate_improvement_score(current, alternative)

    assert score == 0.0


def test_performance_monitor_records_metrics():
    monitor = PerformanceMonitor()
    monitor.record_api_call(10.0)
    monitor.record_cache_hit()
    monitor.record_cache_miss()
    monitor.record_db_query()

    summary = monitor.get_metrics_summary()
    assert summary['api_calls'] == 1
    assert summary['cache_hits'] == 1
    assert summary['cache_misses'] == 1
    assert summary['db_queries'] == 1
    assert summary['cache_hit_rate_percent'] == 50.0

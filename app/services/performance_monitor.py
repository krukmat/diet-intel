"""
Performance Monitoring Service
Phase 9.3.1: Performance Optimization
Tracks API performance, database queries, cache hit rates, and mobile metrics
"""

import time
import logging
import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
import statistics

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetric:
    """Single performance measurement"""
    timestamp: datetime
    metric_type: str  # 'api_call', 'db_query', 'cache_operation', 'mobile_render'
    operation: str    # 'smart_diet_suggestions', 'find_alternatives', etc.
    duration_ms: float
    success: bool
    metadata: Dict[str, Any]


@dataclass
class PerformanceSummary:
    """Aggregated performance statistics"""
    metric_type: str
    operation: str
    total_calls: int
    avg_duration_ms: float
    min_duration_ms: float
    max_duration_ms: float
    p95_duration_ms: float
    p99_duration_ms: float
    success_rate: float
    error_count: int
    period_start: datetime
    period_end: datetime


class PerformanceMonitor:
    """
    Comprehensive performance monitoring for Smart Diet system
    Tracks response times, success rates, and performance trends
    """
    
    def __init__(self, max_metrics=10000):
        self.metrics: deque = deque(maxlen=max_metrics)
        self.api_targets = {
            'smart_diet_suggestions': 500,  # 500ms target
            'find_alternatives': 200,       # 200ms target
            'cache_operations': 50,         # 50ms target
            'db_queries': 100              # 100ms target
        }
        self.mobile_targets = {
            'screen_render': 2000,         # 2 second target
            'component_render': 16,        # 16ms (60fps) target
            'api_response': 2000           # 2 second mobile target
        }
        
        # Real-time aggregation
        self.current_metrics = defaultdict(list)
        self.alerts = []
        
        # Performance thresholds
        self.error_threshold = 0.05  # 5% error rate
        self.slow_threshold_multiplier = 2.0  # 2x target time
        
    @asynccontextmanager
    async def measure_api_call(self, operation: str, metadata: Dict[str, Any] = None):
        """Context manager for measuring API call performance"""
        start_time = time.time()
        success = True
        error = None
        
        try:
            yield
        except Exception as e:
            success = False
            error = str(e)
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000
            
            metric = PerformanceMetric(
                timestamp=datetime.now(),
                metric_type='api_call',
                operation=operation,
                duration_ms=duration_ms,
                success=success,
                metadata={
                    **(metadata or {}),
                    'error': error
                }
            )
            
            self.record_metric(metric)
            
            # Check for performance issues
            await self._check_performance_alerts(metric)
    
    @asynccontextmanager 
    async def measure_db_query(self, query_type: str, metadata: Dict[str, Any] = None):
        """Context manager for measuring database query performance"""
        start_time = time.time()
        success = True
        error = None
        
        try:
            yield
        except Exception as e:
            success = False
            error = str(e)
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000
            
            metric = PerformanceMetric(
                timestamp=datetime.now(),
                metric_type='db_query',
                operation=query_type,
                duration_ms=duration_ms,
                success=success,
                metadata={
                    **(metadata or {}),
                    'error': error
                }
            )
            
            self.record_metric(metric)
    
    @asynccontextmanager
    async def measure_cache_operation(self, cache_type: str, operation: str):
        """Context manager for measuring cache operations"""
        start_time = time.time()
        success = True
        
        try:
            yield
        except Exception as e:
            success = False
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000
            
            metric = PerformanceMetric(
                timestamp=datetime.now(),
                metric_type='cache_operation',
                operation=f"{cache_type}_{operation}",
                duration_ms=duration_ms,
                success=success,
                metadata={'cache_type': cache_type, 'operation': operation}
            )
            
            self.record_metric(metric)
    
    def record_mobile_metric(
        self, 
        operation: str, 
        duration_ms: float, 
        metadata: Dict[str, Any] = None
    ):
        """Record mobile performance metric"""
        metric = PerformanceMetric(
            timestamp=datetime.now(),
            metric_type='mobile_render',
            operation=operation,
            duration_ms=duration_ms,
            success=True,  # Mobile metrics are typically always successful
            metadata=metadata or {}
        )
        
        self.record_metric(metric)
        
        # Check mobile performance targets
        target = self.mobile_targets.get(operation)
        if target and duration_ms > target:
            self.alerts.append({
                'timestamp': datetime.now(),
                'type': 'mobile_performance',
                'operation': operation,
                'duration_ms': duration_ms,
                'target_ms': target,
                'severity': 'warning' if duration_ms < target * 2 else 'critical'
            })
    
    def record_metric(self, metric: PerformanceMetric):
        """Record a performance metric"""
        self.metrics.append(metric)
        self.current_metrics[f"{metric.metric_type}_{metric.operation}"].append(metric)
        
        # Log slow operations
        target = self._get_target_duration(metric.metric_type, metric.operation)
        if target and metric.duration_ms > target * self.slow_threshold_multiplier:
            logger.warning(
                f"Slow {metric.metric_type} operation: {metric.operation} "
                f"took {metric.duration_ms:.1f}ms (target: {target}ms)"
            )
    
    async def _check_performance_alerts(self, metric: PerformanceMetric):
        """Check for performance alerts and warnings"""
        operation_key = f"{metric.metric_type}_{metric.operation}"
        recent_metrics = [
            m for m in self.current_metrics[operation_key]
            if (datetime.now() - m.timestamp).total_seconds() < 300  # Last 5 minutes
        ]
        
        if len(recent_metrics) < 5:  # Need at least 5 samples
            return
        
        # Check error rate
        error_rate = sum(1 for m in recent_metrics if not m.success) / len(recent_metrics)
        if error_rate > self.error_threshold:
            self.alerts.append({
                'timestamp': datetime.now(),
                'type': 'high_error_rate',
                'operation': metric.operation,
                'error_rate': error_rate,
                'threshold': self.error_threshold,
                'severity': 'critical'
            })
        
        # Check response time degradation
        avg_duration = sum(m.duration_ms for m in recent_metrics) / len(recent_metrics)
        target = self._get_target_duration(metric.metric_type, metric.operation)
        
        if target and avg_duration > target * self.slow_threshold_multiplier:
            self.alerts.append({
                'timestamp': datetime.now(),
                'type': 'slow_response_time',
                'operation': metric.operation,
                'avg_duration_ms': avg_duration,
                'target_ms': target,
                'severity': 'warning'
            })
    
    def _get_target_duration(self, metric_type: str, operation: str) -> Optional[float]:
        """Get target duration for a specific operation"""
        if metric_type == 'api_call':
            return self.api_targets.get(operation)
        elif metric_type == 'mobile_render':
            return self.mobile_targets.get(operation)
        elif metric_type == 'db_query':
            return self.api_targets.get('db_queries')
        elif metric_type == 'cache_operation':
            return self.api_targets.get('cache_operations')
        return None
    
    def get_performance_summary(
        self, 
        hours: int = 1, 
        metric_type: Optional[str] = None
    ) -> List[PerformanceSummary]:
        """Get performance summary for the specified time period"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        # Filter metrics by time and type
        filtered_metrics = [
            m for m in self.metrics 
            if m.timestamp >= cutoff_time and 
               (metric_type is None or m.metric_type == metric_type)
        ]
        
        if not filtered_metrics:
            return []
        
        # Group by metric type and operation
        grouped_metrics = defaultdict(list)
        for metric in filtered_metrics:
            key = (metric.metric_type, metric.operation)
            grouped_metrics[key].append(metric)
        
        summaries = []
        for (m_type, operation), metrics in grouped_metrics.items():
            durations = [m.duration_ms for m in metrics]
            successes = [m.success for m in metrics]
            
            summary = PerformanceSummary(
                metric_type=m_type,
                operation=operation,
                total_calls=len(metrics),
                avg_duration_ms=statistics.mean(durations),
                min_duration_ms=min(durations),
                max_duration_ms=max(durations),
                p95_duration_ms=statistics.quantiles(durations, n=20)[18] if len(durations) >= 20 else max(durations),
                p99_duration_ms=statistics.quantiles(durations, n=100)[98] if len(durations) >= 100 else max(durations),
                success_rate=sum(successes) / len(successes),
                error_count=sum(1 for s in successes if not s),
                period_start=cutoff_time,
                period_end=datetime.now()
            )
            
            summaries.append(summary)
        
        return sorted(summaries, key=lambda s: s.avg_duration_ms, reverse=True)
    
    def get_cache_hit_rate(self, hours: int = 1) -> Dict[str, float]:
        """Calculate cache hit rates by cache type"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        cache_metrics = [
            m for m in self.metrics
            if m.timestamp >= cutoff_time and 
               m.metric_type == 'cache_operation'
        ]
        
        hit_rates = {}
        cache_stats = defaultdict(lambda: {'hits': 0, 'total': 0})
        
        for metric in cache_metrics:
            cache_type = metric.metadata.get('cache_type', 'unknown')
            operation = metric.metadata.get('operation', 'unknown')
            
            cache_stats[cache_type]['total'] += 1
            
            if operation in ['get', 'hit'] and metric.success:
                cache_stats[cache_type]['hits'] += 1
        
        for cache_type, stats in cache_stats.items():
            if stats['total'] > 0:
                hit_rates[cache_type] = (stats['hits'] / stats['total']) * 100
        
        return hit_rates
    
    def get_recent_alerts(self, hours: int = 1) -> List[Dict[str, Any]]:
        """Get recent performance alerts"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        return [
            alert for alert in self.alerts
            if alert['timestamp'] >= cutoff_time
        ]
    
    def get_performance_health_score(self) -> Dict[str, Any]:
        """Calculate overall performance health score"""
        recent_summaries = self.get_performance_summary(hours=1)
        
        if not recent_summaries:
            return {
                'overall_score': 100,
                'api_health': 100,
                'mobile_health': 100,
                'cache_health': 100,
                'status': 'excellent'
            }
        
        scores = {
            'api_health': self._calculate_api_health_score(recent_summaries),
            'mobile_health': self._calculate_mobile_health_score(recent_summaries),
            'cache_health': self._calculate_cache_health_score()
        }
        
        overall_score = statistics.mean(scores.values())
        
        status = 'excellent'
        if overall_score < 95:
            status = 'good'
        if overall_score < 85:
            status = 'fair'
        if overall_score < 70:
            status = 'poor'
        
        return {
            'overall_score': round(overall_score, 1),
            'status': status,
            **{k: round(v, 1) for k, v in scores.items()}
        }
    
    def _calculate_api_health_score(self, summaries: List[PerformanceSummary]) -> float:
        """Calculate API health score based on response times and success rates"""
        api_summaries = [s for s in summaries if s.metric_type == 'api_call']
        
        if not api_summaries:
            return 100
        
        scores = []
        for summary in api_summaries:
            # Response time score (based on target)
            target = self.api_targets.get(summary.operation, 500)
            time_score = max(0, 100 - (summary.avg_duration_ms / target * 50))
            
            # Success rate score
            success_score = summary.success_rate * 100
            
            # Combined score
            operation_score = (time_score + success_score) / 2
            scores.append(operation_score)
        
        return statistics.mean(scores)
    
    def _calculate_mobile_health_score(self, summaries: List[PerformanceSummary]) -> float:
        """Calculate mobile health score based on render times"""
        mobile_summaries = [s for s in summaries if s.metric_type == 'mobile_render']
        
        if not mobile_summaries:
            return 100
        
        scores = []
        for summary in mobile_summaries:
            target = self.mobile_targets.get(summary.operation, 2000)
            score = max(0, 100 - (summary.avg_duration_ms / target * 50))
            scores.append(score)
        
        return statistics.mean(scores) if scores else 100
    
    def _calculate_cache_health_score(self) -> float:
        """Calculate cache health score based on hit rates"""
        hit_rates = self.get_cache_hit_rate(hours=1)
        
        if not hit_rates:
            return 100  # No cache usage means no cache problems
        
        # Target: >85% cache hit rate
        avg_hit_rate = statistics.mean(hit_rates.values())
        return min(100, (avg_hit_rate / 85) * 100)
    
    def export_metrics(self, hours: int = 24) -> str:
        """Export metrics as JSON for analysis"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        exported_metrics = [
            {
                'timestamp': m.timestamp.isoformat(),
                'metric_type': m.metric_type,
                'operation': m.operation,
                'duration_ms': m.duration_ms,
                'success': m.success,
                'metadata': m.metadata
            }
            for m in self.metrics
            if m.timestamp >= cutoff_time
        ]
        
        return json.dumps(exported_metrics, indent=2)


# Singleton instance
performance_monitor = PerformanceMonitor()
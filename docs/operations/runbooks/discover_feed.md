# Discover Feed Observability Runbook

## Metrics Dashboard

### Request Metrics
- **discover_feed_requests**: Total requests count (esterilize by surface: web/mobile)
  - Query: `rate(discover_feed_requests[5m])`
- **discover_feed_cache_hit_ratio**: Percentage of cache hits
  - Query: `avg_over_time(discover_feed_cache_hit_ratio[1h])`
- **experiment_variant_distribution**: Current A/B test distribution
  - Query: `discover_feed_requests{experiment_variant="control|variant_a|variant_b"}`

### Performance Metrics
- **discover_feed_duration_ms**: End-to-end request latency by surface
  - Query: `histogram_quantile(0.95, sum(rate(discover_feed_duration_ms_bucket[5m])) by (le, surface))`
  - SLO: P95 < 800ms for all surfaces
- **cache_hit_latency_ms**: Cache hit performance
  - Query: `rate(discover_feed_cache_hit_duration_ms_count[5m])`
- **db_query_duration_ms**: Database query time
  - Query: `histogram_quantile(0.95, sum(rate(discover_feed_query_duration_ms_bucket[5m])) by (le))`

### Event Analytics (from BigQuery/Redshift)
```sql
-- Daily active discover users by surface
SELECT
  DATE(served_at) as date,
  surface,
  COUNT(DISTINCT viewer_id) as daily_users
FROM discover_feed_events
WHERE served_at >= CURRENT_DATE - 30
GROUP BY DATE(served_at), surface
ORDER BY date, surface;

-- Ranking performance by experiment variant
SELECT
  experiment_variant,
  AVG(rank_score) as avg_rank,
  COUNT(*) as impressions,
  SUM(CASE WHEN action = 'view' THEN 1 ELSE 0 END) as interactions
FROM (
  SELECT
    viewer_id,
    post_id,
    rank_score,
    experiment_variant,
    served_at
  FROM discover_feed_served
  LEFT JOIN user_interactions
    ON discover_feed_served.post_id = user_interactions.post_id
    AND discover_feed_served.viewer_id = user_interactions.viewer_id
    AND DATE_STATUS(user_interactions.interaction_at, served_at) <= 24*60*60
) t
GROUP BY experiment_variant;
```

## Troubleshooting

### High Latency Issues
1. **Check cache hit rate**: If < 60%, investigate caching logic
2. **Database performance**: Monitor EXPLAIN plans for candidate queries
3. **External dependencies**: Check OpenFoodFacts/Nutrition service latency
4. **Cache warming**: Rebuild cache for popular users during off-hours

### Quality Issues
1. **Low engagement**: Check if ranking algorithm favors unpopular content
2. **Duplicate posts**: Verify author diversity threshold (max_posts_per_author)
3. **Blocked content**: Check moderation service health
4. **Empty feed**: Verify if Freshness horizon (fresh_days) is appropriate

### Monitoring Alerts
```yaml
# critical-feeds.promb
groups:
- name: discover_feed_critical
  rules:
  - alertname: discover_feed_high_latency
    expr: histogram_quantile(0.95, sum(rate(discover_feed_duration_ms_bucket[5m])) by (le)) > 1500
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: Discover Feed P95 latency > 1.5s
      description: Discover Feed response time SLA violation

  - alertname: discover_feed_low_cache_hit_ratio
    expr: discover_feed_cache_hit_ratio < 0.5
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: Discover Feed cache hit ratio below 50%
      description: Investigate caching strategy and cache TTL settings

  - alertname: discover_feed_error_rate
    expr: rate(discover_feed_error_total[5m]) / rate(discover_feed_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: Discover Feed error rate > 5%
      description: Check application logs and database connectivity
```

## Operational Procedures

### Routine Maintenance
1. **Weekly cache metrics review**: Analyze cache hit rates, rebuild if needed
2. **Monthly algorithm audit**: Verify ranking weights via experiment results
3. **Experiment progress**: Check A/B test health and statistical significance

### Incident Response
1. **Service degradation**: Enable circuit breaker → fallback to cache-only mode
2. **Data quality issues**: Pause feed serving, redirect to Following tab
3. **Cache corruption**: Flush cache, rebuild from database
4. **Experiment failures**: Rollback to control variant

### Data Recovery
- **Hot backup**: Snapshot taken every 4 hours
- **Cache rebuild**: Run script `scripts/rebuild_discover_feed.py --parallel=4`
- **Data consistency**: Use event log to recreate state

## Development

### Local Testing
```bash
# Backend unit tests
python -m pytest tests/social/test_discover_feed_service.py -v

# Webapp integration
cd webapp && npm test -- --testPathPattern=feed

# Mobile integration
cd mobile && npm test -- --testPathPattern=discover
```

### Debug Commands
```bash
# Check cache status
curl "http://localhost:8000/health"

# Manual feed request with debugging
curl "http://localhost:8000/feed/discover?user_id=test_user&surface=web" | jq '.'

# View recent events
curl "http://localhost:8000/analytics/discover/events"

# Refresh cache for user
curl "/admin/discover-feed/clear-cache?user_id=test_user"

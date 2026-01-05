# Discover Feed

This document is the canonical reference for the Discover Feed feature, combining analytics tracking (events) and operations/runbook guidance.

## Where It Lives

- Backend logic: `app/services/social/discover_feed_service.py`
- API endpoint: `GET /feed/discover`
- Web surface: `webapp/views/feed/discover.ejs`
- Mobile surface: `mobile/` feed screens + `mobile/services/AnalyticsService.ts`

## Analytics Events (Schema)

### Backend: `FeedEvent.DISCOVER_FEED_SERVED`

Payload fields to preserve across surfaces:
- `viewer_id`, `post_id`, `author_id`
- `rank_score`, `reason`, `surface`
- `cache_hit`, `cursor`, `request_id`, `served_at`

### Web/Mobile Client Events

Track at minimum:
- view/open of discover surface
- pagination (“load more”)
- surface switching (web/mobile selector)
- item interaction (view/share/save) when implemented

## Observability Runbook

### Key Metrics

- Requests: `discover_feed_requests`
- Cache hit ratio: `discover_feed_cache_hit_ratio`
- Latency: `discover_feed_duration_ms` (target P95 < 800ms)
- DB query time: `discover_feed_query_duration_ms`

### Common Incidents

- High latency: validate cache hit ratio, then DB query time, then external dependency latency.
- Empty feed / quality regression: verify freshness horizon, dedupe/author diversity, moderation health, and experiment weights.

### Local Debug

```bash
curl "http://localhost:8000/feed/discover?limit=20&surface=mobile"
```

## Notes

- This page is the single reference for Discover Feed documentation.

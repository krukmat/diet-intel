# Discover Feed Analytics Schema

## Event Types

### Backend Events (`FeedEvent.DISCOVER_FEED_SERVED`)

**Source**: `app/services/social/discover_feed_service.py`

**Payload Schema**:
```json
{
  "viewer_id": "string (required)",
  "post_id": "string (required)",
  "author_id": "string (required)",
  "rank_score": "number (0.0-1.0)",
  "reason": "string (fresh|popular|jur)pop)",
  "surface": "string (web|mobile)",
  "cache_hit": "boolean",
  "cursor": "string|null",
  "request_id": "string (UUID)",
  "served_at": "ISO 8601 datetime"
}
```

**Triggered**: For each post served in discover feed response (non-empty feeds only).

---

### Web Client Events

**Source**: `webapp/views/feed/discover.ejs` + `webapp/routes/analytics.js`

#### View Event
```json
{
  "type": "view",
  "user_id": "string|null",
  "surface": "web",
  "items_count": "number",
  "timestamp": "ISO 8601"
}
```
**Triggered**: On DOM content loaded + initial feed load.

#### Load More Event
```json
{
  "type": "load_more",
  "user_id": "string|null",
  "surface": "web",
  "cursor": "string (optional)",
  "items_count": "number",
  "timestamp": "ISO 8601"
}
```
**Triggered**: When "Load more discoveries" button clicked.

#### Surface Switch Event
```json
{
  "type": "surface_switch",
  "user_id": "string|null",
  "surface": "web",
  "surface_from": "web|mobile",
  "surface_to": "web|mobile",
  "timestamp": "ISO 8601"
}
```
**Triggered**: When surface selector changes.

#### Item Interaction Event
```json
{
  "type": "item_interaction",
  "user_id": "string|null",
  "surface": "web",
  "action": "view|share|save",
  "item_id": "string",
  "rank_score": "number",
  "author_id": "string",
  "timestamp": "ISO 8601"
}
```
**Triggered**: On user interactions with posts (future implementation).

---

### Mobile Client Events

**Source**: `mobile/services/AnalyticsService.ts`

#### Discover View Event
```json
{
  "type": "discover_view",
  "user_id": "string",
  "surface": "mobile|web",
  "items_count": "number",
  "timestamp": "ISO 8601",
  "user_agent": "Mobile-App/1.0.0"
}
```
**Triggered**: When discover screen loads with items.

#### Discover Load More Event
```json
{
  "type": "discover_load_more",
  "user_id": "string",
  "surface": "mobile|web",
  "items_count": "number",
  "cursor": "string|null",
  "timestamp": "ISO 8601",
  "user_agent": "Mobile-App/1.0.0"
}
```
**Triggered**: When loadMore completes successfully.

#### Discover Surface Switch Event
```json
{
  "type": "discover_surface_switch",
  "user_id": "string",
  "surface_from": "mobile|web",
  "surface_to": "mobile|web",
  "timestamp": "ISO 8601",
  "user_agent": "Mobile-App/1.0.0"
}
```
**Triggered**: When surface changes in mobile tab switcher.

#### Interact with Item Event
```json
{
  "type": "discover_item_interaction",
  "user_id": "string",
  "surface": "mobile|web",
  "item_id": "string",
  "action": "view|share|save",
  "timestamp": "ISO 8601",
  "user_agent": "Mobile-App/1.0.0"
}
```
**Action definitions**:
- **view**: User taps on post content
- **share**: Post shared via share sheet
- **save**: Post saved to favorites/library (future)

---

## Data Pipeline

### Collection
1. **Backend**: Events -> `event_outbox` -> `social_feed` (immediate/batched)
2. **Web**: Events -> `/analytics/discover` -> Memory storage (dev mode)
3. **Mobile**: Events -> `AnalyticsService` -> Console logging (local-first)

### Storage
- **Development**: In-memory + console logging
- **Production**: Centralized analytics platform (BigQuery/Redshift/Snowflake)

### Processing
- **Real-time**: Event-driven updates (user activity tracking)
- **Batch**: Daily aggregations for performance metrics
- **Experimental**: A/B testing variant attribution

---

## Key Metrics Queries

### Discovery Success Metrics
```sql
-- CTR by surface
SELECT
  surface,
  COUNT(*) as impressions,
  COUNT(CASE WHEN action IN ('view', 'share', 'save') THEN 1 END) as interactions,
  ROUND(
    COUNT(CASE WHEN action IN ('view', 'share', 'save') THEN 1 END) * 1.0 / COUNT(*),
    4
  ) as ctr
FROM (
  SELECT dfe.surface, dfe.viewer_id, dfe.post_id, dei.action
  FROM discover_feed_served dfe
  LEFT JOIN discover_item_interactions dei
    ON dfe.viewer_id = dei.viewer_id
    AND dfe.post_id = dei.item_id
    AND DATE_DIFF(dei.timestamp, dfe.served_at) BETWEEN 0 AND 24*60*60
) t
GROUP BY surface;
```

### Ranking Effectiveness
```sql
-- Average interaction rate by rank percentile
SELECT
  RANK() OVER (ORDER BY AVG(rank_score) DESC) as rank_percentile,
  AVG(rank_score) as avg_rank_score,
  COUNT(*) as posts,
  AVG(CASE WHEN interacted = 1 THEN 1 ELSE 0 END) as interaction_rate
FROM (
  SELECT
    rank_score,
    CASE WHEN (SELECT COUNT(*) FROM discover_item_interactions
               WHERE post_id = dfe.post_id AND action = 'view') > 0
         THEN 1 ELSE 0 END as interacted
  FROM discover_feed_served dfe
) ranked_posts
GROUP BY FLOOR((RANK() OVER (ORDER BY rank_score DESC) - 1) / (COUNT(*) OVER () / 10))
ORDER BY rank_percentile;
```

### Surface Performance
```sql
-- Performance by surface and experiment variant
SELECT
  dfe.surface,
  dfe.experiment_variant,
  AVG(dfd.duration_ms) as avg_latency,
  COUNT(*) as sample_size,
  STDDEV(dfd.duration_ms) as latency_stddev
FROM discover_feed_served dfe
JOIN discover_feed_duration dfd USING (request_id)
WHERE dfd.timestamp >= CURRENT_DATE - 7
GROUP BY surface, experiment_variant;
```

---

## Debug & Development

### Web Testing
```javascript
// Chrome Console
fetch('/analytics/discover', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    type: 'view',
    user_id: 'test-user',
    surface: 'web',
    items_count: 20
  })
});

// Get events
fetch('/analytics/discover/events')
  .then(r => r.json())
  .then(console.log);
```

### Mobile Testing
```typescript
// React Native Debugger
import { analyticsService } from './mobile/services/AnalyticsService';

analyticsService.trackDiscoverView(15, 'mobile').then(() => {
  console.log('Event logged:', analyticsService.getRecentEvents());
});

// View event summary
console.log(analyticsService.getEventSummary());
```

### Backend Testing
```bash
# View event structure
curl "http://localhost:8000/feed/discover?limit=1" -H "Authorization: Bearer test-token"
grep "feed_event" /var/log/dietintel/app.log

# Test event generation
python -c "
from app.services.social.discover_feed_service import get_discover_feed
result = get_discover_feed('test-user-123', surface='web')
print(f'Items served: {len(result.items)}')
"
```

---

## Future Enhancements

### Instrumentation
- **Position tracking**: Add `position_in_feed` to events
- **Dwell time**: Measure time spent on post content
- **Recommendation source**: Track ML model's contribution score
- **Geographic targeting**: Add user location for regional analytics

### Platform Integration
- **Amplitude**: User journey analysis
- **Mixpanel**: Product metrics and funnels
- **DataDog**: Infrastructure monitoring correlation
- **A/B Testing**: Dynamic variant assignment and validation

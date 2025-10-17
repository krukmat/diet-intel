# API Social Documentation

## Base URL
All endpoints are available under: `/`

## Authentication
All social endpoints require Bearer token authentication:
```http
Authorization: Bearer <access_token>
```

## Data Models

### User Profile
```typescript
interface Profile {
  user_id: string;
  handle: string;
  bio?: string;
  avatar_url?: string;
  visibility: 'public' | 'followers_only';
  stats: {
    followers_count: number;
    following_count: number;
    posts_count: number;
    points_total: number;
  };
  follow_relation?: 'active' | 'pending' | null;
  block_relation?: 'blocked' | 'blocked_by' | null;
}
```

### Follow Response
```typescript
interface FollowResponse {
  ok: boolean;
  status: 'success' | 'blocked' | 'error';
  message?: string;
}
```

### Feed Item
```typescript
interface FeedItem {
  id: string;
  user_id: string;
  actor_id: string;
  event_name: string;
  payload: Record<string, any>;
  created_at: string;
}

interface FeedResponse {
  items: FeedItem[];
  next_cursor?: string;
}
```

---

## User Profiles

### Get Profile
Get a user's profile information.

```http
GET /profiles/{user_id}
Authorization: Bearer <token>
```

**Path Parameters:**
- `user_id` (string): Target user ID

**Response Status Codes:**
- `200`: Profile data
- `401`: Unauthorized (invalid/missing token)
- `404`: User not found

**Example Response:**
```json
{
  "user_id": "user123",
  "handle": "@john_doe",
  "bio": "Nutrition enthusiast",
  "avatar_url": "https://example.com/avatar.jpg",
  "visibility": "public",
  "stats": {
    "followers_count": 150,
    "following_count": 89,
    "posts_count": 45,
    "points_total": 1250
  },
  "follow_relation": "active",
  "block_relation": null
}
```

### Get Current User
Get authenticated user's profile.

```http
GET /profiles/me
Authorization: Bearer <token>
```

Response: Same as Get Profile (but always shows owner's full info)

### Update Profile
Update authenticated user's profile.

```http
PATCH /profiles/me
Authorization: Bearer <token>

{
  "handle": "@new_handle",
  "bio": "Updated bio",
  "visibility": "followers_only"
}
```

---

## Follow System

### Follow User
Follow another user.

```http
POST /follows/{target_user_id}?action=follow
Authorization: Bearer <token>
```

**Actions:**
- `action=follow`: Follow user
- `action=unfollow`: Unfollow user

**Path Parameters:**
- `target_user_id` (string): User to follow/unfollow

**Response:**
```json
{
  "ok": true,
  "status": "success",
  "message": "Now following user"
}
```

**Possible Responses:**
- `"status": "success"` - Action completed
- `"status": "blocked"` - Target user is blocked OR blocker
- `"status": "error"` - Generic error

### Get Followers
Get users following a specific user.

```http
GET /profiles/{user_id}/followers?limit=20&cursor=abc123
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (number, optional): Max items (default: 20)
- `cursor` (string, optional): Pagination cursor

### Get Following
Get users that a specific user is following.

```http
GET /profiles/{user_id}/following?limit=20&cursor=abc123
Authorization: Bearer <token>
```

---

## Block System

### Block User
Block/unblock another user.

```http
POST /blocks/{target_user_id}?action=block
POST /blocks/{target_user_id}?action=unblock
Authorization: Bearer <token>
```

**Actions:**
- `action=block`: Block user (removes mutual follow)
- `action=unblock`: Unblock user

**Response:**
```json
{
  "ok": true,
  "message": "User blocked"
}
```

### Get Blocked Users
Get users blocked by authenticated user.

```http
GET /profiles/me/blocked?limit=20&cursor=abc123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "items": [
    {
      "user_id": "blocked123",
      "handle": "@blocked_user",
      "since": "2025-01-01T10:00:00Z",
      "reason": "spam"
    }
  ],
  "next_cursor": "next123",
  "has_more": false
}
```

### Get Blockers
Get users who have blocked the authenticated user.

```http
GET /profiles/me/blockers?limit=20&cursor=abc123
Authorization: Bearer <token>
```

---

## **🔥 FEED SYSTEM (EPIC_A.A4) - Social Activity Feed**

The Feed API provides a chronological timeline of social activities from users you follow.

### Get Feed
Retrieve authenticated user's social activity feed.

```http
GET /feed?limit=20&cursor=base64_cursor
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (number, optional): Items per page (default: 20, max: 50)
- `cursor` (string, optional): Base64 encoded cursor for pagination

**Authentication:** Required - Bearer token

**Response Status Codes:**
- `200`: Feed data with items
- `401`: Unauthorized (missing/invalid token)
- `500`: Internal server error

**Example Request:**
```bash
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
     "https://api.dietintel.com/feed?limit=30"
```

**Example Response:**
```json
{
  "items": [
    {
      "id": "feed_0742aac1",
      "user_id": "followed_user_123",
      "actor_id": "current_user_456",
      "event_name": "UserAction.UserFollowed",
      "payload": {
        "follower_id": "current_user_456",
        "target_id": "followed_user_123",
        "action": "followed"
      },
      "created_at": "2025-01-15T14:30:22Z"
    },
    {
      "id": "feed_abc123",
      "user_id": "another_user_789",
      "actor_id": "follower_xyz",
      "event_name": "UserAction.UserBlocked",
      "payload": {
        "blocker_id": "follower_xyz",
        "blocked_id": "another_user_789",
        "reason": "inappropriate",
        "action": "blocked"
      },
      "created_at": "2025-01-15T12:15:33Z"
    }
  ],
  "next_cursor": "eyJjcmVhdGVkX2F0IjogIjIwMjUtMDEtMTVUMTI6MTU6MzNaIiwgImlkIjogImZlZWRfYWJjMTIzIn0="
}
```

### Feed Events

Currently supported social events:

#### `UserAction.UserFollowed`
- **Actor**: User who initiated follow
- **Target**: User who was followed
- **Payload**: `{ follower_id, target_id, action: "followed" }`

#### `UserAction.UserUnfollowed`
- **Actor**: User who unfollowed
- **Target**: User who was unfollowed
- **Payload**: `{ follower_id, target_id, action: "unfollowed" }`

#### `UserAction.UserBlocked`
- **Actor**: User who blocked
- **Target**: User who was blocked
- **Payload**: `{ blocker_id, blocked_id, reason?, action: "blocked" }`

#### `UserAction.UserUnblocked`
- **Actor**: User who unblocked
- **Target**: User who was unblocked
- **Payload**: `{ blocker_id, blocked_id, action: "unblocked" }`

### Pagination
Feed uses cursor-based pagination with Base64-encoded cursors:

1. **Initial Request:** `GET /feed` (starts from latest activity)
2. **Next Page:** `GET /feed?cursor=<next_cursor>`
3. **No More:** Response omits `next_cursor` field

### Feed Processing
Activities become visible in feeds through an automated ingestion process that runs regularly, transferring events from the internal `event_outbox` to the public `social_feed` table.

---

## Error Responses

All endpoints return consistent error formats:

```json
{
  "detail": "Error description",
  "code": "ERROR_CODE"
}
```

Common errors:
- `'invalid_token'` - Auth token invalid/expired
- `'user_not_found'` - Target user doesn't exist
- `'already_following'` - Duplicate follow action
- `'cannot_follow_self'` - Self-follow attempt

---

## Rate Limiting

Social endpoints are rate-limited:
- **Authenticated:** 100 requests/minute
- **Profile views:** 200 requests/minute
- **Feed requests:** 50 requests/minute

HTTP headers indicate limits:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1640995200
```

---

## WebSocket Events (Future)

Real-time social updates will be available via WebSocket:

```javascript
const socket = new WebSocket('wss://api.dietintel.com/social/stream');

socket.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Handle new feed items, follow notifications, etc.
};
```

---

## Feed System Architecture

The Social Feed system is built on several layers:

1. **Event Generation**: Social actions create entries in `event_outbox`
2. **Ingestion Pipeline**: Background worker processes events → `social_feed`
3. **API Layer**: FeedService provides paginated access
4. **UI Integration**: Web and mobile apps consume feed data

### Database Schema

```sql
-- Source: event_outbox (internal)
-- +----------------+------------------+----+-----------+----------+
-- | event_name    | event_data       | -> | processed | deleted  |
-- +----------------+------------------+----+-----------+----------+

-- Destination: social_feed (public)
-- +----+----------+-----------+-------------+----------------+------------+
-- | id | user_id  | actor_id  | event_name  | payload        | created_at |
-- +----+----------+-----------+-------------+----------------+------------+
```

This architecture ensures scalability, auditability, and reliable delivery of social activity feeds.

---

## 🎯 **DISCOVER FEED (EPIC_B.B1) - AI-Powered Content Discovery**

The **Discover Feed** uses machine learning algorithms to surface the most relevant social content from across the platform, similar to TikTok's "For You" page.

### Backend Architecture

**Service Layer:** `discover_feed_service.py`
- **Ranking Algorithm**: Hybrid fresh/engagement scoring
- **Caching**: In-memory cache with 60s TTL
- **Filters**: Security (blocks), content safety (reports), visibility

**Security Filters:**
- `block_service.is_blocking(viewer, author)` ➜ elimina si hay bloqueo.
- `block_service.is_blocking(author, viewer)` ➜ respeta bloqueos recíprocos.
- `ReportService.is_post_blocked(post_id)` ➜ oculta contenido reportado.
- `ProfileService.can_view_profile(viewer, author)` ➜ aplica visibilidad `public`/`followers_only`.

- **Pagination**: Cursor-based for infinite scroll
- **Performance Monitoring**: Integrated metrics collection

### Get Discover Feed

**Note:** Internal service (no direct HTTP endpoint yet - will be exposed in B2)

Service interface:
```python
from app.services.social.feed_service import list_discover_feed

response = list_discover_feed(
    user_id="current_user",
    limit=20,
    cursor=None,  # Optional pagination
    surface="web"  # or "mobile"
)
```

**Response Structure:**
```json
{
  "items": [
    {
      "id": "post_123",
      "user_id": "viewer_456",
      "actor_id": "author_789",
      "event_name": "DiscoverFeed.Post",
      "payload": {
        "post_id": "post_123",
        "author_id": "author_789",
        "author_handle": "@nutrition_guru",
        "text": "Amazing keto recipe!",
        "rank_score": 0.85,
        "reason": "popular",
        "surface": "web",
        "likes_count": 42,
        "comments_count": 12
      },
      "created_at": "2025-01-20T10:30:00Z"
    }
  ],
  "next_cursor": "b64_encoded_cursor_string"
}
```

### Ranking Algorithm Parameters

Configured in `app/config.py`:

```json
{
  "fresh_days": 7,
  "fresh_tau_hours": 6,
  "weights": {
    "fresh": 0.5,
    "engagement": 0.5,
    "likes": 0.6,
    "comments": 0.4
  },
  "max_posts_per_author": 2,
  "cache_ttl_seconds": 60
}
```

**Algorithm Details:**
- **Fresh Signal**: Exponential decay from post creation time
- **Engagement Signal**: Likes + Comments with weighted scoring
- **Final Score**: `fresh_weight * fresh_score + engagement_weight * engagement_score`
- **Author Diversity**: Max 2 posts per author per feed request

### Architecture Notes

- **Caching**: Surface-specific in-memory cache prevents repeated queries
- **Filters Applied In Order**: Block filters → Report filters → Visibility filters
- **Cursor Pagination**: Efficient infinite scroll using encoded timestamps
- **Performance**: Optimized SQL with JOINs, designed for 10K+ posts
- **Safety**: Graceful degradation - filters skip silently on service errors

---

## Manual Testing Guide

### **EPIC_A.A1**: Profile Management
1. Create JWT token for user authentication
2. `GET /profiles/me` - View own profile
3. `PATCH /profiles/me` - Update profile fields
4. `GET /profiles/{user_id}` - View other profiles
5. Verify visibility restrictions work correctly

### **EPIC_A.A2**: Follow System
1. Get initial follower/following counts
2. `POST /follows/{user_id}?action=follow`
3. Verify `follow_relation` updates to "active"
4. Check `GET /profiles/me/following` includes target
5. `POST /follows/{user_id}?action=unfollow`
6. Verify relation removed

### **EPIC_A.A3**: Block System
1. `POST /blocks/{user_id}?action=block`
2. Verify `follow_relation` updates (removes mutual follows)
3. Check block lists: `GET /profiles/me/blocked`
4. Attempt follow while blocked (should fail)
5. `POST /blocks/{user_id}?action=unblock`

### **EPIC_A.A4**: Social Feed
1. **Create Activity:**
   ```bash
   # Follow another user
   curl -X POST "https://api.dietintel.com/follows/another_user?action=follow" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Trigger Ingestion:**
   ```bash
   # Run feed ingester (usually cron job)
   python scripts/run_feed_ingester.py
   ```

3. **View Feed (Web):**
   - Navigate to `/feed` in webapp
   - Verify follow activity appears
   - Test pagination with ?cursor=

4. **View Feed (Mobile):**
   - Open Feed tab in mobile app
   - Verify feed loads and shows activity
   - Test infinite scroll and refresh

5. **Complete Flow:**
   - Follow → Unfollow → Block → Unblock → Follow again
   - Check feed shows all activities chronologically
   - Test empty states when no activities exist

### Testing Edge Cases

- **Empty Feed:** User with no follows should see "No activity yet"
- **Blocked Content:** Blocked users' activities should be filtered
- **Large Datasets:** Pagination should work with 100+ items
- **Rate Limits:** Exceed limits to verify responses
- **Offline:** Mobile should queue actions when offline
- **Concurrent:** Multiple users creating activities simultaneously

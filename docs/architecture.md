# DietIntel Architecture Documentation

## Overview

DietIntel is a comprehensive nutrition tracking and social fitness platform built with Python/FastAPI backend and modern web/mobile frontends. The system combines AI-powered meal planning, barcode scanning, social features, and gamification to create an engaging nutrition experience.

## Core Architecture

### Backend Stack
- **Framework:** FastAPI (Python 3.9+)
- **Database:** SQLite with potential PostgreSQL migration
- **Authentication:** JWT tokens
- **External APIs:** Open Food Facts, LibreTranslate
- **Task Queue:** Background workers for feed processing

### Architecture Patterns
- **Layered Architecture:** Models → Services → Routes → API
- **Dependency Injection:** FastAPI DI container
- **Repository Pattern:** Database abstraction via db_service
- **Service Layer:** Business logic separation

## Component Architecture

### 1. Nutrition Core (EPIC_A.A1-A.A4)
#### Models
- **User profiles** with nutrition goals and preferences
- **Food/product data** from OFF API with caching
- **Meal planning** with AI recipe generation
- **Tracking entries** for consumption logging

#### Services
- **Nutrition calculations** (macros, calories, deficiencies)
- **Barcode services** with offline fallbacks
- **Meal generation** using preference learning
- **Cache management** for external API responses

### 2. Social Features (EPIC_A.A4, EPIC_A.A5)
#### Core Components
- **Profiles system** with follows/followers
- **Content creation** (posts with social features)
- **Feed system** for social activity aggregation
- **Block/report system** for safety moderation

#### Database Schema
```sql
-- User relationships
user_follows (follower_id, followee_id, status, created_at)
user_blocks (blocker_id, blocked_id, reason, created_at)

-- Content
posts (id, author_id, text, visibility, created_at, updated_at)
post_reactions (post_id, user_id, reaction_type)
post_comments (id, post_id, user_id, text, created_at)

-- Activity feed
social_feed (id, user_id, actor_id, event_name, payload, created_at)
```

#### Feed Processing
Social activities are processed asynchronously:
1. Events created in `event_outbox` (immediate)
2. Background worker processes → `social_feed` (batched)
3. API serves from `social_feed` with pagination

### 3. **Discover Feed (EPIC_B.B1) - AI-Powered Content Discovery**

#### 🎯 **Core Algorithm: Hybrid Fresh/Engagement Ranking**

The Discover Feed implements a sophisticated ranking system similar to modern social platforms:

**Algorithm Overview:**
- **Fresh Signal:** Exponential decay from post age (τ = 6 hours)
- **Engagement Signal:** Weighted likes (60%) + comments (40%)
- **Final Score:** `fresh_weight × fresh_score + engagement_weight × engagement_score`

**Mathematical Model:**
```
fresh_score = exp(-Δhours / τ)  where τ = 6 hours
engagement_score = 0.6 × likes + 0.4 × comments
total_score = 0.5 × fresh_score + 0.5 × engagement_score
```

#### 🏗️ **System Architecture**

**Service Layer (`discover_feed_service.py`):**
```
get_discover_feed()
├── Cache Check (per user/surface)
├── _fetch_candidate_posts() → DB query with JOINs
├── _score_candidates() → Ranking algorithm
├── _apply_filters() → Security (blocks/reports)
├── _cap_per_author() → Diversity (max 2/author)
├── _apply_cursor() → Pagination filters
├── _paginate() → Generate next_cursor
├── _build_response() → Format response
└── Cache Set
```

**Data Flow:**
1. **Candidates:** Posts from last 7 days, public visibility
2. **Scoring:** Hybrid fresh/engagement algorithm
3. **Filtering:** Block lists + reports + visibility
4. **Diversity:** Max posts per author (configurable)
5. **Pagination:** Cursor-based with score/timestamp sorting

#### ⚙️ **Configuration (`app/config.py`)**

```python
discover_feed: Dict[str, Any] = {
    "fresh_days": 7,           # Horizon for candidates
    "fresh_tau_hours": 6,      # Freshness decay parameter
    "weights": {
        "fresh": 0.5,          # Fresh signal weight
        "engagement": 0.5,     # Engagement signal weight
        "likes": 0.6,           # Like weight in engagement
        "comments": 0.4,        # Comment weight in engagement
    },
    "max_posts_per_author": 2, # Diversity per author
    "cache_ttl_seconds": 60,   # Cache TTL per surface
}
```

#### 🔒 **Filtering pipeline**

```
[Post Candidate]
       |
       v
[Security Filters]
  - viewer blocks author? ➜ drop
  - author blocks viewer? ➜ drop
  - ReportService.is_post_blocked? ➜ drop
  - ProfileService.can_view_profile? ➜ drop
       |
       v
[Ranking (fresh + engagement)]
       |
       v
[Diversity Cap (max N per author)]
       |
       v
[Pagination + cursor → DiscoverFeedResponse]
```

> Los helpers actuales (`ReportService.is_post_blocked`, `ProfileService.can_view_profile`) son stubs básicos; se completarán en la historia B2 junto con el endpoint HTTP.

#### 🚀 **Performance Optimizations**

**Caching Strategy:**
- **Per-user/surface caching** prevents redundant queries
- **TTL = 60 seconds** balances freshness vs performance
- **Surface-specific** (web/mobile) for platform optimization

**Query Optimizations:**
- **JOIN queries** in single DB round-trip
- **Index usage** on datetime and visibility columns
- **Subquery aggregation** for efficient counting

**Pagination:**
- **Cursor-based** with score + timestamp sorting
- **Efficient filtering** using database indexes
- **Base64 encoding** for opaque cursors

#### 🛡️ **Safety & Filtering**

**Security Layers:**
1. **Post-level:** Public visibility only
2. **Author-level:** Block relationships (bidirectional)
3. **Content-level:** Report system integration
4. **Profile-level:** Visibility settings

**Error Handling:**
- **Graceful degradation** on filter failures
- **Structured logging** for debugging
- **Fallback responses** maintain API stability

#### 📊 **Metrics & Monitoring**

**Performance Metrics:**
- **Request counts** via performance monitor
- **Cache hit rates** for optimization insights
- **Response times** per surface/platform

**Algorithm Effectiveness:**
- **Score distributions** analysis
- **User engagement** from impressions
- **Content diversity** across authors/freshness

## Data Architecture

### Database Design
- **SQLite for development** with PostgreSQL migration path
- **Normalized schema** reducing data redundancy
- **Foreign key constraints** maintaining referential integrity
- **Index strategy** optimizing query performance

### Caching Layers
1. **Application Cache:** In-memory Redis stores
2. **Database Cache:** Query result caching
3. **API Cache:** External service response caching
4. **CDN Cache:** Static asset distribution

### Backup & Recovery
- **Automated backups** of SQLite database
- **Point-in-time recovery** capabilities
- **Data export/import** tooling for migrations
- **Backup integrity validation** routines

## API Architecture

### RESTful Design
- **Resource-based URLs** with hierarchical organization
- **HTTP method semantics** (GET, POST, PATCH, DELETE)
- **Meaningful HTTP status codes** for error states
- **Consistent error response formats**

### Authentication & Security
- **JWT-based authentication** with refresh tokens
- **Role-based access control** for admin features
- **Rate limiting** by endpoint and user
- **Input validation** using Pydantic models
- **CORS configuration** for frontend access

### API Versioning
- **URL-based versioning** (`/v1/` prefix)
- **Semantic versioning** for breaking changes
- **Deprecation headers** warning of upcoming changes
- **Backward compatibility** maintained in parallel

## Deployment Architecture

### Environments
- **Development:** Local SQLite with hot reload
- **Staging:** Full stack with test data
- **Production:** Optimized PostgreSQL with monitoring

### Infrastructure as Code
- **Docker containers** for consistent environments
- **Docker Compose** for multi-service orchestration
- **Environment variables** for configuration management
- **Secrets management** for sensitive credentials

### Monitoring & Observability
- **Structured logging** with correlation IDs
- **Performance metrics** via integrated dashboards
- **Health check endpoints** for load balancer monitoring
- **Error tracking** with stack traces and context

## Scaling Considerations

### Horizontal Scaling
- **Stateless application design** enables multiple instances
- **Shared Redis cache** for session consistency
- **Load balancer** distributes requests evenly
- **Database connection pooling** prevents resource exhaustion

### Database Scaling
- **Read replicas** offload analytics queries
- **Sharding strategies** for user data partitioning
- **Query optimization** reduces database load
- **Connection limits** prevent resource overload

### Caching at Scale
- **Multi-level caching** (L1/L2/L3)
- **Cache invalidation strategies** for data consistency
- **Distributed caching** with Redis clusters
- **Cache warming** reduces cold start latencies

## Security Architecture

### Authentication
- **JWT tokens** with configurable expiration
- **Secure token storage** in HTTP-only cookies
- **Refresh token rotation** prevents token reuse
- **Multi-factor authentication** support

### Authorization
- **Role-based permissions** (user, admin, moderator)
- **Fine-grained access control** for social features
- **API rate limiting** by user and endpoint
- **Request validation** prevents malicious input

### Data Protection
- **Encryption at rest** using database features
- **HTTPS everywhere** with TLS 1.3
- **Sensitive data masking** in logs
- **GDPR compliance** with data subject rights

## Future Evolutions

### Planned Enhancements
- **GraphQL API** for optimized mobile queries
- **WebSocket support** for real-time features
- **Machine learning** for personalized recommendations
- **Microservices architecture** for team scaling
- **Global CDN** for worldwide performance

### Technology Migrations
- **Python upgrade** to latest stable version
- **Database migration** to PostgreSQL
- **Container orchestration** with Kubernetes
- **CI/CD pipeline** automation enhancements

This architecture provides a solid foundation for the DietIntel platform while maintaining flexibility for future growth and feature enhancements.

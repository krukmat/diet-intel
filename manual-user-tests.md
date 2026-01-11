# Discover Feed – Manual QA Checklist

## EPIC_B.B6 Manual QA Scenarios

### 1. Multi-Source Ranking Verification

#### Test Objectives:
- Verify that feed displays posts from multiple sources (fresh, trending, 2nd-degree)
- Confirm that RankReason values are correctly assigned
- Validate that algorithm weights affect ranking

#### Test Scenarios:

**Scenario 1.1 - Source Diversity**
- **Given** User with following activity and recent posts in system
- **When** Navigate to `/feed/discover`
- **Then** Feed shows mix of:
  - Fresh posts (created < 6 hours ago)
  - Trending posts (high engagement in last 48h)
  - 2nd-degree connection posts
- **Verify** Each post displays correct reason badge (FRESH/POPULAR/SUGGESTED)

**Scenario 1.2 - Variant Weights Application**
- **Precondition** Experiment enabled with variant weights:
  - Variant A: 0.3 fresh, 0.7 engagement (high interaction)
  - Variant B: 0.8 fresh, 0.2 engagement (high freshness)
- **Given** User assigned to different variants in different browsers
- **When** Request feed from each variant
- **Then** Rankings differ according to variant weights
- **Verify** Variant badge shows in interface (e.g., "Variant: variant_a")

**Scenario 1.3 - Author Diversity Limit**
- **Given** Database with one author having many high-engagement posts
- **When** Load discover feed
- **Then** Same author should appear maximum 2 times
- **Verify** No user dominates feed results

### 2. Analytics & Interaction Tracking

#### Test Objectives:
- Validate client-side event collection
- Confirm backend event persistence
- Verify interaction events flow correctly

#### Test Scenarios:

**Scenario 2.1 - View Event Collection**
- **Given** User loads discover feed page
- **When** Page fully loads with posts
- **Then** View event sent to `/analytics/discover` with correct payload
- **Verify** Admin endpoint shows event: `GET /analytics/discover/events`

**Scenario 2.2 - Load More Interactions**
- **Precondition** Feed has more than 20 posts available
- **Given** Initial feed load shows 20 posts
- **When** User clicks "Load more discoveries"
- **Then** `load_more` event sent with cursor and pagination info
- **Verify** Event appears in admin panel with correct request_id

**Scenario 2.3 - Surface Switching**
- **Given** Discover feed interface
- **When** User changes surface selector from "Web" to "Mobile preview"
- **Then** `surface_switch` event sent with from/to surface values
- **Verify** Switch updates feed content and variant assignment

### 3. Performance & Quality Assurance

#### Test Objectives:
- Verify error handling and resilience
- Confirm cache behavior works properly
- Validate privacy controls and blocking

#### Test Scenarios:

**Scenario 3.1 - Error Handling**
- **Given** Backend service temporarily unavailable
- **When** User requests discover feed
- **Then** Friendly error message displayed
- **Verify** No sensitive information exposed in error responses

**Scenario 3.2 - Privacy Controls**
- **Given** User A has blocked User B
- **When** User A loads discover feed
- **Then** No posts from User B appear
- **Verify** Mutual blocking respected (User B also blocked)

**Scenario 3.3 - Cache Functionality**
- **Given** Cache TTL of 60 seconds
- **When** Refresh same feed within TTL
- **Then** Subsequent requests return cache_hit=true
- **Verify** Performance metrics show cache hits

### 4. Experimental Functionality

#### Test Objectives:
- Confirm bucketing is deterministic per user
- Validate different surfaces have different variant weights
- Verify fallback behavior when experiments disabled

#### Test Scenarios:

**Scenario 4.1 - Bucketing Determinism**
- **Given** Same user ID across different browsers/sessions
- **When** User loads feed multiple times
- **Then** Always gets assigned to same variant
- **Verify** Variant badge remains consistent over time

**Scenario 4.2 - Surface-Specific Variants**
- **Given** Experiment with different weights for web vs mobile
- **When** User switches between surfaces
- **Then** Different variants can be shown per surface
- **Verify** Feed content changes according to surface-specific weights

### 5. Cross-Platform Consistency

#### Test Objectives:
- Ensure web and mobile experiences work equivalently
- Verify data synchronization between surfaces

## Updates
- 2026-01-10: No manual user tests executed for the plan/progress integration audit run.

#### Test Scenarios:

**Scenario 5.1 - Data Consistency**
- **Given** User accesses feed from web and mobile
- **When** Check user interactions and feed ranking
- **Then** Same mathematical ranking algorithms applied
- **Verify** Features available on both surfaces (tabs, pagination)

## Testing Checklist

- [ ] 1.1 Source diversity verification ✅
- [ ] 1.2 Variant weight application ✅
- [ ] 1.3 Author diversity limits ✅
- [ ] 2.1 View event collection ✅
- [ ] 2.2 Load more interactions ✅
- [ ] 2.3 Surface switching ✅
- [ ] 3.1 Error handling ✅
- [ ] 3.2 Privacy controls ✅
- [ ] 3.3 Cache functionality ✅
- [ ] 4.1 Bucketing determinism ✅
- [ ] 4.2 Surface-specific variants ✅
- [ ] 5.1 Data consistency ✅

## Notes for QA Team

### Setup Requirements:
- **Database**: Testing environment with diverse post data
- **Users**: Multiple test users with different followings/followers
- **Experimentation**: Configure variants before testing
- **Analytics**: Access to admin endpoints for validation

### Common Pitfalls:
- **Cache interference**: Clear user cache between variant tests
- **Anonymous users**: May get different consistent variants
- **Timing dependencies**: Trending posts require recent high activity
- **Privacy settings**: Check user visibility preferences

### Expected Results:
- **Performance**: Feed loads under 800ms P95
- **Correctness**: Rankings change with variant weights
- **Reliability**: No crashes on edge cases
- **Privacy**: Blocked users never appear in feed

## 2026-01-03
- Automated coverage run executed for Phase 3 audit (no manual QA).
- Follow-up coverage run after Phase 3 test improvements (no manual QA).

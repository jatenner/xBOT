# 📊 Growth Telemetry System

**Purpose:** Collect reliable telemetry needed for cadence learning and strategy optimization.

---

## Overview

The Growth Telemetry system captures:
1. **Account-level metrics** (hourly snapshots)
2. **Per-decision performance** (at 1h and 24h horizons)
3. **Reward scores** (computed from performance + follower attribution)
4. **Daily aggregates** (by dimension: hour, type, format, topic, generator)

---

## Database Tables

### 1. `account_snapshots`

**Purpose:** Hourly account-level metrics for follower attribution

**Columns:**
- `id` (UUID) - Primary key
- `timestamp` (TIMESTAMPTZ) - Hour timestamp (rounded to nearest hour)
- `followers_count` (INTEGER) - Follower count
- `following_count` (INTEGER) - Following count (optional)
- `total_posts` (INTEGER) - Total posts (optional)
- `source` (TEXT) - 'scraped' or 'estimated'
- `notes` (JSONB) - Additional metadata
- `created_at` (TIMESTAMPTZ) - Row creation time

**Unique Constraint:** `timestamp` (ensures one snapshot per hour)

**Indexes:**
- `idx_account_snapshots_timestamp` (DESC) - For time-based queries

**Usage:**
- Follower attribution (delta between snapshots)
- Growth rate calculation
- Account health monitoring

---

### 2. `performance_snapshots`

**Purpose:** Per-decision performance metrics at specific time horizons

**Columns:**
- `id` (UUID) - Primary key
- `decision_id` (UUID) - References `content_metadata(decision_id)`
- `tweet_id` (TEXT) - Twitter tweet ID
- `collected_at` (TIMESTAMPTZ) - When metrics were collected
- `horizon_minutes` (INTEGER) - 60 (1h) or 1440 (24h)
- `impressions` (INTEGER) - Views/impressions
- `likes` (INTEGER) - Likes
- `reposts` (INTEGER) - Retweets
- `replies` (INTEGER) - Replies
- `bookmarks` (INTEGER) - Bookmarks
- `engagement_rate` (NUMERIC) - Calculated engagement rate
- `profile_clicks` (INTEGER) - Profile clicks
- `source` (TEXT) - 'scraped' or 'estimated'
- `notes` (JSONB) - Additional metadata
- `created_at` (TIMESTAMPTZ) - Row creation time

**Unique Constraint:** `(decision_id, horizon_minutes)` - Ensures idempotency

**Indexes:**
- `idx_performance_snapshots_decision_id` - For decision lookups
- `idx_performance_snapshots_collected_at` (DESC) - For time-based queries
- `idx_performance_snapshots_horizon` - For horizon-based queries

**Usage:**
- Performance tracking at 1h and 24h
- Reward computation
- Learning system input

---

### 3. `reward_features`

**Purpose:** Computed reward scores and features for learning

**Columns:**
- `id` (UUID) - Primary key
- `decision_id` (UUID) - References `content_metadata(decision_id)`
- `decision_type` (TEXT) - 'single', 'thread', 'reply'
- `posted_at` (TIMESTAMPTZ) - When posted
- `hour_of_day` (INTEGER) - 0-23
- `generator_name` (TEXT) - Content generator used
- `raw_topic` (TEXT) - Topic
- `format_strategy` (TEXT) - Format strategy
- `impressions_1h` (INTEGER) - Impressions at 1h
- `impressions_24h` (INTEGER) - Impressions at 24h
- `likes_1h` (INTEGER) - Likes at 1h
- `likes_24h` (INTEGER) - Likes at 24h
- `bookmarks_24h` (INTEGER) - Bookmarks at 24h
- `follower_delta_24h` (INTEGER) - Follower change over 24h
- `reward_score` (NUMERIC) - Computed reward score
- `reward_components` (JSONB) - Breakdown of reward calculation
- `f_per_1k_impressions` (NUMERIC) - Followers per 1000 impressions
- `computed_at` (TIMESTAMPTZ) - When computed
- `notes` (JSONB) - Additional metadata

**Unique Constraint:** `decision_id` - One reward feature per decision

**Indexes:**
- `idx_reward_features_decision_id` - For decision lookups
- `idx_reward_features_posted_at` (DESC) - For time-based queries
- `idx_reward_features_hour_of_day` - For hour-based analysis
- `idx_reward_features_reward_score` (DESC) - For top performers

**Usage:**
- Shadow Controller input
- Strategy optimization
- Learning system features

---

### 4. `daily_aggregates`

**Purpose:** Daily performance aggregates by dimension

**Columns:**
- `id` (UUID) - Primary key
- `date` (DATE) - Date
- `dimension_type` (TEXT) - 'hour_of_day', 'decision_type', 'format', 'topic', 'generator'
- `dimension_value` (TEXT) - Value of the dimension
- `total_decisions` (INTEGER) - Total decisions
- `total_impressions_24h` (BIGINT) - Total impressions
- `total_likes_24h` (BIGINT) - Total likes
- `total_bookmarks_24h` (BIGINT) - Total bookmarks
- `total_follower_delta_24h` (INTEGER) - Total follower delta
- `avg_reward_score` (NUMERIC) - Average reward score
- `avg_f_per_1k` (NUMERIC) - Average F/1K
- `computed_at` (TIMESTAMPTZ) - When computed

**Unique Constraint:** `(date, dimension_type, dimension_value)`

**Indexes:**
- `idx_daily_aggregates_date` (DESC) - For date-based queries
- `idx_daily_aggregates_dimension` - For dimension-based queries

**Usage:**
- Shadow Controller strategy weights
- Performance analysis by dimension
- Trend detection

---

## Jobs

### AccountSnapshotJob

**Purpose:** Capture hourly account snapshots

**Frequency:** Hourly (on Mac Runner)

**Script:** `pnpm run runner:account-snapshot-once`

**Process:**
1. Round timestamp to nearest hour (idempotency)
2. Check if snapshot already exists
3. Scrape follower count from Twitter profile (CDP)
4. Store in `account_snapshots`
5. Log `ACCOUNT_SNAPSHOT` event

**Fallback:** If scraping fails, estimates from last snapshot

---

### PerformanceSnapshotJob

**Purpose:** Collect performance metrics at 1h and 24h horizons

**Frequency:** Triggered by POST_SUCCESS events, processed periodically

**Script:** `pnpm run runner:performance-snapshot-once`

**Process:**
1. POST_SUCCESS event triggers `enqueuePerformanceSnapshots()`
2. Schedules snapshots for +60min and +1440min
3. `processScheduledSnapshots()` runs periodically
4. Collects metrics from Twitter (or existing metrics tables)
5. Stores in `performance_snapshots`

**Fallback:** If scraping fails, uses existing metrics from `content_metadata` or `outcomes`

---

### RewardComputationJob

**Purpose:** Compute reward scores and features

**Frequency:** Runs periodically (after snapshots are collected)

**Process:**
1. Find decisions with both 1h and 24h snapshots
2. Get follower delta from `account_snapshots`
3. Compute reward score (weighted: followers + impressions + bookmarks)
4. Compute F/1K metric
5. Store in `reward_features`
6. Compute daily aggregates

**Reward Weights (env vars):**
- `REWARD_FOLLOWERS_WEIGHT` (default: 0.5)
- `REWARD_IMPRESSIONS_WEIGHT` (default: 0.3)
- `REWARD_BOOKMARKS_WEIGHT` (default: 0.2)

---

## Query Examples

### Get recent account snapshots
```sql
SELECT timestamp, followers_count, following_count
FROM account_snapshots
ORDER BY timestamp DESC
LIMIT 24; -- Last 24 hours
```

### Get performance snapshots for a decision
```sql
SELECT horizon_minutes, impressions, likes, reposts, replies, bookmarks
FROM performance_snapshots
WHERE decision_id = '...'
ORDER BY horizon_minutes;
```

### Get reward features for recent decisions
```sql
SELECT 
  decision_id,
  decision_type,
  hour_of_day,
  reward_score,
  f_per_1k_impressions,
  follower_delta_24h
FROM reward_features
ORDER BY posted_at DESC
LIMIT 10;
```

### Get daily aggregates by hour
```sql
SELECT 
  dimension_value AS hour,
  total_decisions,
  avg_reward_score,
  avg_f_per_1k
FROM daily_aggregates
WHERE dimension_type = 'hour_of_day'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY dimension_value;
```

### Get top performing topics
```sql
SELECT 
  dimension_value AS topic,
  total_decisions,
  avg_reward_score,
  avg_f_per_1k
FROM daily_aggregates
WHERE dimension_type = 'topic'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY avg_reward_score DESC
LIMIT 10;
```

---

## Integration Points

### POST_SUCCESS Events

When a post succeeds:
1. `postingQueue.ts` emits `POST_SUCCESS` event to `system_events`
2. `enqueuePerformanceSnapshots()` is called
3. Snapshots are scheduled for +60min and +1440min

### Metrics Scraping

Performance snapshots can be collected via:
1. **Scraping** (Mac Runner, CDP mode) - Direct from Twitter
2. **Existing metrics** (fallback) - From `content_metadata` or `outcomes` tables

---

## Environment Variables

- `REWARD_FOLLOWERS_WEIGHT` - Weight for followers in reward (default: 0.5)
- `REWARD_IMPRESSIONS_WEIGHT` - Weight for impressions (default: 0.3)
- `REWARD_BOOKMARKS_WEIGHT` - Weight for bookmarks (default: 0.2)
- `SHADOW_MIN_POSTS_PER_HOUR` - Minimum posts/hour recommendation (default: 1)
- `SHADOW_MAX_POSTS_PER_HOUR` - Maximum posts/hour recommendation (default: 4)
- `SHADOW_MIN_REPLIES_PER_HOUR` - Minimum replies/hour recommendation (default: 2)
- `SHADOW_MAX_REPLIES_PER_HOUR` - Maximum replies/hour recommendation (default: 8)

---

## Next Steps

See `docs/GROWTH_SHADOW_CONTROLLER.md` for how recommendations are generated and how to move from shadow mode to control mode.

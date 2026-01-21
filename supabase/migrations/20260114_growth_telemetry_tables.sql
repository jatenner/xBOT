-- ═══════════════════════════════════════════════════════════════════════════════
-- GROWTH TELEMETRY TABLES
-- For Shadow Controller learning system
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. account_snapshots: Hourly account-level metrics
CREATE TABLE IF NOT EXISTS account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL,
  followers_count INTEGER NOT NULL,
  following_count INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  notes JSONB DEFAULT '{}'::jsonb,
  source TEXT DEFAULT 'scraped', -- 'scraped' or 'estimated'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one snapshot per hour (idempotency)
  UNIQUE(timestamp)
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_account_snapshots_timestamp 
  ON account_snapshots(timestamp DESC);

COMMENT ON TABLE account_snapshots IS 
  'Hourly snapshots of account metrics for cadence learning and follower attribution';

-- 2. performance_snapshots: Per-decision metrics at specific horizons
CREATE TABLE IF NOT EXISTS performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES content_metadata(decision_id) ON DELETE CASCADE,
  tweet_id TEXT,
  collected_at TIMESTAMPTZ NOT NULL,
  horizon_minutes INTEGER NOT NULL, -- 60 (1h) or 1440 (24h)
  
  -- Metrics
  impressions INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0, -- retweets
  replies INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  
  -- Metadata
  source TEXT DEFAULT 'scraped', -- 'scraped' or 'estimated'
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure idempotency: one snapshot per decision_id + horizon_minutes
  UNIQUE(decision_id, horizon_minutes)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_decision_id 
  ON performance_snapshots(decision_id);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_collected_at 
  ON performance_snapshots(collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_horizon 
  ON performance_snapshots(horizon_minutes, collected_at DESC);

COMMENT ON TABLE performance_snapshots IS 
  'Performance metrics for decisions at specific time horizons (1h, 24h) for learning';

-- 3. reward_features: Computed reward scores and features for learning
CREATE TABLE IF NOT EXISTS reward_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES content_metadata(decision_id) ON DELETE CASCADE,
  
  -- Decision features
  decision_type TEXT NOT NULL, -- 'single', 'thread', 'reply'
  posted_at TIMESTAMPTZ NOT NULL,
  hour_of_day INTEGER NOT NULL, -- 0-23
  generator_name TEXT,
  raw_topic TEXT,
  format_strategy TEXT,
  
  -- Performance at horizons
  impressions_1h INTEGER DEFAULT 0,
  impressions_24h INTEGER DEFAULT 0,
  likes_1h INTEGER DEFAULT 0,
  likes_24h INTEGER DEFAULT 0,
  bookmarks_24h INTEGER DEFAULT 0,
  
  -- Follower attribution
  follower_delta_24h INTEGER DEFAULT 0, -- Change in followers from before to 24h after
  
  -- Computed reward
  reward_score NUMERIC DEFAULT 0, -- Weighted combination of followers + impressions + bookmarks
  reward_components JSONB DEFAULT '{}'::jsonb, -- Breakdown of reward calculation
  
  -- F/1K metric
  f_per_1k_impressions NUMERIC DEFAULT 0, -- Followers per 1000 impressions (proxy)
  
  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  notes JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(decision_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reward_features_decision_id 
  ON reward_features(decision_id);

CREATE INDEX IF NOT EXISTS idx_reward_features_posted_at 
  ON reward_features(posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_features_hour_of_day 
  ON reward_features(hour_of_day);

CREATE INDEX IF NOT EXISTS idx_reward_features_reward_score 
  ON reward_features(reward_score DESC);

COMMENT ON TABLE reward_features IS 
  'Computed reward scores and features for cadence learning and strategy optimization';

-- 4. daily_aggregates: Daily performance aggregates by dimension
CREATE TABLE IF NOT EXISTS daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  dimension_type TEXT NOT NULL, -- 'hour_of_day', 'decision_type', 'format', 'topic', 'generator'
  dimension_value TEXT NOT NULL,
  
  -- Aggregates
  total_decisions INTEGER DEFAULT 0,
  total_impressions_24h BIGINT DEFAULT 0,
  total_likes_24h BIGINT DEFAULT 0,
  total_bookmarks_24h BIGINT DEFAULT 0,
  total_follower_delta_24h INTEGER DEFAULT 0,
  avg_reward_score NUMERIC DEFAULT 0,
  avg_f_per_1k NUMERIC DEFAULT 0,
  
  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(date, dimension_type, dimension_value)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date 
  ON daily_aggregates(date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_aggregates_dimension 
  ON daily_aggregates(dimension_type, dimension_value, date DESC);

COMMENT ON TABLE daily_aggregates IS 
  'Daily performance aggregates by dimension (hour, type, format, topic, generator) for strategy learning';

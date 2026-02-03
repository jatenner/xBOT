-- ═══════════════════════════════════════════════════════════════════════════════
-- RATE CONTROLLER SCHEMA
-- 
-- Adds columns for prompt_version, strategy_id, hour_bucket, outcome_score
-- and creates tables for rate controller state and learning weights
-- 
-- Date: February 3, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Add columns to content_metadata for rate controller tracking
ALTER TABLE content_metadata
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS strategy_id TEXT,
  ADD COLUMN IF NOT EXISTS hour_bucket INTEGER CHECK (hour_bucket >= 0 AND hour_bucket <= 23),
  ADD COLUMN IF NOT EXISTS outcome_score NUMERIC DEFAULT 0;

-- Add index for hour_bucket queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_hour_bucket ON content_metadata(hour_bucket) WHERE hour_bucket IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_metadata_strategy_id ON content_metadata(strategy_id) WHERE strategy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_metadata_prompt_version ON content_metadata(prompt_version) WHERE prompt_version IS NOT NULL;

-- Create rate_controller_state table for hourly targets and mode
CREATE TABLE IF NOT EXISTS rate_controller_state (
  id SERIAL PRIMARY KEY,
  hour_start TIMESTAMPTZ NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('WARMUP', 'GROWTH', 'COOLDOWN')),
  target_replies_this_hour INTEGER DEFAULT 0 CHECK (target_replies_this_hour >= 0),
  target_posts_this_hour INTEGER DEFAULT 0 CHECK (target_posts_this_hour >= 0),
  allow_search BOOLEAN DEFAULT true,
  executed_replies INTEGER DEFAULT 0,
  executed_posts INTEGER DEFAULT 0,
  risk_score NUMERIC DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 1),
  yield_score NUMERIC DEFAULT 0,
  budgets_remaining JSONB DEFAULT '{"nav": 20, "search": 1}',
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_controller_state_hour_start ON rate_controller_state(hour_start DESC);

-- Create strategy_weights table for learning loop
CREATE TABLE IF NOT EXISTS strategy_weights (
  strategy_id TEXT PRIMARY KEY,
  weight NUMERIC DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 10),
  total_posts INTEGER DEFAULT 0,
  total_outcome_score NUMERIC DEFAULT 0,
  avg_outcome_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hour_weights table for time-of-day optimization
CREATE TABLE IF NOT EXISTS hour_weights (
  hour_bucket INTEGER PRIMARY KEY CHECK (hour_bucket >= 0 AND hour_bucket <= 23),
  weight NUMERIC DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2),
  total_posts INTEGER DEFAULT 0,
  total_outcome_score NUMERIC DEFAULT 0,
  avg_outcome_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prompt_version_weights table
CREATE TABLE IF NOT EXISTS prompt_version_weights (
  prompt_version TEXT PRIMARY KEY,
  weight NUMERIC DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 10),
  total_posts INTEGER DEFAULT 0,
  total_outcome_score NUMERIC DEFAULT 0,
  avg_outcome_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON COLUMN content_metadata.prompt_version IS 'Prompt/template version identifier for learning';
COMMENT ON COLUMN content_metadata.strategy_id IS 'Strategy identifier (e.g., "baseline", "high_topic_fit")';
COMMENT ON COLUMN content_metadata.hour_bucket IS 'Hour of day (0-23) when posted (America/New_York timezone)';
COMMENT ON COLUMN content_metadata.outcome_score IS 'Computed outcome score (likes + retweets*2 + replies*3 + bookmarks*0.5) / max(1, impressions)';
COMMENT ON TABLE rate_controller_state IS 'Hourly rate controller targets and execution state';
COMMENT ON TABLE strategy_weights IS 'Learned weights for strategy selection';
COMMENT ON TABLE hour_weights IS 'Learned weights for hour-of-day optimization';
COMMENT ON TABLE prompt_version_weights IS 'Learned weights for prompt version selection';

COMMIT;

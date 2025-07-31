-- 🚀 ADAPTIVE POSTING SYSTEM MIGRATION (FIXED)
-- =====================================================
-- Implements intelligent daily posting limit optimization and slot performance tracking
-- Date: 2025-02-01
-- Purpose: Enable AI-driven posting frequency optimization with 5-100 daily post range
-- Fixed: Proper migration_history table handling and dependency management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 0. ENSURE MIGRATION HISTORY TABLE EXISTS (BULLETPROOF APPROACH)
-- ===================================================================
-- Create migration_history table if it doesn't exist (matches existing structure)
CREATE TABLE IF NOT EXISTS migration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 1. ENSURE CORE DEPENDENCIES EXIST
-- ===================================================================
-- Create bot_config table if it doesn't exist (dependency for runtime config)
CREATE TABLE IF NOT EXISTS bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for fast lookups
  CONSTRAINT bot_config_key_check CHECK (length(key) > 0)
);

CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key);
CREATE INDEX IF NOT EXISTS idx_bot_config_updated_at ON bot_config(updated_at DESC);

-- Create learning_posts table if it doesn't exist (dependency for performance tracking)
CREATE TABLE IF NOT EXISTS learning_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  quality_score INTEGER DEFAULT 0,
  audience_growth_potential INTEGER DEFAULT 0,
  was_posted BOOLEAN DEFAULT FALSE,
  post_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Performance tracking columns
  posting_hour INTEGER,
  posting_day_of_week INTEGER,
  content_length INTEGER,
  has_hook BOOLEAN DEFAULT FALSE,
  has_call_to_action BOOLEAN DEFAULT FALSE,
  
  -- Format and strategy tracking
  format_type TEXT,
  hook_type TEXT,
  content_category TEXT,
  bandit_confidence DECIMAL(3,2) DEFAULT 0.5,
  predicted_engagement INTEGER DEFAULT 0,
  
  -- Constraints
  CONSTRAINT learning_posts_quality_score_range CHECK (quality_score >= 0 AND quality_score <= 100),
  CONSTRAINT learning_posts_growth_potential_range CHECK (audience_growth_potential >= 0 AND audience_growth_potential <= 100),
  CONSTRAINT learning_posts_posting_hour_range CHECK (posting_hour >= 0 AND posting_hour <= 23),
  CONSTRAINT learning_posts_day_of_week_range CHECK (posting_day_of_week >= 0 AND posting_day_of_week <= 6)
);

CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON learning_posts(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON learning_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_posts_posting_hour ON learning_posts(posting_hour);
CREATE INDEX IF NOT EXISTS idx_learning_posts_format_type ON learning_posts(format_type);

-- ===================================================================
-- 2. ADAPTIVE POSTING CONFIGURATION
-- ===================================================================
-- Add adaptive posting configuration keys to bot_config
INSERT INTO bot_config (key, value) VALUES
  ('daily_post_cap', '15'),  -- AI-determined optimal posts per day (5-100)
  ('last_optimization_run', 'null'),
  ('posting_cap_reasoning', '{"reason": "Initial baseline", "factors": {}}'),
  ('slot_performance_enabled', 'true'),
  ('adaptive_posting_enabled', 'true'),
  ('min_daily_posts', '5'),
  ('max_daily_posts', '100'),
  ('optimization_confidence_threshold', '0.7'),
  ('slot_analysis_window_days', '7')
ON CONFLICT (key) DO NOTHING;

-- ===================================================================
-- 3. SLOT PERFORMANCE TRACKING TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS slot_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_slot INTEGER NOT NULL,  -- 0-23 (posting hour)
  day_of_week INTEGER NOT NULL,  -- 0-6 (Sunday=0)
  week_start_date DATE NOT NULL,
  
  -- Performance metrics
  total_posts INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  
  -- Calculated metrics
  avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
  likes_per_post DECIMAL(8,2) DEFAULT 0,
  viral_hit_count INTEGER DEFAULT 0,  -- Posts with >100 likes
  
  -- ROI metrics
  follower_acquisition INTEGER DEFAULT 0,
  cost_per_post DECIMAL(8,4) DEFAULT 0,
  roi_score DECIMAL(8,4) DEFAULT 0,
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  sample_size_adequate BOOLEAN DEFAULT FALSE,  -- TRUE when total_posts >= 5
  
  -- Constraints
  CONSTRAINT slot_performance_hour_range CHECK (hour_slot >= 0 AND hour_slot <= 23),
  CONSTRAINT slot_performance_day_range CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT slot_performance_metrics_positive CHECK (
    total_posts >= 0 AND total_likes >= 0 AND total_retweets >= 0 AND 
    total_replies >= 0 AND total_impressions >= 0 AND viral_hit_count >= 0
  ),
  
  -- Unique constraint for time slots
  UNIQUE(hour_slot, day_of_week, week_start_date)
);

-- Indexes for slot performance analysis
CREATE INDEX IF NOT EXISTS idx_slot_performance_hour ON slot_performance(hour_slot);
CREATE INDEX IF NOT EXISTS idx_slot_performance_day ON slot_performance(day_of_week);
CREATE INDEX IF NOT EXISTS idx_slot_performance_week ON slot_performance(week_start_date DESC);
CREATE INDEX IF NOT EXISTS idx_slot_performance_roi ON slot_performance(roi_score DESC);
CREATE INDEX IF NOT EXISTS idx_slot_performance_adequate_sample ON slot_performance(sample_size_adequate);

-- ===================================================================
-- 4. DECISION TRACE ENHANCEMENT
-- ===================================================================
-- Add decision_trace column to learning_posts for AI transparency
ALTER TABLE learning_posts 
ADD COLUMN IF NOT EXISTS decision_trace JSONB DEFAULT '{}';

-- Index for decision trace analysis
CREATE INDEX IF NOT EXISTS idx_learning_posts_decision_trace ON learning_posts USING GIN (decision_trace);

-- ===================================================================
-- 5. MATERIALIZED VIEW FOR SLOT ROI ANALYSIS
-- ===================================================================
-- Create materialized view for fast slot performance queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_slot_roi AS
SELECT 
  hour_slot,
  day_of_week,
  AVG(roi_score) as avg_roi_score,
  SUM(total_posts) as total_posts_all_weeks,
  AVG(avg_engagement_rate) as avg_engagement_rate,
  AVG(follower_acquisition) as avg_follower_acquisition,
  COUNT(*) as week_count,
  MAX(last_updated) as last_analysis_date
FROM slot_performance 
WHERE sample_size_adequate = TRUE
GROUP BY hour_slot, day_of_week
ORDER BY avg_roi_score DESC;

-- Index for materialized view
CREATE INDEX IF NOT EXISTS idx_mv_slot_roi_score ON mv_slot_roi(avg_roi_score DESC);
CREATE INDEX IF NOT EXISTS idx_mv_slot_roi_hour ON mv_slot_roi(hour_slot);

-- ===================================================================
-- 6. ADAPTIVE POSTING FUNCTIONS
-- ===================================================================

-- Function to get current daily posting limit
CREATE OR REPLACE FUNCTION get_daily_posting_limit()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_limit INTEGER;
BEGIN
  SELECT (value::text)::integer INTO current_limit
  FROM bot_config 
  WHERE key = 'daily_post_cap';
  
  -- Return default if not found
  RETURN COALESCE(current_limit, 15);
END;
$$;

-- Function to update daily posting limit (used by AI optimization)
CREATE OR REPLACE FUNCTION update_daily_posting_limit(
  new_limit INTEGER,
  reasoning_json JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  min_posts INTEGER;
  max_posts INTEGER;
BEGIN
  -- Get bounds from config
  SELECT (value::text)::integer INTO min_posts FROM bot_config WHERE key = 'min_daily_posts';
  SELECT (value::text)::integer INTO max_posts FROM bot_config WHERE key = 'max_daily_posts';
  
  -- Apply safety bounds
  min_posts := COALESCE(min_posts, 5);
  max_posts := COALESCE(max_posts, 100);
  
  -- Validate new limit
  IF new_limit < min_posts OR new_limit > max_posts THEN
    RAISE EXCEPTION 'Daily posting limit % is outside allowed range [%, %]', new_limit, min_posts, max_posts;
  END IF;
  
  -- Update the limit
  INSERT INTO bot_config (key, value)
  VALUES ('daily_post_cap', new_limit::text)
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
  
  -- Update reasoning
  INSERT INTO bot_config (key, value)
  VALUES ('posting_cap_reasoning', reasoning_json)
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
  
  -- Update last optimization timestamp
  INSERT INTO bot_config (key, value)
  VALUES ('last_optimization_run', to_json(NOW())::jsonb)
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- Function to update slot performance data
CREATE OR REPLACE FUNCTION update_slot_performance(
  p_hour_slot INTEGER,
  p_day_of_week INTEGER,
  p_likes INTEGER DEFAULT 0,
  p_retweets INTEGER DEFAULT 0,
  p_replies INTEGER DEFAULT 0,
  p_impressions INTEGER DEFAULT 0,
  p_follower_gain INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  current_week_start DATE;
  viral_threshold INTEGER := 100;  -- Likes threshold for viral hit
  is_viral BOOLEAN := FALSE;
BEGIN
  -- Calculate week start (Monday)
  current_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  
  -- Determine if this is a viral hit
  is_viral := p_likes >= viral_threshold;
  
  -- Insert or update slot performance
  INSERT INTO slot_performance (
    hour_slot, day_of_week, week_start_date,
    total_posts, total_likes, total_retweets, total_replies, total_impressions,
    viral_hit_count, follower_acquisition, last_updated
  )
  VALUES (
    p_hour_slot, p_day_of_week, current_week_start,
    1, p_likes, p_retweets, p_replies, p_impressions,
    CASE WHEN is_viral THEN 1 ELSE 0 END, p_follower_gain, NOW()
  )
  ON CONFLICT (hour_slot, day_of_week, week_start_date) DO UPDATE SET
    total_posts = slot_performance.total_posts + 1,
    total_likes = slot_performance.total_likes + p_likes,
    total_retweets = slot_performance.total_retweets + p_retweets,
    total_replies = slot_performance.total_replies + p_replies,
    total_impressions = slot_performance.total_impressions + p_impressions,
    viral_hit_count = slot_performance.viral_hit_count + CASE WHEN is_viral THEN 1 ELSE 0 END,
    follower_acquisition = slot_performance.follower_acquisition + p_follower_gain,
    last_updated = NOW();
  
  -- Update calculated metrics
  UPDATE slot_performance SET
    avg_engagement_rate = CASE 
      WHEN total_impressions > 0 THEN 
        (total_likes + total_retweets + total_replies)::DECIMAL / total_impressions 
      ELSE 0 
    END,
    likes_per_post = CASE 
      WHEN total_posts > 0 THEN total_likes::DECIMAL / total_posts 
      ELSE 0 
    END,
    roi_score = CASE 
      WHEN total_posts > 0 THEN 
        (follower_acquisition * 10 + viral_hit_count * 5 + total_likes * 0.1)::DECIMAL / total_posts
      ELSE 0 
    END,
    sample_size_adequate = total_posts >= 5
  WHERE hour_slot = p_hour_slot 
    AND day_of_week = p_day_of_week 
    AND week_start_date = current_week_start;
END;
$$;

-- Function to refresh slot ROI materialized view
CREATE OR REPLACE FUNCTION refresh_slot_roi_view()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_slot_roi;
END;
$$;

-- ===================================================================
-- 7. GRANT PERMISSIONS
-- ===================================================================
-- Grant necessary permissions to service role
GRANT EXECUTE ON FUNCTION get_daily_posting_limit() TO service_role;
GRANT EXECUTE ON FUNCTION update_daily_posting_limit(INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION update_slot_performance(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_slot_roi_view() TO service_role;

-- ===================================================================
-- 8. INITIAL MATERIALIZED VIEW REFRESH
-- ===================================================================
-- Initial refresh (will be empty but establishes the view)
SELECT refresh_slot_roi_view();

-- ===================================================================
-- 9. LOG SUCCESSFUL MIGRATION
-- ===================================================================
-- Record this migration as applied
INSERT INTO migration_history (filename) 
VALUES ('20250201_adaptive_posting_system_fixed.sql')
ON CONFLICT (filename) DO NOTHING;

-- Success notification
DO $$
BEGIN
  RAISE NOTICE '✅ Adaptive Posting System migration completed successfully!';
  RAISE NOTICE '📊 Created tables: slot_performance, enhanced learning_posts';
  RAISE NOTICE '🎯 Added adaptive posting config keys to bot_config';
  RAISE NOTICE '⚡ Created materialized view mv_slot_roi for performance analysis';
  RAISE NOTICE '🔧 Added functions: get_daily_posting_limit, update_daily_posting_limit, update_slot_performance';
  RAISE NOTICE '🚀 System ready for AI-driven posting optimization (5-100 posts/day)';
END;
$$;
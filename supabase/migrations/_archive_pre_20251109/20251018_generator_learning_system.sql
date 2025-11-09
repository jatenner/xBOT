-- =====================================================================================
-- GENERATOR LEARNING SYSTEM - Complete Schema
-- Purpose: Enable autonomous learning and optimization of content generators
-- Date: 2025-10-18
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. ADD GENERATOR TRACKING TO CONTENT_METADATA
-- =====================================================================================

-- Add generator name and experiment arm tracking
ALTER TABLE content_metadata
  ADD COLUMN IF NOT EXISTS generator_name TEXT,
  ADD COLUMN IF NOT EXISTS experiment_arm TEXT CHECK (experiment_arm IN ('control', 'variant_a', 'variant_b', NULL)),
  ADD COLUMN IF NOT EXISTS generator_confidence NUMERIC(5,4);

-- Add indexes for generator performance queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_generator 
  ON content_metadata(generator_name, posted_at DESC) 
  WHERE generator_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_metadata_experiment_arm 
  ON content_metadata(experiment_arm) 
  WHERE experiment_arm IS NOT NULL;

-- =====================================================================================
-- 2. CREATE GENERATOR_WEIGHTS TABLE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS generator_weights (
  id SERIAL PRIMARY KEY,
  generator_name TEXT NOT NULL UNIQUE,
  weight DECIMAL(5,4) NOT NULL CHECK (weight >= 0.01 AND weight <= 1.0),
  
  -- Performance tracking
  total_posts INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  avg_f_per_1k DECIMAL(8,4) DEFAULT 0, -- Followers per 1000 impressions
  avg_engagement_rate DECIMAL(8,6) DEFAULT 0,
  avg_likes DECIMAL(10,2) DEFAULT 0,
  avg_retweets DECIMAL(10,2) DEFAULT 0,
  avg_replies DECIMAL(10,2) DEFAULT 0,
  
  -- Quality metrics
  avg_quality_score DECIMAL(5,4) DEFAULT 0,
  viral_post_count INTEGER DEFAULT 0, -- Posts with F/1K > 5
  failed_post_count INTEGER DEFAULT 0, -- Posts with 0 followers
  
  -- Usage tracking
  times_selected INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status and control
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'testing', 'disabled', 'archived')),
  optimization_locked BOOLEAN DEFAULT FALSE, -- Prevent auto-optimization if TRUE
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize with default weights for 12 generators
INSERT INTO generator_weights (generator_name, weight, status) VALUES
  ('humanVoice', 0.15, 'active'),
  ('newsReporter', 0.12, 'active'),
  ('storyteller', 0.12, 'active'),
  ('interesting', 0.10, 'active'),
  ('provocateur', 0.10, 'active'),
  ('dataNerd', 0.10, 'active'),
  ('mythBuster', 0.10, 'active'),
  ('coach', 0.08, 'active'),
  ('thoughtLeader', 0.05, 'active'),
  ('contrarian', 0.04, 'active'),
  ('explorer', 0.02, 'active'),
  ('philosopher', 0.02, 'active')
ON CONFLICT (generator_name) DO NOTHING;

-- Indexes for generator_weights
CREATE INDEX IF NOT EXISTS idx_generator_weights_status 
  ON generator_weights(status);

CREATE INDEX IF NOT EXISTS idx_generator_weights_performance 
  ON generator_weights(avg_f_per_1k DESC, total_posts DESC);

CREATE INDEX IF NOT EXISTS idx_generator_weights_updated 
  ON generator_weights(last_updated DESC);

-- =====================================================================================
-- 3. CREATE GENERATOR_PERFORMANCE_HISTORY TABLE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS generator_performance_history (
  id BIGSERIAL PRIMARY KEY,
  generator_name TEXT NOT NULL REFERENCES generator_weights(generator_name) ON DELETE CASCADE,
  
  -- Snapshot period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Performance metrics for this period
  posts_count INTEGER NOT NULL DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  f_per_1k DECIMAL(8,4) DEFAULT 0,
  engagement_rate DECIMAL(8,6) DEFAULT 0,
  
  -- Aggregated stats
  total_likes INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  
  -- Weight at time of snapshot
  weight_used DECIMAL(5,4),
  experiment_arm TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance history
CREATE INDEX IF NOT EXISTS idx_generator_performance_generator 
  ON generator_performance_history(generator_name, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_generator_performance_period 
  ON generator_performance_history(period_end DESC);

-- =====================================================================================
-- 4. CREATE OPTIMIZATION_EVENTS TABLE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS optimization_events (
  id BIGSERIAL PRIMARY KEY,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('weight_update', 'generator_disabled', 'generator_enabled', 'viral_boost', 'failure_detected', 'manual_override')),
  
  -- Context
  posts_analyzed INTEGER,
  period_days INTEGER,
  generators_updated INTEGER,
  
  -- Results
  top_performer TEXT,
  top_performer_f_per_1k DECIMAL(8,4),
  bottom_performer TEXT,
  bottom_performer_f_per_1k DECIMAL(8,4),
  
  -- Changes made
  changes JSONB, -- Array of {generator, old_weight, new_weight, reason}
  
  -- Execution details
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'autonomous_system'
);

-- Indexes for optimization events
CREATE INDEX IF NOT EXISTS idx_optimization_events_type 
  ON optimization_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_optimization_events_created 
  ON optimization_events(created_at DESC);

-- =====================================================================================
-- 5. CREATE GENERATOR_PERFORMANCE VIEW (with safe column checks)
-- =====================================================================================

-- First add followers_gained column to outcomes if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'followers_gained'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN followers_gained INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'followers_before'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN followers_before INTEGER;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'followers_after'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN followers_after INTEGER;
  END IF;
END $$;

CREATE OR REPLACE VIEW generator_performance_summary AS
SELECT 
  gw.generator_name,
  gw.weight,
  gw.status,
  gw.total_posts,
  gw.total_followers_gained,
  gw.total_impressions,
  gw.avg_f_per_1k,
  gw.avg_engagement_rate,
  gw.avg_likes,
  gw.avg_retweets,
  gw.viral_post_count,
  gw.failed_post_count,
  gw.times_selected,
  gw.last_used,
  gw.last_updated,
  
  -- Recent performance (last 7 days)
  COALESCE(recent.recent_posts, 0) as recent_posts_7d,
  COALESCE(recent.recent_followers, 0) as recent_followers_7d,
  COALESCE(recent.recent_f_per_1k, 0) as recent_f_per_1k_7d,
  
  -- Trend
  CASE 
    WHEN gw.avg_f_per_1k > COALESCE(recent.recent_f_per_1k, 0) THEN 'declining'
    WHEN gw.avg_f_per_1k < COALESCE(recent.recent_f_per_1k, 0) THEN 'improving'
    ELSE 'stable'
  END as trend
  
FROM generator_weights gw
LEFT JOIN (
  SELECT 
    cm.generator_name,
    COUNT(*) as recent_posts,
    SUM(COALESCE(o.followers_gained, 0)) as recent_followers,
    (SUM(COALESCE(o.followers_gained, 0))::DECIMAL / NULLIF(SUM(o.impressions), 0) * 1000) as recent_f_per_1k
  FROM content_metadata cm
  JOIN outcomes o ON cm.decision_id::text = o.decision_id::text
  WHERE cm.posted_at > NOW() - INTERVAL '7 days'
    AND cm.generator_name IS NOT NULL
    AND o.impressions > 0
  GROUP BY cm.generator_name
) recent ON gw.generator_name = recent.generator_name
ORDER BY gw.avg_f_per_1k DESC NULLS LAST;

-- =====================================================================================
-- 6. CREATE HELPER FUNCTIONS
-- =====================================================================================

-- Function to update generator stats after new outcomes
CREATE OR REPLACE FUNCTION update_generator_stats(p_generator_name TEXT)
RETURNS void AS $$
BEGIN
  UPDATE generator_weights gw
  SET 
    total_posts = stats.posts,
    total_followers_gained = stats.followers,
    total_impressions = stats.impressions,
    avg_f_per_1k = stats.f_per_1k,
    avg_engagement_rate = stats.engagement_rate,
    avg_likes = stats.avg_likes,
    avg_retweets = stats.avg_retweets,
    avg_replies = stats.avg_replies,
    avg_quality_score = stats.avg_quality,
    viral_post_count = stats.viral_count,
    failed_post_count = stats.failed_count,
    last_updated = NOW()
  FROM (
    SELECT 
      cm.generator_name,
      COUNT(*) as posts,
      SUM(COALESCE(o.followers_gained, 0)) as followers,
      SUM(o.impressions) as impressions,
      (SUM(COALESCE(o.followers_gained, 0))::DECIMAL / NULLIF(SUM(o.impressions), 0) * 1000) as f_per_1k,
      AVG((o.likes + o.retweets * 2 + o.replies * 3)::DECIMAL / NULLIF(o.impressions, 0)) as engagement_rate,
      AVG(o.likes) as avg_likes,
      AVG(o.retweets) as avg_retweets,
      AVG(o.replies) as avg_replies,
      AVG(cm.quality_score) as avg_quality,
      COUNT(*) FILTER (WHERE (COALESCE(o.followers_gained, 0)::DECIMAL / NULLIF(o.impressions, 0) * 1000) > 5) as viral_count,
      COUNT(*) FILTER (WHERE COALESCE(o.followers_gained, 0) = 0 AND o.impressions > 100) as failed_count
    FROM content_metadata cm
    JOIN outcomes o ON cm.decision_id::text = o.decision_id::text
    WHERE cm.generator_name = p_generator_name
      AND cm.posted_at IS NOT NULL
      AND o.impressions > 0
    GROUP BY cm.generator_name
  ) stats
  WHERE gw.generator_name = stats.generator_name;
END;
$$ LANGUAGE plpgsql;

-- Function to log generator usage
CREATE OR REPLACE FUNCTION log_generator_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.generator_name IS NOT NULL AND NEW.status = 'posted' THEN
    UPDATE generator_weights
    SET 
      times_selected = times_selected + 1,
      last_used = NEW.posted_at
    WHERE generator_name = NEW.generator_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for generator usage logging
DROP TRIGGER IF EXISTS trigger_log_generator_usage ON content_metadata;
CREATE TRIGGER trigger_log_generator_usage
  AFTER UPDATE OF status ON content_metadata
  FOR EACH ROW
  WHEN (NEW.status = 'posted')
  EXECUTE FUNCTION log_generator_usage();

COMMIT;

-- =====================================================================================
-- VERIFICATION QUERIES
-- =====================================================================================

-- Verify tables created
SELECT 'generator_weights' as table_name, COUNT(*) as row_count FROM generator_weights
UNION ALL
SELECT 'generator_performance_history', COUNT(*) FROM generator_performance_history
UNION ALL
SELECT 'optimization_events', COUNT(*) FROM optimization_events;

-- Show initial generator weights
SELECT generator_name, weight, status FROM generator_weights ORDER BY weight DESC;


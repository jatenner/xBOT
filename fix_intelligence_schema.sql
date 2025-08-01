-- =====================================================
-- FIX INTELLIGENCE SCHEMA ISSUES
-- Run this directly in Supabase SQL Editor
-- =====================================================

-- First, safely drop and recreate trending_topics with correct schema
DROP TABLE IF EXISTS trending_topics CASCADE;

-- 📰 Trending Topics Cache (WITH CORRECT SCHEMA)
CREATE TABLE trending_topics (
  id bigserial PRIMARY KEY,
  keyword text NOT NULL,
  source text NOT NULL, -- 'twitter', 'guardian', 'manual'
  category text NOT NULL, -- 'health', 'nutrition', 'fitness', 'science'
  trend_score decimal(5,2) NOT NULL DEFAULT 0,
  volume integer DEFAULT 0,
  sentiment decimal(3,2) DEFAULT 0, -- -1 to 1
  
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  
  created_at timestamptz DEFAULT now()
);

-- 📊 Follower Snapshots - Track follower count over time
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id bigserial PRIMARY KEY,
  timestamp timestamptz NOT NULL DEFAULT now(),
  follower_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  tweets_count integer NOT NULL DEFAULT 0,
  account_handle text NOT NULL,
  
  created_at timestamptz DEFAULT now()
);

-- 📈 Follower Deltas - Track follower changes per tweet
CREATE TABLE IF NOT EXISTS follower_deltas (
  id bigserial PRIMARY KEY,
  tweet_id text,
  before_count integer NOT NULL,
  after_count integer NOT NULL,
  follower_gain integer NOT NULL,
  time_window_minutes integer NOT NULL,
  confidence decimal(5,2) NOT NULL DEFAULT 1.0,
  timestamp timestamptz NOT NULL DEFAULT now(),
  
  created_at timestamptz DEFAULT now()
);

-- 🎯 Bandit States - Store LinUCB bandit learning states
CREATE TABLE IF NOT EXISTS bandit_states (
  action_id text PRIMARY KEY,
  matrix_a text NOT NULL, -- JSON serialized covariance matrix
  vector_b text NOT NULL, -- JSON serialized reward vector
  alpha decimal(10,6) NOT NULL DEFAULT 1.0,
  dimension integer NOT NULL DEFAULT 8,
  last_update timestamptz NOT NULL DEFAULT now(),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 📝 Bandit Selections - Log all bandit action selections
CREATE TABLE IF NOT EXISTS bandit_selections (
  id bigserial PRIMARY KEY,
  action_id text NOT NULL,
  action_name text NOT NULL,
  action_type text NOT NULL,
  context text NOT NULL, -- JSON serialized context
  ucb_score decimal(10,6) NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  
  -- Performance tracking
  actual_reward decimal(10,6),
  reward_updated_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- 🚨 System Alerts - Intelligent monitoring
CREATE TABLE IF NOT EXISTS system_alerts (
  id bigserial PRIMARY KEY,
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  
  triggered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  is_resolved boolean DEFAULT false,
  auto_resolve_after interval DEFAULT '24 hours',
  
  created_at timestamptz DEFAULT now()
);

-- 📈 Indexes for performance
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_timestamp ON follower_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_follower_deltas_tweet_id ON follower_deltas(tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_deltas_timestamp ON follower_deltas(timestamp);
CREATE INDEX IF NOT EXISTS idx_bandit_selections_action_id ON bandit_selections(action_id);
CREATE INDEX IF NOT EXISTS idx_bandit_selections_selected_at ON bandit_selections(selected_at);
CREATE INDEX IF NOT EXISTS idx_trending_topics_category ON trending_topics(category);
CREATE INDEX IF NOT EXISTS idx_trending_topics_expires_at ON trending_topics(expires_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_alert_type ON system_alerts(alert_type);

-- 🚨 Function to create system alert (RPC for bot)
CREATE OR REPLACE FUNCTION create_system_alert(
  p_alert_type text,
  p_severity text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
  alert_id bigint;
BEGIN
  INSERT INTO system_alerts (alert_type, severity, title, message, metadata)
  VALUES (p_alert_type, p_severity, p_title, p_message, p_metadata)
  RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Add record to migration history
INSERT INTO migration_history (filename, applied_at) 
VALUES ('fix_intelligence_schema.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

-- Success feedback
SELECT 'Intelligence schema fixed successfully!' as status;
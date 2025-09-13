-- 20250914_0001_consolidated_schema.sql
-- Purpose: Consolidated, idempotent schema with consistent created_at columns
-- Safe to run multiple times

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- API Usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL,
  cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  event TEXT DEFAULT 'api_call',
  intent TEXT DEFAULT 'content_generation',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content events for tracking generation and posting
CREATE TABLE IF NOT EXISTS content_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL, -- generated|posted|engagement|error
  topic TEXT,
  format TEXT, -- single|thread|reply
  engagement NUMERIC(6,3),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bandit arms for Thompson Sampling optimization
CREATE TABLE IF NOT EXISTS bandit_arms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arm TEXT UNIQUE NOT NULL, -- e.g., 'nutrition:single:morning'
  alpha DOUBLE PRECISION NOT NULL DEFAULT 1,
  beta DOUBLE PRECISION NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Learning metrics for performance analysis
CREATE TABLE IF NOT EXISTS learn_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL, -- ctr|reply_rate|bookmark_rate
  value DOUBLE PRECISION NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decision log for AI strategy tracking
CREATE TABLE IF NOT EXISTS decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL, -- e.g., choose_slot, pick_topic, format
  reason TEXT,
  score NUMERIC(5,2),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budget tracking for cost control
CREATE TABLE IF NOT EXISTS budget_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key TEXT NOT NULL, -- YYYY-MM-DD
  amount_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'openai',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quality metrics for content assessment
CREATE TABLE IF NOT EXISTS quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT,
  quality_score NUMERIC(5,2),
  engagement_score NUMERIC(5,2),
  viral_potential NUMERIC(5,2),
  fact_accuracy NUMERIC(5,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy compatibility: learning_posts table
CREATE TABLE IF NOT EXISTS learning_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  tweet_id TEXT,
  topic TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  quality_score NUMERIC(5,2),
  learning_metadata JSONB DEFAULT '{}'::jsonb,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Legacy compatibility: tweet_metrics table
CREATE TABLE IF NOT EXISTS tweet_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  root_tweet_id TEXT,
  thread_position INTEGER,
  content TEXT,
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  quality_score NUMERIC(5,2),
  topic TEXT,
  learning_metadata JSONB DEFAULT '{}'::jsonb,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  latest_metrics_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if they don't exist (for migrating from ts to created_at)
DO $$
BEGIN
  -- api_usage
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_usage' AND column_name = 'created_at') THEN
    ALTER TABLE api_usage ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- content_events  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'content_events' AND column_name = 'created_at') THEN
    ALTER TABLE content_events ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- bandit_arms
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bandit_arms' AND column_name = 'created_at') THEN
    ALTER TABLE bandit_arms ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- learn_metrics
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learn_metrics' AND column_name = 'created_at') THEN
    ALTER TABLE learn_metrics ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- decision_log
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decision_log' AND column_name = 'created_at') THEN
    ALTER TABLE decision_log ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- budget_tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'budget_tracking' AND column_name = 'created_at') THEN
    ALTER TABLE budget_tracking ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  -- quality_metrics
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quality_metrics' AND column_name = 'created_at') THEN
    ALTER TABLE quality_metrics ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage(provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_model ON api_usage(model);
CREATE INDEX IF NOT EXISTS idx_api_usage_event ON api_usage(event);

CREATE INDEX IF NOT EXISTS idx_content_events_kind ON content_events(kind);
CREATE INDEX IF NOT EXISTS idx_content_events_topic ON content_events(topic);
CREATE INDEX IF NOT EXISTS idx_content_events_created_at ON content_events(created_at);

CREATE INDEX IF NOT EXISTS idx_bandit_arms_arm ON bandit_arms(arm);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_created_at ON bandit_arms(created_at);

CREATE INDEX IF NOT EXISTS idx_learn_metrics_metric ON learn_metrics(metric);
CREATE INDEX IF NOT EXISTS idx_learn_metrics_created_at ON learn_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_decision_log_action ON decision_log(action);
CREATE INDEX IF NOT EXISTS idx_decision_log_created_at ON decision_log(created_at);

CREATE INDEX IF NOT EXISTS idx_budget_tracking_date_key ON budget_tracking(date_key);
CREATE INDEX IF NOT EXISTS idx_budget_tracking_created_at ON budget_tracking(created_at);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_post_id ON quality_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_created_at ON quality_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON learning_posts(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON learning_posts(created_at);

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id ON tweet_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_created_at ON tweet_metrics(created_at);

-- Enable Row Level Security
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandit_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies (drop and recreate to ensure clean state)
DO $$
BEGIN
  -- api_usage policies
  DROP POLICY IF EXISTS "api_usage_all" ON api_usage;
  DROP POLICY IF EXISTS "api_usage_service" ON api_usage;
  CREATE POLICY "api_usage_all" ON api_usage FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "api_usage_service" ON api_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- content_events policies
  DROP POLICY IF EXISTS "content_events_all" ON content_events;
  CREATE POLICY "content_events_all" ON content_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- bandit_arms policies
  DROP POLICY IF EXISTS "bandit_arms_all" ON bandit_arms;
  CREATE POLICY "bandit_arms_all" ON bandit_arms FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- learn_metrics policies
  DROP POLICY IF EXISTS "learn_metrics_all" ON learn_metrics;
  CREATE POLICY "learn_metrics_all" ON learn_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- decision_log policies
  DROP POLICY IF EXISTS "decision_log_all" ON decision_log;
  CREATE POLICY "decision_log_all" ON decision_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- budget_tracking policies
  DROP POLICY IF EXISTS "budget_tracking_all" ON budget_tracking;
  CREATE POLICY "budget_tracking_all" ON budget_tracking FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- quality_metrics policies
  DROP POLICY IF EXISTS "quality_metrics_all" ON quality_metrics;
  CREATE POLICY "quality_metrics_all" ON quality_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- learning_posts policies
  DROP POLICY IF EXISTS "learning_posts_all" ON learning_posts;
  CREATE POLICY "learning_posts_all" ON learning_posts FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- tweet_metrics policies
  DROP POLICY IF EXISTS "tweet_metrics_all" ON tweet_metrics;
  CREATE POLICY "tweet_metrics_all" ON tweet_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN
  -- Ignore policy errors during setup
  NULL;
END $$;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;

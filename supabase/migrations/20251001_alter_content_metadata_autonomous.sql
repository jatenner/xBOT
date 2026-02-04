-- =====================================================================================
-- ALTER CONTENT_METADATA FOR AUTONOMOUS SYSTEM
-- Purpose: Add missing columns to existing content_metadata table
-- Date: 2025-10-01
-- =====================================================================================
-- Note: No BEGIN/COMMIT wrapper to avoid DO $$ block splitting issues

-- Add missing columns to content_metadata (skip if content_metadata is a view)
-- Use pg_class.relkind to check if it's a table ('r') vs view ('v')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    ALTER TABLE content_metadata
      ADD COLUMN IF NOT EXISTS decision_id UUID DEFAULT gen_random_uuid() UNIQUE,
      ADD COLUMN IF NOT EXISTS decision_type TEXT DEFAULT 'single' CHECK (decision_type IN ('single', 'thread', 'reply')),
      ADD COLUMN IF NOT EXISTS bandit_arm TEXT,
      ADD COLUMN IF NOT EXISTS timing_arm TEXT,
      ADD COLUMN IF NOT EXISTS predicted_er NUMERIC(5,4),
      ADD COLUMN IF NOT EXISTS generation_source TEXT DEFAULT 'real' CHECK (generation_source IN ('real', 'synthetic')),
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'posted', 'skipped', 'failed')),
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS angle TEXT,
      ADD COLUMN IF NOT EXISTS content_hash TEXT,
      ADD COLUMN IF NOT EXISTS features JSONB,
      ADD COLUMN IF NOT EXISTS target_tweet_id TEXT,
      ADD COLUMN IF NOT EXISTS target_username TEXT,
      ADD COLUMN IF NOT EXISTS skip_reason TEXT,
      ADD COLUMN IF NOT EXISTS error_message TEXT;
  END IF;
END $$;

-- Create indexes for new columns (on underlying table, content_metadata is a VIEW)
CREATE INDEX IF NOT EXISTS idx_content_status_scheduled 
  ON content_generation_metadata_comprehensive (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_generation_source 
  ON content_generation_metadata_comprehensive (generation_source);
CREATE INDEX IF NOT EXISTS idx_content_decision_type 
  ON content_generation_metadata_comprehensive (decision_type);
CREATE INDEX IF NOT EXISTS idx_content_decision_id 
  ON content_generation_metadata_comprehensive (decision_id);
CREATE INDEX IF NOT EXISTS idx_content_angle 
  ON content_generation_metadata_comprehensive (angle) WHERE angle IS NOT NULL;

-- Drop posted_decisions view if it exists (before creating table)
-- Use DO block to check relkind and drop view only if it's a view
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='posted_decisions' AND c.relkind='v' AND n.nspname='public'
  ) THEN
    DROP VIEW posted_decisions CASCADE;
  END IF;
END $$;

-- Create posted_decisions table (only if it doesn't exist and not already a table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='posted_decisions' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    CREATE TABLE posted_decisions (
      id BIGSERIAL PRIMARY KEY,
      decision_id UUID NOT NULL,
      decision_type TEXT NOT NULL,
      bandit_arm TEXT,
      timing_arm TEXT,
      generation_source TEXT NOT NULL,
      tweet_id TEXT NOT NULL,
      target_tweet_id TEXT,
      content TEXT,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;

-- Create indexes only if posted_decisions is a table (not a view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='posted_decisions' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id ON posted_decisions (tweet_id);
    CREATE INDEX IF NOT EXISTS idx_posted_decisions_decision_id ON posted_decisions (decision_id);
    CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at ON posted_decisions (posted_at DESC);
  END IF;
END $$;

-- Create/update outcomes table
CREATE TABLE IF NOT EXISTS outcomes (
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL,
  tweet_id TEXT NOT NULL,
  impressions BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  retweets BIGINT DEFAULT 0,
  replies BIGINT DEFAULT 0,
  bookmarks BIGINT DEFAULT 0,
  quotes BIGINT DEFAULT 0,
  er_calculated NUMERIC(5,4),
  simulated BOOLEAN NOT NULL DEFAULT false,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_decision 
  ON outcomes (decision_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_tweet 
  ON outcomes (tweet_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_simulated 
  ON outcomes (simulated, collected_at DESC);

-- Create bandit_arms table
CREATE TABLE IF NOT EXISTS bandit_arms (
  id BIGSERIAL PRIMARY KEY,
  arm_name TEXT UNIQUE NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('content', 'reply', 'timing')),
  successes BIGINT NOT NULL DEFAULT 0,
  failures BIGINT NOT NULL DEFAULT 0,
  alpha DOUBLE PRECISION DEFAULT 1.0,
  beta DOUBLE PRECISION DEFAULT 1.0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bandit_scope 
  ON bandit_arms (scope, arm_name);

-- Create api_usage table  
CREATE TABLE IF NOT EXISTS api_usage (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  model TEXT,
  tokens_input BIGINT DEFAULT 0,
  tokens_output BIGINT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_created 
  ON api_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_status 
  ON api_usage (status);
CREATE INDEX IF NOT EXISTS idx_api_usage_kind 
  ON api_usage (kind, created_at DESC);

-- Add comments (skip if content_metadata is a view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    COMMENT ON COLUMN content_metadata.generation_source IS 'real=LLM generated, synthetic=shadow mode fallback';
    COMMENT ON COLUMN content_metadata.status IS 'queued→posted/skipped/failed workflow';
  END IF;
END $$;

COMMENT ON COLUMN outcomes.simulated IS 'false=real X metrics, true=synthetic shadow data';
COMMENT ON COLUMN outcomes.er_calculated IS 'Engagement rate: (likes+retweets+replies)/impressions';

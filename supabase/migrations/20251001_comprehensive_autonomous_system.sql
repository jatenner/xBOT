-- =====================================================================================
-- COMPREHENSIVE AUTONOMOUS SYSTEM MIGRATION
-- Purpose: Full schema for autonomous posting with proper queue, outcomes, and learning
-- Date: 2025-10-01
-- =====================================================================================
-- Note: No BEGIN/COMMIT wrapper to avoid DO $$ block splitting issues

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================================
-- 1. CONTENT METADATA (decisions queue)
-- =====================================================================================

-- Create content_metadata table only if it doesn't exist as a table or view
DO $$
BEGIN
  -- Drop view if it exists
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='v' AND n.nspname='public'
  ) THEN
    DROP VIEW content_metadata CASCADE;
  END IF;
  
  -- Create table only if it doesn't exist as a table
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    CREATE TABLE content_metadata (
      id BIGSERIAL PRIMARY KEY,
      decision_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      decision_type TEXT NOT NULL CHECK (decision_type IN ('single', 'thread', 'reply')),
      content TEXT NOT NULL,
      bandit_arm TEXT,
      timing_arm TEXT,
      quality_score NUMERIC(5,4),
      predicted_er NUMERIC(5,4),
      generation_source TEXT NOT NULL CHECK (generation_source IN ('real', 'synthetic')),
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'posted', 'skipped', 'failed')),
      scheduled_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      embedding VECTOR(1536),
      topic_cluster TEXT,
      angle TEXT,
      content_hash TEXT,
      features JSONB,
      
      -- Reply-specific fields
      target_tweet_id TEXT,
      target_username TEXT,
      
      -- Additional metadata
      skip_reason TEXT,
      error_message TEXT,
      posted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Indexes for content_metadata (only if it's a table, not a view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    -- Use IF NOT EXISTS in EXECUTE to handle existing indexes gracefully
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_status_scheduled ON content_metadata (status, scheduled_at)';
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Index already exists or other error, skip
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_generation_source ON content_metadata (generation_source)';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_decision_type ON content_metadata (decision_type)';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_decision_id ON content_metadata (decision_id)';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_created ON content_metadata (created_at DESC)';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_topic_cluster ON content_metadata (topic_cluster) WHERE topic_cluster IS NOT NULL';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_content_angle ON content_metadata (angle) WHERE angle IS NOT NULL';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

-- =====================================================================================
-- 2. POSTED DECISIONS (archive of posted content)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS posted_decisions (
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

-- Add foreign key constraint only if content_metadata is a table and posted_decisions is a table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='r' AND n.nspname='public'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='posted_decisions' AND c.relkind='r' AND n.nspname='public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='fk_decision_id' AND conrelid='posted_decisions'::regclass
  ) THEN
    BEGIN
      ALTER TABLE posted_decisions
        ADD CONSTRAINT fk_decision_id FOREIGN KEY (decision_id) 
        REFERENCES content_metadata(decision_id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Constraint already exists or other error, skip
    END;
  END IF;
END $$;

-- Indexes for posted_decisions (only if it's a table, not a view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='posted_decisions' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id ON posted_decisions (tweet_id)';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posted_decisions_decision_id ON posted_decisions (decision_id)';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at ON posted_decisions (posted_at DESC)';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

-- =====================================================================================
-- 3. OUTCOMES (engagement metrics)
-- =====================================================================================

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

-- Add foreign key constraint only if content_metadata is a table and outcomes is a table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='r' AND n.nspname='public'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='outcomes' AND c.relkind='r' AND n.nspname='public'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='fk_outcome_decision' AND conrelid='outcomes'::regclass
  ) THEN
    BEGIN
      ALTER TABLE outcomes
        ADD CONSTRAINT fk_outcome_decision FOREIGN KEY (decision_id) 
        REFERENCES content_metadata(decision_id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Constraint already exists or other error, skip
    END;
  END IF;
END $$;

-- Indexes for outcomes
CREATE INDEX IF NOT EXISTS idx_outcomes_decision 
  ON outcomes (decision_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_tweet 
  ON outcomes (tweet_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_simulated 
  ON outcomes (simulated, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_collected 
  ON outcomes (collected_at DESC);

-- =====================================================================================
-- 4. BANDIT ARMS (Thompson sampling state)
-- =====================================================================================

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

-- Index for bandit_arms
CREATE INDEX IF NOT EXISTS idx_bandit_scope 
  ON bandit_arms (scope, arm_name);

-- =====================================================================================
-- 5. API USAGE (cost tracking)
-- =====================================================================================

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

-- Indexes for api_usage
CREATE INDEX IF NOT EXISTS idx_api_usage_created 
  ON api_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_status 
  ON api_usage (status);
CREATE INDEX IF NOT EXISTS idx_api_usage_kind 
  ON api_usage (kind, created_at DESC);

-- =====================================================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================================================

-- Comments (skip if content_metadata is a view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relname='content_metadata' AND c.relkind='r' AND n.nspname='public'
  ) THEN
    COMMENT ON TABLE content_metadata IS 'Decision queue for content planning with LLM generation tracking';
    COMMENT ON COLUMN content_metadata.generation_source IS 'real=LLM generated, synthetic=shadow mode fallback';
    COMMENT ON COLUMN content_metadata.status IS 'queued→posted/skipped/failed workflow';
  END IF;
END $$;

COMMENT ON TABLE posted_decisions IS 'Archive of successfully posted content with tweet IDs';
COMMENT ON TABLE outcomes IS 'Engagement metrics: simulated=false for real X data, true for shadow mode';
COMMENT ON TABLE bandit_arms IS 'Thompson sampling state for multi-armed bandit optimization';
COMMENT ON TABLE api_usage IS 'OpenAI API cost and usage tracking';

COMMENT ON COLUMN outcomes.simulated IS 'false=real X metrics, true=synthetic shadow data';
COMMENT ON COLUMN outcomes.er_calculated IS 'Engagement rate: (likes+retweets+replies)/impressions';

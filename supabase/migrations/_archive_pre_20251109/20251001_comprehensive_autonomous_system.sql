-- =====================================================================================
-- COMPREHENSIVE AUTONOMOUS SYSTEM MIGRATION
-- Purpose: Full schema for autonomous posting with proper queue, outcomes, and learning
-- Date: 2025-10-01
-- =====================================================================================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================================
-- 1. CONTENT METADATA (decisions queue)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS content_metadata (
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

-- Indexes for content_metadata
CREATE INDEX IF NOT EXISTS idx_content_status_scheduled 
  ON content_metadata (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_generation_source 
  ON content_metadata (generation_source);
CREATE INDEX IF NOT EXISTS idx_content_decision_type 
  ON content_metadata (decision_type);
CREATE INDEX IF NOT EXISTS idx_content_decision_id 
  ON content_metadata (decision_id);
CREATE INDEX IF NOT EXISTS idx_content_created 
  ON content_metadata (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_topic_cluster 
  ON content_metadata (topic_cluster) WHERE topic_cluster IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_angle 
  ON content_metadata (angle) WHERE angle IS NOT NULL;

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
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_decision_id FOREIGN KEY (decision_id) 
    REFERENCES content_metadata(decision_id) ON DELETE CASCADE
);

-- Indexes for posted_decisions
CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id 
  ON posted_decisions (tweet_id);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_decision_id 
  ON posted_decisions (decision_id);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at 
  ON posted_decisions (posted_at DESC);

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
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_outcome_decision FOREIGN KEY (decision_id) 
    REFERENCES content_metadata(decision_id) ON DELETE CASCADE
);

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

COMMENT ON TABLE content_metadata IS 'Decision queue for content planning with LLM generation tracking';
COMMENT ON TABLE posted_decisions IS 'Archive of successfully posted content with tweet IDs';
COMMENT ON TABLE outcomes IS 'Engagement metrics: simulated=false for real X data, true for shadow mode';
COMMENT ON TABLE bandit_arms IS 'Thompson sampling state for multi-armed bandit optimization';
COMMENT ON TABLE api_usage IS 'OpenAI API cost and usage tracking';

COMMENT ON COLUMN content_metadata.generation_source IS 'real=LLM generated, synthetic=shadow mode fallback';
COMMENT ON COLUMN content_metadata.status IS 'queued→posted/skipped/failed workflow';
COMMENT ON COLUMN outcomes.simulated IS 'false=real X metrics, true=synthetic shadow data';
COMMENT ON COLUMN outcomes.er_calculated IS 'Engagement rate: (likes+retweets+replies)/impressions';

COMMIT;

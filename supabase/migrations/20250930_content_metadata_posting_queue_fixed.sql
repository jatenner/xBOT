-- Migration: Create/Update content_metadata for posting queue
-- Purpose: Support posting queue workflow with status tracking and generation metadata
-- Date: 2025-09-30 (Fixed version - creates table if not exists)

BEGIN;

-- Create content_metadata table if it doesn't exist
-- This combines the viral_content_metadata schema with posting queue needs
CREATE TABLE IF NOT EXISTS content_metadata (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  
  -- Generation metadata
  style TEXT NOT NULL DEFAULT 'educational' CHECK (style IN ('educational', 'storytelling', 'contrarian', 'quick_tip')),
  fact_source TEXT NOT NULL DEFAULT 'llm_generated',
  topic TEXT NOT NULL DEFAULT 'health',
  hook_type TEXT NOT NULL DEFAULT 'tip_promise' CHECK (hook_type IN ('surprising_fact', 'myth_buster', 'story_opener', 'tip_promise')),
  cta_type TEXT NOT NULL DEFAULT 'follow_for_more' CHECK (cta_type IN ('follow_for_more', 'engagement_question', 'share_prompt', 'thread_continuation')),
  predicted_engagement TEXT NOT NULL DEFAULT 'medium',
  quality_score INTEGER NOT NULL DEFAULT 50 CHECK (quality_score >= 0 AND quality_score <= 100),
  thread_length INTEGER NOT NULL DEFAULT 1 CHECK (thread_length >= 1 AND thread_length <= 10),
  fact_count INTEGER NOT NULL DEFAULT 1,
  
  -- Posting queue fields (NEW)
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'queued', 'posted', 'failed', 'skipped')),
  generation_source TEXT CHECK (generation_source IN ('real', 'synthetic', NULL)),
  scheduled_at TIMESTAMPTZ,
  content TEXT,
  decision_type TEXT DEFAULT 'content' CHECK (decision_type IN ('content', 'reply')),
  target_tweet_id TEXT,
  target_username TEXT,
  predicted_er NUMERIC(5,4),
  
  -- Bandit tracking
  bandit_arm TEXT,
  timing_arm TEXT,
  topic_cluster TEXT,
  
  -- Embeddings for uniqueness (optional, requires pgvector)
  embedding VECTOR(1536),
  content_hash TEXT,
  features JSONB,
  experiment_id TEXT,
  
  -- Performance metrics (filled after posting)
  actual_likes INTEGER,
  actual_retweets INTEGER,
  actual_comments INTEGER,
  actual_impressions INTEGER,
  actual_engagement_rate NUMERIC(5,2),
  
  -- Learning scores
  prediction_accuracy NUMERIC(5,2),
  viral_score INTEGER CHECK (viral_score >= 0 AND viral_score <= 100),
  style_effectiveness INTEGER CHECK (style_effectiveness >= 0 AND style_effectiveness <= 100),
  
  -- Metadata for evolution
  hook_effectiveness NUMERIC(5,2),
  cta_effectiveness NUMERIC(5,2),
  fact_resonance NUMERIC(5,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If vector extension is not available, make embedding a TEXT field
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    ALTER TABLE content_metadata ALTER COLUMN embedding TYPE TEXT;
  END IF;
EXCEPTION
  WHEN undefined_column THEN
    -- embedding column doesn't exist, that's fine
    NULL;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_metadata_style ON content_metadata(style);
CREATE INDEX IF NOT EXISTS idx_content_metadata_topic ON content_metadata(topic);
CREATE INDEX IF NOT EXISTS idx_content_metadata_created_at ON content_metadata(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_metadata_content_id ON content_metadata(content_id);
CREATE INDEX IF NOT EXISTS idx_content_metadata_status ON content_metadata(status);
CREATE INDEX IF NOT EXISTS idx_content_metadata_generation_source ON content_metadata(generation_source);
CREATE INDEX IF NOT EXISTS idx_content_metadata_scheduled ON content_metadata(scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_content_metadata_status_created ON content_metadata(status, created_at DESC);

-- Create posted_decisions table if it doesn't exist
CREATE TABLE IF NOT EXISTS posted_decisions (
  id BIGSERIAL PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  tweet_id TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('content', 'reply')),
  target_tweet_id TEXT,
  target_username TEXT,
  bandit_arm TEXT,
  timing_arm TEXT,
  predicted_er NUMERIC(5,4),
  quality_score NUMERIC(5,4),
  topic_cluster TEXT,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for posted_decisions
CREATE INDEX IF NOT EXISTS idx_posted_decisions_tweet_id ON posted_decisions(tweet_id);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_decision_id ON posted_decisions(decision_id);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_posted_at ON posted_decisions(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_decisions_decision_type ON posted_decisions(decision_type);

-- Comments for documentation
COMMENT ON COLUMN content_metadata.status IS 'Workflow status: planned -> queued -> posted/failed/skipped';
COMMENT ON COLUMN content_metadata.generation_source IS 'real=LLM generated, synthetic=fallback/shadow mode';
COMMENT ON COLUMN content_metadata.scheduled_at IS 'When this content is scheduled to post';
COMMENT ON TABLE posted_decisions IS 'Archive of successfully posted decisions with tweet IDs';

-- Ensure outcomes table exists (critical for learning system)
CREATE TABLE IF NOT EXISTS outcomes (
  id BIGSERIAL PRIMARY KEY,
  decision_id TEXT NOT NULL,
  tweet_id TEXT,
  simulated BOOLEAN NOT NULL DEFAULT false,
  impressions INT,
  likes INT,
  retweets INT,
  replies INT,
  bookmarks INT,
  quotes INT,
  engagement_rate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_decision_created ON outcomes(decision_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_tweet_created ON outcomes(tweet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_simulated ON outcomes(simulated);

COMMENT ON TABLE outcomes IS 'Unified outcome tracking for both real and simulated engagement data';
COMMENT ON COLUMN outcomes.simulated IS 'false=real Twitter metrics, true=synthetic shadow mode data';

COMMIT;

-- Migration: Add posting queue columns to content_metadata
-- Purpose: Support posting queue workflow with status tracking and generation metadata
-- Date: 2025-09-30

BEGIN;

-- Add columns needed for posting queue workflow
ALTER TABLE content_metadata
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS generation_source TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS decision_type TEXT DEFAULT 'content',
  ADD COLUMN IF NOT EXISTS target_tweet_id TEXT,
  ADD COLUMN IF NOT EXISTS target_username TEXT,
  ADD COLUMN IF NOT EXISTS predicted_er NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_metadata_status_check'
  ) THEN
    ALTER TABLE content_metadata
      ADD CONSTRAINT content_metadata_status_check
      CHECK (status IN ('planned', 'queued', 'posted', 'failed', 'skipped'));
  END IF;
END $$;

-- Add generation_source constraint  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_metadata_generation_source_check'
  ) THEN
    ALTER TABLE content_metadata
      ADD CONSTRAINT content_metadata_generation_source_check
      CHECK (generation_source IN ('real', 'synthetic', NULL));
  END IF;
END $$;

-- Add decision_type constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_metadata_decision_type_check'
  ) THEN
    ALTER TABLE content_metadata
      ADD CONSTRAINT content_metadata_decision_type_check
      CHECK (decision_type IN ('content', 'reply'));
  END IF;
END $$;

-- Create indexes for posting queue queries
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

COMMIT;

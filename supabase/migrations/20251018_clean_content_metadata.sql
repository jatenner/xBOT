-- =====================================================================================
-- CLEAN CONTENT_METADATA MIGRATION
-- Purpose: Drop and recreate with CORRECT schema (no more conflicts)
-- Date: 2025-10-18
-- Author: AI Agent (Post-Audit Fix)
-- =====================================================================================

BEGIN;

-- Drop existing table and all dependencies
DROP TABLE IF EXISTS content_metadata CASCADE;

-- Recreate with clean, unified schema
CREATE TABLE content_metadata (
  -- Primary key (auto-generated)
  id BIGSERIAL PRIMARY KEY,
  
  -- Decision tracking
  decision_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('single', 'thread', 'reply')),
  
  -- Content
  content TEXT NOT NULL,
  thread_parts JSONB, -- For threads: ["tweet1", "tweet2", ...]
  
  -- Metadata
  topic_cluster TEXT,
  bandit_arm TEXT,
  timing_arm TEXT,
  angle TEXT,
  
  -- Quality & Predictions
  quality_score NUMERIC(5,4),
  predicted_er NUMERIC(5,4),
  predicted_engagement TEXT,
  
  -- Generation metadata
  generation_source TEXT NOT NULL CHECK (generation_source IN ('real', 'synthetic')),
  generator_name TEXT, -- Which of the 12 generators made this
  style TEXT,
  fact_source TEXT,
  hook_type TEXT,
  hook_pattern TEXT,
  cta_type TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'posted', 'skipped', 'failed')),
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  
  -- Reply-specific fields
  target_tweet_id TEXT,
  target_username TEXT,
  
  -- Advanced features
  embedding VECTOR(1536), -- For similarity checking
  content_hash TEXT,
  features JSONB, -- AI-extracted features
  experiment_id TEXT,
  experiment_arm TEXT, -- control, variant_a, variant_b
  
  -- Content analysis
  thread_length INTEGER DEFAULT 1 CHECK (thread_length >= 1 AND thread_length <= 25),
  fact_count INTEGER DEFAULT 1,
  novelty REAL CHECK (novelty >= 0 AND novelty <= 1),
  readability_score REAL,
  sentiment REAL CHECK (sentiment >= -1 AND sentiment <= 1),
  
  -- Performance tracking (filled after posting)
  tweet_id TEXT, -- Actual Twitter tweet ID
  actual_likes INTEGER,
  actual_retweets INTEGER,
  actual_replies INTEGER,
  actual_impressions INTEGER,
  actual_engagement_rate NUMERIC(5,4),
  viral_score INTEGER CHECK (viral_score >= 0 AND viral_score <= 100),
  
  -- Learning metrics
  prediction_accuracy NUMERIC(5,4),
  style_effectiveness INTEGER CHECK (style_effectiveness >= 0 AND style_effectiveness <= 100),
  hook_effectiveness NUMERIC(5,4),
  cta_effectiveness NUMERIC(5,4),
  fact_resonance NUMERIC(5,4),
  
  -- Error tracking
  skip_reason TEXT,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_content_status_scheduled ON content_metadata (status, scheduled_at);
CREATE INDEX idx_content_decision_id ON content_metadata (decision_id);
CREATE INDEX idx_content_decision_type ON content_metadata (decision_type);
CREATE INDEX idx_content_generation_source ON content_metadata (generation_source);
CREATE INDEX idx_content_tweet_id ON content_metadata (tweet_id) WHERE tweet_id IS NOT NULL;
CREATE INDEX idx_content_topic_cluster ON content_metadata (topic_cluster) WHERE topic_cluster IS NOT NULL;
CREATE INDEX idx_content_bandit_arm ON content_metadata (bandit_arm) WHERE bandit_arm IS NOT NULL;
CREATE INDEX idx_content_created_at ON content_metadata (created_at DESC);
CREATE INDEX idx_content_posted_at ON content_metadata (posted_at DESC) WHERE posted_at IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_metadata_updated_at
    BEFORE UPDATE ON content_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================
-- After running, verify with:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'content_metadata' 
-- ORDER BY ordinal_position;


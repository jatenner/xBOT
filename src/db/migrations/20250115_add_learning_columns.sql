-- Migration: Add learning and engagement tracking columns
-- Up migration

-- Add missing columns to learning_posts table
ALTER TABLE IF EXISTS learning_posts
  ADD COLUMN IF NOT EXISTS impressions BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS likes BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retweets BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replies BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS tweet_id TEXT,
  ADD COLUMN IF NOT EXISTS thread_position INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC(10,2);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON learning_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_posts_posted_at ON learning_posts (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON learning_posts (tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_engagement ON learning_posts (engagement_score DESC NULLS LAST);

-- Create posting_locks table for distributed locking (backup to Redis)
CREATE TABLE IF NOT EXISTS posting_locks (
  id SERIAL PRIMARY KEY,
  lock_key TEXT UNIQUE NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  process_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_posting_locks_key ON posting_locks (lock_key);
CREATE INDEX IF NOT EXISTS idx_posting_locks_expires ON posting_locks (expires_at);

-- Create tweet_metrics table for detailed tracking
CREATE TABLE IF NOT EXISTS tweet_metrics (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT UNIQUE NOT NULL,
  root_tweet_id TEXT,
  thread_position INTEGER DEFAULT 1,
  content TEXT,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Engagement metrics
  likes_count BIGINT DEFAULT 0,
  retweets_count BIGINT DEFAULT 0,
  replies_count BIGINT DEFAULT 0,
  impressions_count BIGINT DEFAULT 0,
  
  -- Quality and performance tracking
  quality_score NUMERIC(5,2),
  engagement_rate NUMERIC(8,4),
  
  -- Metadata
  topic TEXT,
  content_type TEXT DEFAULT 'tweet',
  learning_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Tracking timestamps
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  first_metrics_at TIMESTAMPTZ,
  latest_metrics_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id ON tweet_metrics (tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_root_id ON tweet_metrics (root_tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_posted_at ON tweet_metrics (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_engagement_rate ON tweet_metrics (engagement_rate DESC NULLS LAST);

-- Create content_analysis table for quality tracking
CREATE TABLE IF NOT EXISTS content_analysis (
  id BIGSERIAL PRIMARY KEY,
  content_hash TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  topic TEXT,
  
  -- Quality metrics
  quality_score NUMERIC(5,2),
  completeness_score NUMERIC(5,2),
  value_score NUMERIC(5,2),
  clarity_score NUMERIC(5,2),
  actionability_score NUMERIC(5,2),
  engagement_score NUMERIC(5,2),
  evidence_score NUMERIC(5,2),
  
  -- Content characteristics
  tweet_count INTEGER,
  total_chars INTEGER,
  has_banned_phrases BOOLEAN DEFAULT FALSE,
  has_concrete_examples BOOLEAN DEFAULT FALSE,
  
  -- Generation metadata
  model_used TEXT,
  generation_attempts INTEGER DEFAULT 1,
  regeneration_reasons TEXT[],
  
  -- Performance tracking
  posted_count INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(8,4),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_analysis_hash ON content_analysis (content_hash);
CREATE INDEX IF NOT EXISTS idx_content_analysis_quality_score ON content_analysis (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_analysis_topic ON content_analysis (topic);

-- Add trigger to update updated_at on content_analysis
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_analysis_updated_at 
  BEFORE UPDATE ON content_analysis 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired locks (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM posting_locks WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Ensure database uses proper SSL configuration
-- This is informational - actual connection should use sslmode=require
COMMENT ON TABLE learning_posts IS 'Enhanced with engagement tracking and quality metrics';
COMMENT ON TABLE tweet_metrics IS 'Detailed tweet performance tracking';
COMMENT ON TABLE content_analysis IS 'Content quality analysis and learning';
COMMENT ON TABLE posting_locks IS 'Distributed posting locks (backup to Redis)';

-- Down migration (for rollback)
-- ALTER TABLE IF EXISTS learning_posts
--   DROP COLUMN IF EXISTS impressions,
--   DROP COLUMN IF EXISTS learning_metadata,
--   DROP COLUMN IF EXISTS likes,
--   DROP COLUMN IF EXISTS retweets,
--   DROP COLUMN IF EXISTS replies,
--   DROP COLUMN IF EXISTS posted_at,
--   DROP COLUMN IF EXISTS tweet_id,
--   DROP COLUMN IF EXISTS thread_position,
--   DROP COLUMN IF EXISTS quality_score,
--   DROP COLUMN IF EXISTS engagement_score;
-- 
-- DROP TABLE IF EXISTS posting_locks;
-- DROP TABLE IF EXISTS tweet_metrics;
-- DROP TABLE IF EXISTS content_analysis;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP FUNCTION IF EXISTS cleanup_expired_locks();

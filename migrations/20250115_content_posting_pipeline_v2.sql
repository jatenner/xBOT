-- xBOT Content & Posting Pipeline V2.0 Migration
-- Date: 2025-01-15
-- Purpose: Add tables for new quality-first posting system

-- Add missing columns to learning_posts (idempotent)
ALTER TABLE IF EXISTS learning_posts
  ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS learning_posts_posted_at_idx ON learning_posts(posted_at);
CREATE INDEX IF NOT EXISTS learning_posts_tweet_id_idx ON learning_posts(tweet_id);

-- Store per-tweet signatures for deduplication
CREATE TABLE IF NOT EXISTS posted_tweets (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  text_sig TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posted_tweets_posted_at_idx ON posted_tweets(posted_at);
CREATE INDEX IF NOT EXISTS posted_tweets_text_sig_idx ON posted_tweets(text_sig);

-- Add thread tracking table
CREATE TABLE IF NOT EXISTS posted_threads (
  id BIGSERIAL PRIMARY KEY,
  root_tweet_id TEXT NOT NULL,
  reply_tweet_ids TEXT[] DEFAULT '{}',
  topic TEXT,
  hook TEXT,
  quality_score NUMERIC(5,2),
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posted_threads_posted_at_idx ON posted_threads(posted_at);
CREATE INDEX IF NOT EXISTS posted_threads_root_id_idx ON posted_threads(root_tweet_id);

-- Add engagement tracking columns to posted_threads
ALTER TABLE IF EXISTS posted_threads
  ADD COLUMN IF NOT EXISTS engagement_bucket TEXT,
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS follow_through_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS save_rate_proxy NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS hook_keeper_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS final_likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_retweets INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_replies INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_impressions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hook_used TEXT DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

-- Content selection tracking
CREATE TABLE IF NOT EXISTS content_selections (
  id BIGSERIAL PRIMARY KEY,
  pillar TEXT NOT NULL,
  angle TEXT NOT NULL,
  spice_level INTEGER NOT NULL,
  evidence_mode TEXT NOT NULL,
  quality_score NUMERIC(5,2),
  engagement_bucket TEXT,
  follow_through_rate NUMERIC(5,2),
  root_tweet_id TEXT,
  selection_reasoning TEXT,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_selections_posted_at_idx ON content_selections(posted_at);
CREATE INDEX IF NOT EXISTS content_selections_pillar_idx ON content_selections(pillar);
CREATE INDEX IF NOT EXISTS content_selections_engagement_idx ON content_selections(engagement_bucket);

-- Detailed engagement evaluations
CREATE TABLE IF NOT EXISTS engagement_evaluations (
  id BIGSERIAL PRIMARY KEY,
  root_tweet_id TEXT NOT NULL,
  engagement_bucket TEXT NOT NULL,
  engagement_score NUMERIC(10,2),
  follow_through_rate NUMERIC(5,2),
  save_rate_proxy NUMERIC(5,2),
  hook_keeper_score NUMERIC(5,2),
  total_likes INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS engagement_evaluations_tweet_id_idx ON engagement_evaluations(root_tweet_id);
CREATE INDEX IF NOT EXISTS engagement_evaluations_bucket_idx ON engagement_evaluations(engagement_bucket);
CREATE INDEX IF NOT EXISTS engagement_evaluations_score_idx ON engagement_evaluations(engagement_score DESC);

-- Hook performance tracking
CREATE TABLE IF NOT EXISTS hook_performance (
  id BIGSERIAL PRIMARY KEY,
  root_tweet_id TEXT NOT NULL,
  hook_used TEXT NOT NULL CHECK (hook_used IN ('A', 'B')),
  hook_text TEXT NOT NULL,
  pillar TEXT NOT NULL,
  angle TEXT NOT NULL,
  pattern_used TEXT,
  psychology_trigger TEXT,
  engagement_bucket TEXT,
  engagement_score NUMERIC(10,2),
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hook_performance_pillar_idx ON hook_performance(pillar);
CREATE INDEX IF NOT EXISTS hook_performance_hook_used_idx ON hook_performance(hook_used);
CREATE INDEX IF NOT EXISTS hook_performance_bucket_idx ON hook_performance(engagement_bucket);

-- Clean up any orphaned data
DELETE FROM learning_posts WHERE tweet_id LIKE 'posted_%' AND created_at < NOW() - INTERVAL '7 days';

-- Add to migration history
INSERT INTO migration_history (filename, applied_at) 
VALUES ('20250115_content_posting_pipeline_v2.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '✅ Content & Posting Pipeline V2.0 migration completed successfully';
  RAISE NOTICE '📊 Enhanced learning_posts with impressions, metadata columns';
  RAISE NOTICE '🔍 Added posted_tweets table for deduplication tracking';
  RAISE NOTICE '🧵 Added posted_threads table for thread performance tracking';
  RAISE NOTICE '📈 Added indexes for optimal query performance';
END $$;

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

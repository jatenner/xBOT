-- EMERGENCY DATABASE SCHEMA FIX
-- This ensures the tweet_analytics table has all required columns for real engagement tracking

-- First, ensure the table exists with proper structure
CREATE TABLE IF NOT EXISTS tweet_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL,
  
  -- Core engagement metrics (what we actually care about)
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  
  -- Calculated metrics
  engagement_rate DECIMAL(8,4) DEFAULT 0,
  viral_score INTEGER DEFAULT 0,
  
  -- Content for analysis
  content TEXT,
  
  -- Tracking metadata
  snapshot_time TIMESTAMPTZ DEFAULT NOW(),
  collected_via VARCHAR(50) DEFAULT 'api',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  -- Add likes column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'likes') THEN
    ALTER TABLE tweet_analytics ADD COLUMN likes INTEGER DEFAULT 0;
  END IF;
  
  -- Add retweets column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'retweets') THEN
    ALTER TABLE tweet_analytics ADD COLUMN retweets INTEGER DEFAULT 0;
  END IF;
  
  -- Add replies column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'replies') THEN
    ALTER TABLE tweet_analytics ADD COLUMN replies INTEGER DEFAULT 0;
  END IF;
  
  -- Add views column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'views') THEN
    ALTER TABLE tweet_analytics ADD COLUMN views INTEGER DEFAULT 0;
  END IF;
  
  -- Add engagement_rate column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'engagement_rate') THEN
    ALTER TABLE tweet_analytics ADD COLUMN engagement_rate DECIMAL(8,4) DEFAULT 0;
  END IF;
  
  -- Add viral_score column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'viral_score') THEN
    ALTER TABLE tweet_analytics ADD COLUMN viral_score INTEGER DEFAULT 0;
  END IF;
  
  -- Add content column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'content') THEN
    ALTER TABLE tweet_analytics ADD COLUMN content TEXT;
  END IF;
  
  -- Add snapshot_time column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'snapshot_time') THEN
    ALTER TABLE tweet_analytics ADD COLUMN snapshot_time TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  -- Add collected_via column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'collected_via') THEN
    ALTER TABLE tweet_analytics ADD COLUMN collected_via VARCHAR(50) DEFAULT 'api';
  END IF;
  
  -- Add updated_at column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'updated_at') THEN
    ALTER TABLE tweet_analytics ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_snapshot_time ON tweet_analytics(snapshot_time);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_engagement_rate ON tweet_analytics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_viral_score ON tweet_analytics(viral_score DESC);

-- Create unique constraint to prevent duplicates (allow updates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tweet_analytics_unique_tweet 
ON tweet_analytics(tweet_id);

-- Ensure learning_posts table exists for the simplified system
CREATE TABLE IF NOT EXISTS learning_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255),
  content TEXT NOT NULL,
  quality_score INTEGER DEFAULT 0,
  format_type VARCHAR(50) DEFAULT 'single',
  engagement_prediction INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on learning_posts
CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON learning_posts(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_quality_score ON learning_posts(quality_score DESC);

-- Clean up any NULL content entries that might be causing issues
UPDATE tweet_analytics SET content = 'Content not available' WHERE content IS NULL;

-- Show current schema for verification
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tweet_analytics' 
ORDER BY ordinal_position;
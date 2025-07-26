-- 🔄 CONTINUOUS TWEET MONITORING SCHEMA
-- Adds required columns for real-time tweet performance tracking

-- Add performance tracking columns to tweets table
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS retweets_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quotes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS impressions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_velocity DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure tweet_metrics table has all required columns
CREATE TABLE IF NOT EXISTS tweet_metrics (
  id SERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  viral_velocity DECIMAL(10,2) DEFAULT 0,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tweet_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_viral_velocity ON tweets(viral_velocity DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_updated_at ON tweets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_captured_at ON tweet_metrics(captured_at DESC);

-- Update existing tweets to have default values
UPDATE tweets 
SET 
  likes_count = COALESCE(likes_count, 0),
  retweets_count = COALESCE(retweets_count, 0),
  replies_count = COALESCE(replies_count, 0),
  quotes_count = COALESCE(quotes_count, 0),
  impressions_count = COALESCE(impressions_count, 0),
  viral_velocity = COALESCE(viral_velocity, 0),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE 
  likes_count IS NULL 
  OR retweets_count IS NULL 
  OR replies_count IS NULL 
  OR quotes_count IS NULL 
  OR impressions_count IS NULL 
  OR viral_velocity IS NULL 
  OR updated_at IS NULL;

-- Comment for documentation
COMMENT ON TABLE tweet_metrics IS 'Historical tweet performance metrics for continuous monitoring and AI learning';
COMMENT ON COLUMN tweets.viral_velocity IS 'Engagement velocity (engagement per hour) for viral detection';
COMMENT ON COLUMN tweets.updated_at IS 'Last time tweet performance was updated from Twitter API'; 
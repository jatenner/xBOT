-- 🎯 ESSENTIAL TABLES ONLY - MINIMAL VERSION
-- Just the tables needed for the implemented features to work immediately

-- Quote tweets table (for Phase 3 - Quote Tweet Agent)
CREATE TABLE IF NOT EXISTS quote_tweets (
  id BIGSERIAL PRIMARY KEY,
  original_tweet_id TEXT NOT NULL UNIQUE,
  original_author TEXT NOT NULL,
  original_content TEXT NOT NULL,
  quote_content TEXT NOT NULL,
  original_engagement INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follower tracking table (for Phase 6 - Follower Tracker)
CREATE TABLE IF NOT EXISTS follower_log (
  id BIGSERIAL PRIMARY KEY,
  follower_count INTEGER NOT NULL,
  following_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  growth_since_yesterday INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily uniqueness constraint for follower_log
CREATE UNIQUE INDEX IF NOT EXISTS idx_follower_log_daily 
ON follower_log (DATE(recorded_at));

-- Essential indexes
CREATE INDEX IF NOT EXISTS idx_quote_tweets_created_at ON quote_tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follower_log_recorded_at ON follower_log(recorded_at DESC); 
-- VIRAL TWEET LEARNING SYSTEM
-- Stores high-performing tweets from across Twitter
-- Used to train AI formatter with real-world success patterns

CREATE TABLE IF NOT EXISTS viral_tweet_library (
  id BIGSERIAL PRIMARY KEY,
  
  -- Tweet identification
  tweet_id TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  author_handle TEXT,
  
  -- Performance metrics (raw data)
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated performance metrics
  engagement_rate NUMERIC(10, 6), -- (likes + retweets + replies) / views
  viral_coefficient NUMERIC(10, 6), -- retweets / views (how viral)
  
  -- Pattern analysis
  structure TEXT CHECK (structure IN ('thread', 'single')),
  hook_type TEXT CHECK (hook_type IN ('question', 'data', 'controversy', 'story', 'statement', 'news', 'announcement')),
  formatting_patterns TEXT[] DEFAULT '{}', -- Array of patterns: bullets, line_breaks, caps, etc.
  emoji_count INTEGER DEFAULT 0,
  character_count INTEGER NOT NULL,
  has_numbers BOOLEAN DEFAULT false,
  
  -- Categorization (for filtering relevant examples)
  topic_category TEXT DEFAULT 'general', -- 'health', 'science', 'tech', 'general'
  content_type TEXT CHECK (content_type IN ('educational', 'entertainment', 'news', 'opinion', 'general')),
  
  -- Meta
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true, -- Set false for outdated trends
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_viral_engagement ON viral_tweet_library(engagement_rate DESC, views DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_viral_views ON viral_tweet_library(views DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_viral_formatting ON viral_tweet_library USING GIN(formatting_patterns) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_viral_category ON viral_tweet_library(topic_category, engagement_rate DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_viral_hook_type ON viral_tweet_library(hook_type, engagement_rate DESC) WHERE is_active = true;

-- View: Top performing patterns (for AI training)
CREATE OR REPLACE VIEW top_viral_patterns AS
SELECT 
  hook_type,
  formatting_patterns,
  topic_category,
  COUNT(*) as sample_size,
  AVG(engagement_rate) as avg_engagement,
  AVG(viral_coefficient) as avg_viral_coef,
  AVG(views) as avg_views,
  AVG(likes) as avg_likes,
  AVG(character_count) as avg_length,
  AVG(emoji_count) as avg_emojis
FROM viral_tweet_library
WHERE 
  is_active = true 
  AND views >= 50000 -- Only statistically significant
  AND engagement_rate >= 0.02 -- Min 2% engagement
GROUP BY hook_type, formatting_patterns, topic_category
HAVING COUNT(*) >= 5 -- At least 5 examples for pattern validity
ORDER BY avg_engagement DESC;

-- View: Recent top performers (for prompt examples)
CREATE OR REPLACE VIEW recent_viral_examples AS
SELECT 
  text,
  likes,
  views,
  engagement_rate,
  hook_type,
  formatting_patterns,
  character_count,
  emoji_count,
  topic_category
FROM viral_tweet_library
WHERE 
  is_active = true
  AND views >= 50000
  AND engagement_rate >= 0.03
  AND scraped_at >= NOW() - INTERVAL '30 days' -- Recent trends only
ORDER BY engagement_rate DESC
LIMIT 100;

-- Function: Mark old tweets as inactive (trends change)
CREATE OR REPLACE FUNCTION deactivate_old_viral_tweets()
RETURNS INTEGER AS $$
DECLARE
  deactivated_count INTEGER;
BEGIN
  UPDATE viral_tweet_library
  SET is_active = false
  WHERE scraped_at < NOW() - INTERVAL '90 days'
    AND is_active = true;
  
  GET DIAGNOSTICS deactivated_count = ROW_COUNT;
  RETURN deactivated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE viral_tweet_library IS 'High-performing tweets scraped from Twitter for pattern learning';
COMMENT ON COLUMN viral_tweet_library.engagement_rate IS 'Total engagements / views - primary performance metric';
COMMENT ON COLUMN viral_tweet_library.viral_coefficient IS 'Retweets / views - measures viral spread potential';
COMMENT ON COLUMN viral_tweet_library.formatting_patterns IS 'Array of detected patterns: bullets, line_breaks, caps_emphasis, etc.';
COMMENT ON VIEW top_viral_patterns IS 'Aggregated pattern performance for AI formatter training';


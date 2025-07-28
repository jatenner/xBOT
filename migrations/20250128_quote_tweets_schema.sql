-- 🎯 QUOTE TWEETS SCHEMA
-- Schema for tracking quote tweet activities

-- Quote tweets table
CREATE TABLE IF NOT EXISTS quote_tweets (
  id BIGSERIAL PRIMARY KEY,
  original_tweet_id TEXT NOT NULL,
  original_author TEXT NOT NULL,
  original_content TEXT NOT NULL,
  quote_content TEXT NOT NULL,
  original_engagement INTEGER DEFAULT 0,
  our_tweet_id TEXT,
  our_engagement INTEGER DEFAULT 0,
  quote_performance_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate quotes of same tweet
  UNIQUE(original_tweet_id)
);

-- Follower tracking table (for Phase 6)
CREATE TABLE IF NOT EXISTS follower_log (
  id BIGSERIAL PRIMARY KEY,
  follower_count INTEGER NOT NULL,
  following_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  growth_since_yesterday INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per day
  UNIQUE(DATE(recorded_at))
);

-- Bot configuration table (for Phase 4 - Multi-bot scaling)
CREATE TABLE IF NOT EXISTS bot_personas (
  id BIGSERIAL PRIMARY KEY,
  persona_name TEXT UNIQUE NOT NULL,
  tone_preferences JSONB DEFAULT '[]',
  posting_schedule JSONB DEFAULT '{}',
  content_focus JSONB DEFAULT '[]',
  max_daily_posts INTEGER DEFAULT 17,
  max_daily_replies INTEGER DEFAULT 17,
  max_daily_quotes INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  supabase_config JSONB DEFAULT '{}',
  twitter_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- GPT completion tracking (for Phase 7 - GPT Evolution)
CREATE TABLE IF NOT EXISTS gpt_completions (
  id BIGSERIAL PRIMARY KEY,
  completion_type TEXT NOT NULL, -- 'tweet', 'reply', 'quote'
  prompt_template TEXT NOT NULL,
  prompt_variables JSONB DEFAULT '{}',
  generated_content TEXT NOT NULL,
  engagement_score INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  performance_rating DECIMAL(3,2) DEFAULT 0, -- 0-5 rating
  tweet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled tweets table (for Phase 5 - Manual Override)
CREATE TABLE IF NOT EXISTS scheduled_tweets (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  tweet_type TEXT DEFAULT 'original', -- 'original', 'reply', 'quote'
  target_tweet_id TEXT, -- For replies/quotes
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'posted'
  created_by TEXT DEFAULT 'ai',
  approved_by TEXT,
  posted_tweet_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quote_tweets_created_at ON quote_tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_tweets_performance ON quote_tweets(quote_performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_follower_log_recorded_at ON follower_log(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gpt_completions_type_performance ON gpt_completions(completion_type, performance_rating DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_tweets_status_scheduled ON scheduled_tweets(status, scheduled_for);

-- Insert default bot persona
INSERT INTO bot_personas (
  persona_name,
  tone_preferences,
  posting_schedule,
  content_focus,
  max_daily_posts,
  max_daily_replies,
  max_daily_quotes
) VALUES (
  'HealthTechExpert',
  '["insightful", "engaging", "professional"]',
  '{"optimal_hours": [9, 12, 15, 18], "avoid_hours": [0, 1, 2, 3, 4, 5]}',
  '["health technology", "AI in healthcare", "medical innovation", "digital health"]',
  17,
  17,
  3
) ON CONFLICT (persona_name) DO NOTHING; 
-- 🎯 COMPLETE AUTONOMOUS TWITTER BOT SCHEMA - FULLY FIXED
-- All systems ready for deployment with proper PostgreSQL syntax
-- Run this entire script in Supabase SQL Editor

-- 1. Quote tweets table (Phase 3 - Quote Tweet Agent)
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
  CONSTRAINT unique_original_tweet_id UNIQUE(original_tweet_id)
);

-- 2. Follower tracking table (Phase 6 - Follower Tracker)
CREATE TABLE IF NOT EXISTS follower_log (
  id BIGSERIAL PRIMARY KEY,
  follower_count INTEGER NOT NULL,
  following_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  growth_since_yesterday INTEGER DEFAULT 0,
  recorded_date DATE DEFAULT CURRENT_DATE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per day using DATE column
  CONSTRAINT unique_follower_per_day UNIQUE(recorded_date)
);

-- 3. Bot configuration table (Phase 4 - Multi-bot scaling)
CREATE TABLE IF NOT EXISTS bot_personas (
  id BIGSERIAL PRIMARY KEY,
  persona_name TEXT NOT NULL,
  tone_preferences JSONB DEFAULT '[]'::jsonb,
  posting_schedule JSONB DEFAULT '{}'::jsonb,
  content_focus JSONB DEFAULT '[]'::jsonb,
  max_daily_posts INTEGER DEFAULT 17,
  max_daily_replies INTEGER DEFAULT 17,
  max_daily_quotes INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  supabase_config JSONB DEFAULT '{}'::jsonb,
  twitter_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_persona_name UNIQUE(persona_name)
);

-- 4. GPT completion tracking (Phase 7 - GPT Evolution)
CREATE TABLE IF NOT EXISTS gpt_completions (
  id BIGSERIAL PRIMARY KEY,
  completion_type TEXT NOT NULL, -- 'tweet', 'reply', 'quote'
  prompt_template TEXT NOT NULL,
  prompt_variables JSONB DEFAULT '{}'::jsonb,
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

-- 5. Scheduled tweets table (Phase 5 - Manual Override)
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

-- 6. Performance indexes for optimization
CREATE INDEX IF NOT EXISTS idx_quote_tweets_created_at ON quote_tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_tweets_performance ON quote_tweets(quote_performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_quote_tweets_author ON quote_tweets(original_author);

CREATE INDEX IF NOT EXISTS idx_follower_log_recorded_at ON follower_log(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_follower_log_date ON follower_log(recorded_date DESC);

CREATE INDEX IF NOT EXISTS idx_bot_personas_active ON bot_personas(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gpt_completions_type ON gpt_completions(completion_type);
CREATE INDEX IF NOT EXISTS idx_gpt_completions_performance ON gpt_completions(completion_type, performance_rating DESC);
CREATE INDEX IF NOT EXISTS idx_gpt_completions_created_at ON gpt_completions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_tweets_status ON scheduled_tweets(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tweets_scheduled_for ON scheduled_tweets(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_tweets_status_scheduled ON scheduled_tweets(status, scheduled_for);

-- 7. Insert default bot persona configuration
INSERT INTO bot_personas (
  persona_name,
  tone_preferences,
  posting_schedule,
  content_focus,
  max_daily_posts,
  max_daily_replies,
  max_daily_quotes,
  is_active
) VALUES (
  'HealthTechExpert',
  '["insightful", "engaging", "professional"]'::jsonb,
  '{"optimal_hours": [9, 12, 15, 18], "avoid_hours": [0, 1, 2, 3, 4, 5]}'::jsonb,
  '["health technology", "AI in healthcare", "medical innovation", "digital health"]'::jsonb,
  17,
  17,
  3,
  true
) ON CONFLICT (persona_name) DO UPDATE SET
  updated_at = NOW(),
  is_active = true;

-- 8. Create trigger functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Apply triggers to tables with updated_at columns
DO $$
BEGIN
    -- Quote tweets trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_quote_tweets_updated_at') THEN
        CREATE TRIGGER update_quote_tweets_updated_at
            BEFORE UPDATE ON quote_tweets
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Bot personas trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bot_personas_updated_at') THEN
        CREATE TRIGGER update_bot_personas_updated_at
            BEFORE UPDATE ON bot_personas
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- GPT completions trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gpt_completions_updated_at') THEN
        CREATE TRIGGER update_gpt_completions_updated_at
            BEFORE UPDATE ON gpt_completions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Scheduled tweets trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_scheduled_tweets_updated_at') THEN
        CREATE TRIGGER update_scheduled_tweets_updated_at
            BEFORE UPDATE ON scheduled_tweets
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- 10. Verification query to confirm all tables exist
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename IN ('quote_tweets', 'follower_log', 'bot_personas', 'gpt_completions', 'scheduled_tweets')
ORDER BY tablename; 
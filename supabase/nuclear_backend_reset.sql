-- 🚀 NUCLEAR BACKEND RESET
-- =========================
-- Complete fresh start - drops EVERYTHING and rebuilds

-- NUCLEAR OPTION: Drop all user tables and views
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all views
    FOR r IN (SELECT tablename FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions
    FOR r IN (SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || ' CASCADE';
    END LOOP;
END $$;

-- NOW BUILD CLEAN ESSENTIAL BACKEND

-- 1. TWEETS TABLE (Core - bot's main output)
CREATE TABLE tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id VARCHAR(50) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  tweet_type VARCHAR(50) DEFAULT 'original',
  content_type VARCHAR(50) DEFAULT 'general',
  content_category VARCHAR(50) DEFAULT 'health_tech',
  source_attribution VARCHAR(100) DEFAULT 'AI Generated',
  engagement_score INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  has_snap2health_cta BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. API USAGE TRACKING (Essential - bot self-awareness)
CREATE TABLE api_usage_tracking (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  api_type VARCHAR(50) NOT NULL,
  count INTEGER DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, api_type)
);

-- 3. BOT CONFIG (Essential settings)
CREATE TABLE bot_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_tweets_created_at ON tweets(created_at);
CREATE INDEX idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX idx_api_usage_date_api ON api_usage_tracking(date, api_type);

-- TRACKING FUNCTION
CREATE OR REPLACE FUNCTION update_api_usage_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api_usage_tracking (date, api_type, count)
  VALUES (CURRENT_DATE, 'twitter', 1)
  ON CONFLICT (date, api_type)
  DO UPDATE SET 
    count = api_usage_tracking.count + 1,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER
CREATE TRIGGER trigger_update_api_usage
  AFTER INSERT ON tweets
  FOR EACH ROW
  EXECUTE FUNCTION update_api_usage_tracking();

-- ESSENTIAL CONFIG
INSERT INTO bot_config (key, value, description) VALUES
  ('bot_enabled', 'true', 'Master bot enable/disable switch'),
  ('daily_tweet_limit', '17', 'Free tier daily tweet limit'),
  ('current_tier', 'free', 'Twitter API tier (free/paid)');

-- INITIALIZE TODAY'S TRACKING
INSERT INTO api_usage_tracking (date, api_type, count) VALUES
  (CURRENT_DATE, 'twitter', 0);

-- VERIFICATION
SELECT 'NUCLEAR RESET COMPLETE - CLEAN BACKEND READY' as status;

-- 🔧 BULLETPROOF BACKEND CLEANUP AND SETUP
-- ==========================================
-- Handles tables, views, and any database objects safely

-- STEP 1: Create essential tables first (before cleanup)
-- This ensures we have working tables even if cleanup fails

-- 1. TWEETS TABLE (Core - bot's main output)
DROP TABLE IF EXISTS tweets CASCADE;
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
DROP TABLE IF EXISTS api_usage_tracking CASCADE;
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
DROP TABLE IF EXISTS bot_config CASCADE;
CREATE TABLE bot_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- STEP 2: Create indexes
CREATE INDEX idx_tweets_created_at ON tweets(created_at);
CREATE INDEX idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX idx_api_usage_date_api ON api_usage_tracking(date, api_type);

-- STEP 3: Create tracking function
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

-- STEP 4: Create trigger
DROP TRIGGER IF EXISTS trigger_update_api_usage ON tweets;
CREATE TRIGGER trigger_update_api_usage
  AFTER INSERT ON tweets
  FOR EACH ROW
  EXECUTE FUNCTION update_api_usage_tracking();

-- STEP 5: Insert essential config
INSERT INTO bot_config (key, value, description) VALUES
  ('bot_enabled', 'true', 'Master bot enable/disable switch'),
  ('daily_tweet_limit', '17', 'Free tier daily tweet limit'),
  ('current_tier', 'free', 'Twitter API tier (free/paid)')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- STEP 6: Initialize today's tracking
INSERT INTO api_usage_tracking (date, api_type, count) VALUES
  (CURRENT_DATE, 'twitter', 0)
ON CONFLICT (date, api_type) DO NOTHING;

-- STEP 7: Safe cleanup (handles both tables and views)
-- Drop views first
DROP VIEW IF EXISTS engagement_analytics CASCADE;
DROP VIEW IF EXISTS performance_dashboard CASCADE;
DROP VIEW IF EXISTS dashboard_summary CASCADE;
DROP VIEW IF EXISTS quality_trends CASCADE;

-- Drop tables
DROP TABLE IF EXISTS ai_decisions CASCADE;
DROP TABLE IF EXISTS style_performance CASCADE;
DROP TABLE IF EXISTS timing_insights CASCADE;
DROP TABLE IF EXISTS content_themes CASCADE;
DROP TABLE IF EXISTS learning_insights CASCADE;
DROP TABLE IF EXISTS target_tweets CASCADE;
DROP TABLE IF EXISTS replies CASCADE;
DROP TABLE IF EXISTS community_engagement CASCADE;
DROP TABLE IF EXISTS content_strategies CASCADE;
DROP TABLE IF EXISTS control_flags CASCADE;
DROP TABLE IF EXISTS current_events CASCADE;
DROP TABLE IF EXISTS daily_api_stats CASCADE;
DROP TABLE IF EXISTS engagement_history CASCADE;
DROP TABLE IF EXISTS image_usage CASCADE;
DROP TABLE IF EXISTS image_usage_history CASCADE;
DROP TABLE IF EXISTS learning_feedback CASCADE;
DROP TABLE IF EXISTS media_history CASCADE;
DROP TABLE IF EXISTS mission_metrics CASCADE;
DROP TABLE IF EXISTS monthly_api_usage CASCADE;
DROP TABLE IF EXISTS news_articles CASCADE;
DROP TABLE IF EXISTS news_source_health CASCADE;
DROP TABLE IF EXISTS prompt_features CASCADE;
DROP TABLE IF EXISTS rejected_drafts CASCADE;
DROP TABLE IF EXISTS trending_topics CASCADE;
DROP TABLE IF EXISTS bot_usage_tracking CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;

-- Drop any remaining unused objects
DROP TABLE IF EXISTS zzz_content_recycling_unused CASCADE;
DROP TABLE IF EXISTS zzz_engagement_analytics_unused CASCADE;
DROP TABLE IF EXISTS zzz_replies_unused CASCADE;
DROP TABLE IF EXISTS zzz_target_tweets_unused CASCADE;

-- FINAL VERIFICATION
SELECT 
  'BACKEND CLEANUP COMPLETE' as status,
  COUNT(*) as essential_tables_created
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tweets', 'api_usage_tracking', 'bot_config'); 
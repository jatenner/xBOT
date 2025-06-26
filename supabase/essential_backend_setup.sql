-- 🔧 COMPREHENSIVE BACKEND CLEANUP AND SETUP
-- ============================================
-- Essential tables only - focused on what actually works

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
  api_type VARCHAR(50) NOT NULL, -- 'twitter', 'news_api', 'pexels', 'openai'
  count INTEGER DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, api_type)
);

-- 3. BOT USAGE TRACKING (Detailed tracking)
DROP TABLE IF EXISTS bot_usage_tracking CASCADE;
CREATE TABLE bot_usage_tracking (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL, -- 'tweet', 'news', 'image', 'openai'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  date DATE NOT NULL,
  hour INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BOT CONFIG (Essential settings)
DROP TABLE IF EXISTS bot_config CASCADE;
CREATE TABLE bot_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SYSTEM LOGS (Error tracking and debugging)
DROP TABLE IF EXISTS system_logs CASCADE;
CREATE TABLE system_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  data JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'system'
);

-- INDEXES for performance
CREATE INDEX idx_tweets_created_at ON tweets(created_at);
CREATE INDEX idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX idx_api_usage_date_api ON api_usage_tracking(date, api_type);
CREATE INDEX idx_bot_usage_action_date ON bot_usage_tracking(action, date);
CREATE INDEX idx_bot_usage_timestamp ON bot_usage_tracking(timestamp);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX idx_system_logs_action ON system_logs(action);

-- FUNCTIONS for automatic tracking
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

-- TRIGGER on tweets table
DROP TRIGGER IF EXISTS trigger_update_api_usage ON tweets;
CREATE TRIGGER trigger_update_api_usage
  AFTER INSERT ON tweets
  FOR EACH ROW
  EXECUTE FUNCTION update_api_usage_tracking();

-- ESSENTIAL BOT CONFIG DEFAULTS
INSERT INTO bot_config (key, value, description) VALUES
  ('bot_enabled', 'true', 'Master bot enable/disable switch'),
  ('daily_tweet_limit', '17', 'Free tier daily tweet limit'),
  ('news_api_daily_limit', '100', 'Free tier news API daily limit'),
  ('pexels_hourly_limit', '200', 'Free tier Pexels hourly limit'),
  ('openai_daily_cost_limit', '1.00', 'Daily OpenAI cost limit in USD'),
  ('last_reset_check', NOW()::text, 'Last time limits were reset'),
  ('current_tier', 'free', 'Twitter API tier (free/paid)')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- INITIALIZE TODAY'S TRACKING
INSERT INTO api_usage_tracking (date, api_type, count) VALUES
  (CURRENT_DATE, 'twitter', 0),
  (CURRENT_DATE, 'news_api', 0),
  (CURRENT_DATE, 'pexels', 0),
  (CURRENT_DATE, 'openai', 0)
ON CONFLICT (date, api_type) DO NOTHING;

-- LOG THE SETUP
INSERT INTO system_logs (action, data, source) VALUES
  ('backend_cleanup_complete', jsonb_build_object(
    'tables_created', 5, 
    'essential_only', true, 
    'cleanup_date', NOW()::text
  ), 'setup_script');

-- CLEANUP: Drop unused tables that are just clutter
DROP TABLE IF EXISTS ai_decisions CASCADE;
DROP TABLE IF EXISTS style_performance CASCADE;
DROP TABLE IF EXISTS timing_insights CASCADE;
DROP TABLE IF EXISTS content_themes CASCADE;
DROP TABLE IF EXISTS learning_insights CASCADE;
DROP TABLE IF EXISTS engagement_analytics CASCADE;
DROP TABLE IF EXISTS target_tweets CASCADE;
DROP TABLE IF EXISTS replies CASCADE;
DROP TABLE IF EXISTS community_engagement CASCADE;
DROP TABLE IF EXISTS content_strategies CASCADE;
DROP TABLE IF EXISTS control_flags CASCADE;
DROP TABLE IF EXISTS current_events CASCADE;
DROP TABLE IF EXISTS daily_api_stats CASCADE;
DROP TABLE IF EXISTS dashboard_summary CASCADE;
DROP TABLE IF EXISTS engagement_history CASCADE;
DROP TABLE IF EXISTS image_usage CASCADE;
DROP TABLE IF EXISTS image_usage_history CASCADE;
DROP TABLE IF EXISTS learning_feedback CASCADE;
DROP TABLE IF EXISTS media_history CASCADE;
DROP TABLE IF EXISTS mission_metrics CASCADE;
DROP TABLE IF EXISTS monthly_api_usage CASCADE;
DROP TABLE IF EXISTS news_articles CASCADE;
DROP TABLE IF EXISTS news_source_health CASCADE;
DROP TABLE IF EXISTS performance_dashboard CASCADE;
DROP TABLE IF EXISTS prompt_features CASCADE;
DROP TABLE IF EXISTS quality_trends CASCADE;
DROP TABLE IF EXISTS rejected_drafts CASCADE;
DROP TABLE IF EXISTS trending_topics CASCADE;
DROP TABLE IF EXISTS zzz_content_recycling_unused CASCADE;
DROP TABLE IF EXISTS zzz_engagement_analytics_unused CASCADE;
DROP TABLE IF EXISTS zzz_replies_unused CASCADE;
DROP TABLE IF EXISTS zzz_target_tweets_unused CASCADE;

-- SUMMARY
SELECT 
  'BACKEND CLEANUP COMPLETE' as status,
  COUNT(*) as essential_tables_created
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tweets', 'api_usage_tracking', 'bot_usage_tracking', 'bot_config', 'system_logs');
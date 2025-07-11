-- ===================================================================
-- 🚀 ROBUST ARCHITECTURE MANUAL MIGRATION
-- ===================================================================
-- Copy and paste this entire file into your Supabase SQL Editor
-- This creates all tables needed for the robust architecture upgrade
-- ===================================================================

-- 1. TWITTER RATE LIMITS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS twitter_rate_limits (
  id INTEGER PRIMARY KEY DEFAULT 1,
  tweets_3_hour_used INTEGER DEFAULT 0,
  tweets_3_hour_reset TIMESTAMPTZ,
  tweets_24_hour_used INTEGER DEFAULT 0,
  tweets_24_hour_reset TIMESTAMPTZ,
  tweets_monthly_used INTEGER DEFAULT 0,
  tweets_monthly_reset TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial row
INSERT INTO twitter_rate_limits (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. TWEET PERFORMANCE TRACKING
-- ===================================================================
CREATE TABLE IF NOT EXISTS tweet_performance (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'general',
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  quote_tweets INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  performance_score DECIMAL(5,2) DEFAULT 0,
  generation_source TEXT DEFAULT 'unknown',
  template_type TEXT DEFAULT 'standard',
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  peak_engagement_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tweet_performance_score ON tweet_performance(performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_type ON tweet_performance(content_type);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_created ON tweet_performance(created_at DESC);

-- 3. DAILY GROWTH TRACKING
-- ===================================================================
CREATE TABLE IF NOT EXISTS daily_growth (
  date DATE PRIMARY KEY,
  followers_count INTEGER NOT NULL,
  following_count INTEGER NOT NULL,
  follower_growth_rate DECIMAL(8,4) DEFAULT 0,
  engagement_rate DECIMAL(8,4) DEFAULT 0,
  reach_rate DECIMAL(8,4) DEFAULT 0,
  viral_coefficient DECIMAL(8,4) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUALITY IMPROVEMENTS TRACKING
-- ===================================================================
CREATE TABLE IF NOT EXISTS quality_improvements (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT,
  original_content TEXT NOT NULL,
  improved_content TEXT NOT NULL,
  original_score DECIMAL(5,2) NOT NULL,
  improved_score DECIMAL(5,2) NOT NULL,
  quality_gain DECIMAL(5,2) NOT NULL,
  improvement_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CACHED INSIGHTS
-- ===================================================================
CREATE TABLE IF NOT EXISTS cached_insights (
  id TEXT PRIMARY KEY,
  insights JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CONTENT TEMPLATES
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  template TEXT NOT NULL,
  performance_score DECIMAL(5,2) DEFAULT 50,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_templates_performance ON content_templates(type, performance_score DESC);

-- 7. SYSTEM LOGS
-- ===================================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  data JSONB,
  source TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);

-- 8. BUDGET TABLES (if missing)
-- ===================================================================
CREATE TABLE IF NOT EXISTS budget_transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  operation_type TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_budget_status (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
  budget_limit DECIMAL(10,2) NOT NULL DEFAULT 3.00,
  emergency_brake_active BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SEED CONTENT TEMPLATES
-- ===================================================================
INSERT INTO content_templates (id, type, template, performance_score) VALUES
  ('research_insight_1', 'research_insight', 'New study reveals: {finding}. Analysis of {sample} shows {result}.', 80),
  ('research_insight_2', 'research_insight', 'Research breakthrough: {discovery} could transform {field}. Published in {source}.', 75),
  ('breaking_news_1', 'breaking_news', 'Breaking: {headline}. {institution} announces {development}.', 85),
  ('breaking_news_2', 'breaking_news', 'Just announced: {news}. Industry implications: {impact}.', 78),
  ('expert_opinion_1', 'expert_opinion', 'Industry perspective: {opinion} based on {experience}. Key insight: {takeaway}.', 72),
  ('expert_opinion_2', 'expert_opinion', 'Expert analysis: {assessment}. Having worked with {context}, I see {trend}.', 70),
  ('analysis_1', 'analysis', 'Deep dive: {topic} analysis reveals {pattern}. Key factors: {elements}.', 68),
  ('analysis_2', 'analysis', 'Trend analysis: {observation} across {timeframe}. Implications: {meaning}.', 65),
  ('trend_discussion_1', 'trend_discussion', 'Trending: {topic} gaining momentum. Why this matters: {significance}.', 60),
  ('trend_discussion_2', 'trend_discussion', 'Hot topic: {discussion} in {field}. Community insights: {perspective}.', 58)
ON CONFLICT (id) DO UPDATE SET
  template = EXCLUDED.template,
  performance_score = EXCLUDED.performance_score,
  updated_at = NOW();

-- 10. INITIALIZE DAILY BUDGET
-- ===================================================================
INSERT INTO daily_budget_status (date, total_spent, budget_limit) 
VALUES (CURRENT_DATE, 0, 3.00) 
ON CONFLICT (date) DO UPDATE SET 
  budget_limit = 3.00;

-- 11. UPDATE EXISTING TWEETS TABLE (if columns don't exist)
-- ===================================================================
-- Note: These may fail if columns already exist - that's OK
DO $$
BEGIN
  -- Add content_quality_score if it doesn't exist
  BEGIN
    ALTER TABLE tweets ADD COLUMN content_quality_score DECIMAL(5,2);
  EXCEPTION
    WHEN duplicate_column THEN
      -- Column already exists, ignore
  END;

  -- Add generation_source if it doesn't exist
  BEGIN
    ALTER TABLE tweets ADD COLUMN generation_source TEXT DEFAULT 'legacy';
  EXCEPTION
    WHEN duplicate_column THEN
      -- Column already exists, ignore
  END;

  -- Add tweet_type if it doesn't exist
  BEGIN
    ALTER TABLE tweets ADD COLUMN tweet_type TEXT DEFAULT 'general';
  EXCEPTION
    WHEN duplicate_column THEN
      -- Column already exists, ignore
  END;
END
$$;

-- 12. LOG MIGRATION COMPLETION
-- ===================================================================
INSERT INTO system_logs (action, data, source) VALUES
('migration_applied', jsonb_build_object(
  'migration', 'MANUAL_ROBUST_ARCHITECTURE',
  'tables_created', ARRAY[
    'twitter_rate_limits',
    'tweet_performance', 
    'daily_growth',
    'quality_improvements',
    'cached_insights',
    'content_templates',
    'system_logs',
    'budget_transactions',
    'daily_budget_status'
  ],
  'enhancements_applied', ARRAY[
    'unified_budget_system',
    'simplified_rate_limits',
    'engagement_tracking',
    'quality_assurance',
    'smart_content_engine'
  ],
  'timestamp', NOW()::text
), 'manual_migration');

-- SUCCESS MESSAGE
SELECT 'Robust Architecture Migration Complete! 🚀' as status, 
       '9 tables created, 10 templates seeded, budget system initialized' as details; 
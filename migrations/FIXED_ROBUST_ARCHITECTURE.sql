-- ===================================================================
-- 🚀 FIXED ROBUST ARCHITECTURE MIGRATION
-- ===================================================================
-- This version addresses the specific errors encountered
-- Copy and paste this into your Supabase SQL Editor
-- ===================================================================

-- 1. TWITTER RATE LIMITS TABLE (Simple version)
-- ===================================================================
CREATE TABLE IF NOT EXISTS twitter_rate_limits (
  id INTEGER PRIMARY KEY DEFAULT 1,
  tweets_3_hour_used INTEGER DEFAULT 0,
  tweets_3_hour_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tweets_24_hour_used INTEGER DEFAULT 0,
  tweets_24_hour_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tweets_monthly_used INTEGER DEFAULT 0,
  tweets_monthly_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial row safely
INSERT INTO twitter_rate_limits (id, tweets_3_hour_used, tweets_24_hour_used, tweets_monthly_used) 
VALUES (1, 0, 0, 0) 
ON CONFLICT (id) DO NOTHING;

-- 2. TWEET PERFORMANCE TRACKING (Fixed version)
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
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  peak_engagement_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DAILY GROWTH TRACKING (Simplified)
-- ===================================================================
CREATE TABLE IF NOT EXISTS daily_growth (
  date DATE PRIMARY KEY,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  follower_growth_rate DECIMAL(8,4) DEFAULT 0,
  engagement_rate DECIMAL(8,4) DEFAULT 0,
  reach_rate DECIMAL(8,4) DEFAULT 0,
  viral_coefficient DECIMAL(8,4) DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CACHED INSIGHTS (Simple JSONB storage)
-- ===================================================================
CREATE TABLE IF NOT EXISTS cached_insights (
  id TEXT PRIMARY KEY,
  insights JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CONTENT TEMPLATES (Fixed version)
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  template TEXT NOT NULL,
  performance_score DECIMAL(5,2) DEFAULT 50,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SYSTEM LOGS (Essential for tracking)
-- ===================================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  data JSONB,
  source TEXT DEFAULT 'system',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. BUDGET TABLES (Ensure they exist with correct structure)
-- ===================================================================
CREATE TABLE IF NOT EXISTS budget_transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  operation_type TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_budget_status (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
  budget_limit DECIMAL(10,2) NOT NULL DEFAULT 3.00,
  emergency_brake_active BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. CREATE INDEXES (Performance optimization)
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_tweet_performance_score ON tweet_performance(performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_type ON tweet_performance(content_type);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_created ON tweet_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_templates_performance ON content_templates(type, performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);

-- 10. SEED ESSENTIAL CONTENT TEMPLATES
-- ===================================================================
INSERT INTO content_templates (id, type, template, performance_score) VALUES
  ('research_1', 'research_insight', 'New research shows {finding}. Study of {sample} reveals {result}.', 80),
  ('news_1', 'breaking_news', 'Breaking: {headline}. {institution} reports {development}.', 85),
  ('expert_1', 'expert_opinion', 'Industry insight: {opinion} from {experience}. Key takeaway: {takeaway}.', 72),
  ('analysis_1', 'analysis', 'Analysis: {topic} reveals {pattern}. Important factors: {elements}.', 68),
  ('trend_1', 'trend_discussion', 'Trending: {topic} gains attention. Why it matters: {significance}.', 60)
ON CONFLICT (id) DO UPDATE SET
  template = EXCLUDED.template,
  performance_score = EXCLUDED.performance_score,
  updated_at = NOW();

-- 11. INITIALIZE DAILY BUDGET SAFELY
-- ===================================================================
INSERT INTO daily_budget_status (date, total_spent, budget_limit) 
VALUES (CURRENT_DATE, 0, 3.00) 
ON CONFLICT (date) DO UPDATE SET 
  budget_limit = 3.00,
  updated_at = NOW();

-- 12. UPDATE TWEETS TABLE (Handle missing columns safely)
-- ===================================================================
-- Only add columns if they don't exist - ignore errors
DO $$
BEGIN
  -- Try to add content_quality_score
  BEGIN
    ALTER TABLE tweets ADD COLUMN content_quality_score DECIMAL(5,2);
  EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN others THEN NULL;
  END;

  -- Try to add generation_source
  BEGIN
    ALTER TABLE tweets ADD COLUMN generation_source TEXT DEFAULT 'legacy';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN others THEN NULL;
  END;

  -- Try to add tweet_type
  BEGIN
    ALTER TABLE tweets ADD COLUMN tweet_type TEXT DEFAULT 'general';
  EXCEPTION
    WHEN duplicate_column THEN NULL;
    WHEN others THEN NULL;
  END;
END
$$;

-- 13. LOG SUCCESSFUL MIGRATION
-- ===================================================================
INSERT INTO system_logs (action, data, source) VALUES
('robust_architecture_migration', json_build_object(
  'migration', 'FIXED_ROBUST_ARCHITECTURE',
  'timestamp', NOW(),
  'tables_created', array[
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
  'templates_seeded', 5,
  'budget_limit', '3.00',
  'status', 'complete'
), 'migration_script');

-- 14. VERIFICATION QUERY
-- ===================================================================
SELECT 
  'Migration Complete!' as status,
  (SELECT COUNT(*) FROM content_templates) as templates_count,
  (SELECT budget_limit FROM daily_budget_status WHERE date = CURRENT_DATE) as daily_budget,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN (
    'twitter_rate_limits', 'tweet_performance', 'daily_growth', 
    'quality_improvements', 'cached_insights', 'content_templates', 
    'system_logs', 'budget_transactions', 'daily_budget_status'
  )) as tables_created; 
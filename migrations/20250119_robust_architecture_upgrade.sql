-- 🚀 ROBUST ARCHITECTURE UPGRADE MIGRATION
-- Adds database support for new unified systems
-- Date: 2025-01-19

-- ============================================================================
-- 1. TWITTER RATE LIMITS TABLE
-- ============================================================================
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

-- Ensure only one row exists
INSERT INTO twitter_rate_limits (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. TWEET PERFORMANCE TRACKING (Enhanced)
-- ============================================================================
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
  generation_source TEXT DEFAULT 'unknown', -- 'ai', 'template', 'rule-based'
  template_type TEXT DEFAULT 'standard',
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  peak_engagement_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_performance_score ON tweet_performance(performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_type ON tweet_performance(content_type);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_created ON tweet_performance(created_at DESC);

-- ============================================================================
-- 3. DAILY GROWTH TRACKING
-- ============================================================================
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

-- ============================================================================
-- 4. QUALITY IMPROVEMENTS TRACKING
-- ============================================================================
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

-- ============================================================================
-- 5. CACHED INSIGHTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS cached_insights (
  id TEXT PRIMARY KEY,
  insights JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. CONTENT TEMPLATES (For Smart Content Engine)
-- ============================================================================
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

-- Index for template performance
CREATE INDEX IF NOT EXISTS idx_content_templates_performance ON content_templates(type, performance_score DESC);

-- ============================================================================
-- 7. SEED INITIAL CONTENT TEMPLATES
-- ============================================================================
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

-- ============================================================================
-- 8. UPDATE EXISTING BUDGET TABLES (If they don't have proper structure)
-- ============================================================================
-- Ensure budget_transactions has the right structure
DO $$
BEGIN
  -- Check if budget_transactions exists, if not create it
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'budget_transactions') THEN
    CREATE TABLE budget_transactions (
      id BIGSERIAL PRIMARY KEY,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      operation_type TEXT NOT NULL,
      model TEXT DEFAULT 'gpt-4o-mini',
      tokens_used INTEGER DEFAULT 0,
      cost_usd DECIMAL(10,6) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;

  -- Check if daily_budget_status exists, if not create it
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_budget_status') THEN
    CREATE TABLE daily_budget_status (
      date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
      total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
      budget_limit DECIMAL(10,2) NOT NULL DEFAULT 3.00,
      emergency_brake_active BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END
$$;

-- ============================================================================
-- 9. UPDATE EXISTING TWEETS TABLE (Add new columns if missing)
-- ============================================================================
DO $$
BEGIN
  -- Add content_quality_score if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tweets' AND column_name = 'content_quality_score') THEN
    ALTER TABLE tweets ADD COLUMN content_quality_score DECIMAL(5,2);
  END IF;

  -- Add generation_source if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tweets' AND column_name = 'generation_source') THEN
    ALTER TABLE tweets ADD COLUMN generation_source TEXT DEFAULT 'legacy';
  END IF;

  -- Add tweet_type if it doesn't exist (might be called something else)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tweets' AND column_name = 'tweet_type') THEN
    ALTER TABLE tweets ADD COLUMN tweet_type TEXT DEFAULT 'general';
  END IF;
END
$$;

-- ============================================================================
-- 10. INSERT INITIAL DAILY BUDGET RECORD
-- ============================================================================
INSERT INTO daily_budget_status (date, total_spent, budget_limit) 
VALUES (CURRENT_DATE, 0, 3.00) 
ON CONFLICT (date) DO UPDATE SET 
  budget_limit = 3.00;

-- ============================================================================
-- 11. SYSTEM LOGS TABLE (For tracking system events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  data JSONB,
  source TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for recent logs
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);

-- ============================================================================
-- 12. FUNCTIONS FOR AUTOMATED MAINTENANCE
-- ============================================================================

-- Function to clean old performance data (keep last 3 months)
CREATE OR REPLACE FUNCTION cleanup_old_performance_data()
RETURNS void AS $$
BEGIN
  DELETE FROM tweet_performance 
  WHERE created_at < NOW() - INTERVAL '3 months';
  
  DELETE FROM quality_improvements 
  WHERE created_at < NOW() - INTERVAL '3 months';
  
  DELETE FROM system_logs 
  WHERE created_at < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Function to update template performance scores
CREATE OR REPLACE FUNCTION update_template_performance()
RETURNS void AS $$
BEGIN
  UPDATE content_templates 
  SET performance_score = (
    SELECT AVG(tp.performance_score)
    FROM tweet_performance tp 
    WHERE tp.template_type = content_templates.id
    AND tp.created_at > NOW() - INTERVAL '30 days'
  )
  WHERE id IN (
    SELECT DISTINCT template_type 
    FROM tweet_performance 
    WHERE template_type IS NOT NULL
    AND created_at > NOW() - INTERVAL '30 days'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. LOG MIGRATION COMPLETION
-- ============================================================================
INSERT INTO system_logs (action, data, source) VALUES
('migration_applied', jsonb_build_object(
  'migration', '20250119_robust_architecture_upgrade',
  'tables_created', ARRAY[
    'twitter_rate_limits',
    'tweet_performance', 
    'daily_growth',
    'quality_improvements',
    'cached_insights',
    'content_templates',
    'system_logs'
  ],
  'enhancements_applied', ARRAY[
    'unified_budget_system',
    'simplified_rate_limits',
    'engagement_tracking',
    'quality_assurance',
    'smart_content_engine'
  ],
  'timestamp', NOW()::text
), 'migration');

-- Final success message
SELECT 'Robust Architecture Upgrade Migration Complete! 🚀' as status; 
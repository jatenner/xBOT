-- 🎯 PERFECT VIRAL GROWTH SQL - MATCHES EXISTING STRUCTURE
-- ========================================================
-- This perfectly matches your existing database patterns and naming conventions
-- Run this in your Supabase SQL Editor

-- Enable required extensions (standard across your migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. VIRAL PREDICTIONS TABLE - Matches your learning_posts pattern
-- ===================================================================
CREATE TABLE IF NOT EXISTS viral_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id VARCHAR(255) NOT NULL,
  predicted_engagement NUMERIC(6,4) DEFAULT 0,
  predicted_topic_performance VARCHAR(100),
  optimal_timing_confidence NUMERIC(4,3) DEFAULT 0,
  ai_reasoning TEXT,
  actual_engagement NUMERIC(6,4) DEFAULT 0,
  prediction_accuracy NUMERIC(4,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes following your existing pattern
CREATE INDEX IF NOT EXISTS idx_viral_predictions_tweet_id ON viral_predictions (tweet_id);
CREATE INDEX IF NOT EXISTS idx_viral_predictions_created_at ON viral_predictions (created_at DESC);

-- ===================================================================
-- 2. DAILY OPTIMIZATION REPORTS - Matches your reporting pattern
-- ===================================================================
CREATE TABLE IF NOT EXISTS daily_optimization_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  follower_growth INTEGER DEFAULT 0,
  engagement_rate NUMERIC(6,4) DEFAULT 0,
  viral_tweets INTEGER DEFAULT 0,
  top_topics TEXT[] DEFAULT '{}',
  strategic_changes JSONB DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  confidence_score NUMERIC(4,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on date (standard pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_optimization_reports (report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at ON daily_optimization_reports (created_at DESC);

-- ===================================================================
-- 3. VIRAL GROWTH METRICS - Matches your metrics tables pattern
-- ===================================================================
CREATE TABLE IF NOT EXISTS viral_growth_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  follower_growth_24h INTEGER DEFAULT 0,
  engagement_rate NUMERIC(6,4) DEFAULT 0,
  posts_today INTEGER DEFAULT 0,
  viral_hits INTEGER DEFAULT 0,
  ai_optimization_score INTEGER DEFAULT 0,
  budget_efficiency NUMERIC(4,3) DEFAULT 0,
  system_health VARCHAR(20) DEFAULT 'good',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standard date-based indexing
CREATE UNIQUE INDEX IF NOT EXISTS idx_viral_metrics_date ON viral_growth_metrics (metric_date);
CREATE INDEX IF NOT EXISTS idx_viral_metrics_created_at ON viral_growth_metrics (created_at DESC);

-- ===================================================================
-- 4. INFLUENCER ENGAGEMENT TRACKING - Matches engagement_history pattern
-- ===================================================================
CREATE TABLE IF NOT EXISTS influencer_engagement_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_username VARCHAR(100) NOT NULL,
  engagement_type VARCHAR(20) NOT NULL,
  target_tweet_id VARCHAR(255),
  our_action_id VARCHAR(255),
  followback_achieved BOOLEAN DEFAULT FALSE,
  engagement_generated INTEGER DEFAULT 0,
  roi_score NUMERIC(6,4) DEFAULT 0,
  action_date TIMESTAMPTZ DEFAULT NOW(),
  followback_date TIMESTAMPTZ,
  notes TEXT
);

-- Performance indexes following your pattern
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_username ON influencer_engagement_tracking (influencer_username);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_type ON influencer_engagement_tracking (engagement_type);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_date ON influencer_engagement_tracking (action_date DESC);

-- ===================================================================
-- 5. CONTENT VIRAL ANALYSIS - Matches tweet_performance_analysis pattern
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_viral_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50),
  hook_type VARCHAR(50),
  topic_category VARCHAR(100),
  predicted_viral_score INTEGER DEFAULT 0,
  actual_viral_score INTEGER DEFAULT 0,
  viral_factors JSONB DEFAULT '{}',
  engagement_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);

-- Standard content analysis indexes
CREATE INDEX IF NOT EXISTS idx_viral_analysis_tweet_id ON content_viral_analysis (tweet_id);
CREATE INDEX IF NOT EXISTS idx_viral_analysis_content_type ON content_viral_analysis (content_type);
CREATE INDEX IF NOT EXISTS idx_viral_analysis_viral_score ON content_viral_analysis (actual_viral_score DESC);

-- ===================================================================
-- 6. ESSENTIAL FUNCTION - Simplified and Safe
-- ===================================================================
CREATE OR REPLACE FUNCTION update_daily_viral_metrics()
RETURNS VOID AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  posts_count INTEGER := 0;
  viral_count INTEGER := 0;
  avg_engagement NUMERIC := 0;
BEGIN
  -- Safely get posts count
  BEGIN
    SELECT COUNT(*) INTO posts_count
    FROM tweets 
    WHERE DATE(created_at) = today_date;
  EXCEPTION WHEN OTHERS THEN
    posts_count := 0;
  END;
  
  -- Safely get viral count
  BEGIN
    SELECT COUNT(*) INTO viral_count
    FROM content_viral_analysis 
    WHERE DATE(created_at) = today_date AND actual_viral_score > 75;
  EXCEPTION WHEN OTHERS THEN
    viral_count := 0;
  END;
  
  -- Safely get average engagement
  BEGIN
    SELECT COALESCE(AVG(engagement_rate), 0) INTO avg_engagement
    FROM tweet_performance_analysis 
    WHERE DATE(posting_time) = today_date;
  EXCEPTION WHEN OTHERS THEN
    avg_engagement := 0;
  END;
  
  -- Update metrics (upsert pattern)
  INSERT INTO viral_growth_metrics (
    metric_date, posts_today, viral_hits, engagement_rate, created_at
  ) VALUES (
    today_date, posts_count, viral_count, avg_engagement, NOW()
  )
  ON CONFLICT (metric_date) 
  DO UPDATE SET
    posts_today = EXCLUDED.posts_today,
    viral_hits = EXCLUDED.viral_hits,
    engagement_rate = EXCLUDED.engagement_rate,
    created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 7. VIRAL GROWTH DASHBOARD VIEW - Simple and Safe
-- ===================================================================
CREATE OR REPLACE VIEW viral_growth_dashboard AS
SELECT 
  vm.metric_date,
  vm.follower_growth_24h,
  vm.engagement_rate,
  vm.posts_today,
  vm.viral_hits,
  vm.system_health,
  vm.created_at
FROM viral_growth_metrics vm
ORDER BY vm.metric_date DESC;

-- ===================================================================
-- 8. RECORD MIGRATION - EXACT STRUCTURE MATCH
-- ===================================================================
INSERT INTO migration_history (filename, applied_at)
VALUES ('PERFECT_VIRAL_GROWTH.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

-- ===================================================================
-- 9. VALIDATION TEST - Minimal and Safe
-- ===================================================================
DO $$
DECLARE
  test_tweet_id TEXT := 'test_' || EXTRACT(EPOCH FROM NOW());
  tables_created INTEGER := 0;
BEGIN
  -- Count created tables
  SELECT COUNT(*) INTO tables_created
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN (
      'viral_predictions',
      'daily_optimization_reports', 
      'viral_growth_metrics',
      'influencer_engagement_tracking',
      'content_viral_analysis'
    );
  
  IF tables_created = 5 THEN
    RAISE NOTICE '✅ VIRAL GROWTH SYSTEM: Successfully created % tables', tables_created;
    
    -- Test one simple insert
    INSERT INTO viral_predictions (tweet_id, predicted_engagement) 
    VALUES (test_tweet_id, 0.25);
    
    -- Clean up test
    DELETE FROM viral_predictions WHERE tweet_id = test_tweet_id;
    
    RAISE NOTICE '✅ VIRAL GROWTH SYSTEM: Database operations working correctly';
    RAISE NOTICE '🚀 VIRAL GROWTH SYSTEM: Ready for deployment!';
  ELSE
    RAISE NOTICE '⚠️  VIRAL GROWTH SYSTEM: Only % of 5 tables created', tables_created;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ VIRAL GROWTH SYSTEM: Setup error - %', SQLERRM;
END $$;
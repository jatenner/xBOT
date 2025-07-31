-- 🚀 VIRAL GROWTH INFRASTRUCTURE FIX
-- ===================================
-- Fixes the viral growth infrastructure SQL migration
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. VIRAL PREDICTIONS TABLE (AI Performance Prediction)
-- ===================================================================
CREATE TABLE IF NOT EXISTS viral_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Drop existing indexes if they exist and recreate
DROP INDEX IF EXISTS idx_viral_predictions_tweet_id;
DROP INDEX IF EXISTS idx_viral_predictions_created_at;
DROP INDEX IF EXISTS idx_viral_predictions_accuracy;

CREATE INDEX idx_viral_predictions_tweet_id ON viral_predictions (tweet_id);
CREATE INDEX idx_viral_predictions_created_at ON viral_predictions (created_at DESC);
CREATE INDEX idx_viral_predictions_accuracy ON viral_predictions (prediction_accuracy DESC);

-- ===================================================================
-- 2. DAILY OPTIMIZATION REPORTS TABLE (AI Learning Reports)
-- ===================================================================
CREATE TABLE IF NOT EXISTS daily_optimization_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  optimization_date DATE NOT NULL,
  follower_growth INTEGER DEFAULT 0,
  engagement_rate NUMERIC(6,4) DEFAULT 0,
  viral_tweets INTEGER DEFAULT 0,
  top_topics TEXT[] DEFAULT '{}',
  strategic_changes JSONB DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  confidence_score NUMERIC(4,3) DEFAULT 0,
  impact_prediction JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing indexes if they exist and recreate
DROP INDEX IF EXISTS idx_daily_reports_date;
DROP INDEX IF EXISTS idx_daily_reports_created_at;
DROP INDEX IF EXISTS idx_daily_reports_confidence;

CREATE UNIQUE INDEX idx_daily_reports_date ON daily_optimization_reports (optimization_date);
CREATE INDEX idx_daily_reports_created_at ON daily_optimization_reports (created_at DESC);
CREATE INDEX idx_daily_reports_confidence ON daily_optimization_reports (confidence_score DESC);

-- ===================================================================
-- 3. VIRAL GROWTH METRICS TABLE (Real-time Performance Tracking)
-- ===================================================================
CREATE TABLE IF NOT EXISTS viral_growth_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL,
  follower_growth_24h INTEGER DEFAULT 0,
  engagement_rate NUMERIC(6,4) DEFAULT 0,
  posts_today INTEGER DEFAULT 0,
  viral_hits INTEGER DEFAULT 0,
  ai_optimization_score INTEGER DEFAULT 0,
  budget_efficiency NUMERIC(4,3) DEFAULT 0,
  system_health VARCHAR(20) DEFAULT 'good',
  top_performing_content TEXT,
  best_posting_times INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing indexes if they exist and recreate
DROP INDEX IF EXISTS idx_viral_metrics_date;
DROP INDEX IF EXISTS idx_viral_metrics_created_at;
DROP INDEX IF EXISTS idx_viral_metrics_health;

CREATE UNIQUE INDEX idx_viral_metrics_date ON viral_growth_metrics (metric_date);
CREATE INDEX idx_viral_metrics_created_at ON viral_growth_metrics (created_at DESC);
CREATE INDEX idx_viral_metrics_health ON viral_growth_metrics (system_health);

-- ===================================================================
-- 4. INFLUENCER ENGAGEMENT TRACKING (ROI Analysis)
-- ===================================================================
CREATE TABLE IF NOT EXISTS influencer_engagement_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Drop existing indexes if they exist and recreate
DROP INDEX IF EXISTS idx_influencer_tracking_username;
DROP INDEX IF EXISTS idx_influencer_tracking_type;
DROP INDEX IF EXISTS idx_influencer_tracking_roi;
DROP INDEX IF EXISTS idx_influencer_tracking_date;

CREATE INDEX idx_influencer_tracking_username ON influencer_engagement_tracking (influencer_username);
CREATE INDEX idx_influencer_tracking_type ON influencer_engagement_tracking (engagement_type);
CREATE INDEX idx_influencer_tracking_roi ON influencer_engagement_tracking (roi_score DESC);
CREATE INDEX idx_influencer_tracking_date ON influencer_engagement_tracking (action_date DESC);

-- ===================================================================
-- 5. CONTENT VIRAL ANALYSIS (ML Training Data)
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_viral_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50),
  hook_type VARCHAR(50),
  topic_category VARCHAR(100),
  predicted_viral_score INTEGER DEFAULT 0,
  actual_viral_score INTEGER DEFAULT 0,
  viral_factors JSONB DEFAULT '{}',
  engagement_breakdown JSONB DEFAULT '{}',
  audience_response_sentiment VARCHAR(20),
  time_to_viral_hours INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);

-- Drop existing indexes if they exist and recreate
DROP INDEX IF EXISTS idx_viral_analysis_tweet_id;
DROP INDEX IF EXISTS idx_viral_analysis_content_type;
DROP INDEX IF EXISTS idx_viral_analysis_viral_score;
DROP INDEX IF EXISTS idx_viral_analysis_topic;

CREATE INDEX idx_viral_analysis_tweet_id ON content_viral_analysis (tweet_id);
CREATE INDEX idx_viral_analysis_content_type ON content_viral_analysis (content_type);
CREATE INDEX idx_viral_analysis_viral_score ON content_viral_analysis (actual_viral_score DESC);
CREATE INDEX idx_viral_analysis_topic ON content_viral_analysis (topic_category);

-- ===================================================================
-- 6. ESSENTIAL FUNCTIONS ONLY (Simplified)
-- ===================================================================

-- Function to update daily viral metrics
CREATE OR REPLACE FUNCTION update_daily_viral_metrics()
RETURNS VOID AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  posts_count INTEGER;
  viral_count INTEGER;
  avg_engagement NUMERIC;
BEGIN
  -- Calculate today's metrics
  SELECT COUNT(*) INTO posts_count
  FROM tweets 
  WHERE DATE(created_at) = today_date;
  
  SELECT COUNT(*) INTO viral_count
  FROM content_viral_analysis 
  WHERE DATE(created_at) = today_date AND actual_viral_score > 75;
  
  SELECT AVG(engagement_rate) INTO avg_engagement
  FROM tweet_performance_analysis 
  WHERE DATE(posting_time) = today_date;
  
  -- Upsert the metrics
  INSERT INTO viral_growth_metrics (
    metric_date, posts_today, viral_hits, engagement_rate, created_at
  ) VALUES (
    today_date, posts_count, viral_count, COALESCE(avg_engagement, 0), NOW()
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
-- 7. CREATE ESSENTIAL VIEW
-- ===================================================================

-- Create a view for viral growth dashboard
CREATE OR REPLACE VIEW viral_growth_dashboard AS
SELECT 
  vm.metric_date,
  vm.follower_growth_24h,
  vm.engagement_rate,
  vm.posts_today,
  vm.viral_hits,
  vm.system_health,
  (SELECT COUNT(*) FROM tweets WHERE DATE(created_at) = vm.metric_date) as actual_posts,
  (SELECT AVG(prediction_accuracy) FROM viral_predictions WHERE DATE(created_at) = vm.metric_date) as ai_accuracy,
  (SELECT COUNT(*) FROM influencer_engagement_tracking WHERE DATE(action_date) = vm.metric_date) as engagement_actions
FROM viral_growth_metrics vm
ORDER BY vm.metric_date DESC;

-- Update migration history
INSERT INTO migration_history (filename, applied_at, notes)
VALUES (
  'VIRAL_GROWTH_SQL_FIX.sql',
  NOW(),
  'Fixed viral growth infrastructure: cleaned up indexes and simplified functions.'
) ON CONFLICT (filename) DO NOTHING;

-- Test the tables
DO $$
BEGIN
  RAISE NOTICE 'Testing viral growth tables...';
  
  -- Test insert into viral_predictions
  INSERT INTO viral_predictions (tweet_id, predicted_engagement) 
  VALUES ('test_' || EXTRACT(EPOCH FROM NOW()), 0.25);
  
  -- Test insert into viral_growth_metrics
  INSERT INTO viral_growth_metrics (metric_date, posts_today) 
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (metric_date) DO UPDATE SET posts_today = viral_growth_metrics.posts_today + 1;
  
  RAISE NOTICE 'Viral Growth Infrastructure setup completed successfully!';
  RAISE NOTICE 'Tables: viral_predictions, daily_optimization_reports, viral_growth_metrics, influencer_engagement_tracking, content_viral_analysis';
  RAISE NOTICE 'View: viral_growth_dashboard';
  RAISE NOTICE 'Function: update_daily_viral_metrics()';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Viral growth setup failed: %', SQLERRM;
END $$;
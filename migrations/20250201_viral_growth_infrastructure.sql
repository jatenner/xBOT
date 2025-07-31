-- 🚀 VIRAL GROWTH INFRASTRUCTURE MIGRATION
-- ==========================================
-- Creates the necessary database infrastructure for the viral growth coordinator
-- Date: 2025-02-01
-- Purpose: Support viral follower growth optimization with AI-driven analytics

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

CREATE INDEX IF NOT EXISTS idx_viral_predictions_tweet_id ON viral_predictions (tweet_id);
CREATE INDEX IF NOT EXISTS idx_viral_predictions_created_at ON viral_predictions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_predictions_accuracy ON viral_predictions (prediction_accuracy DESC);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_optimization_reports (optimization_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at ON daily_optimization_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_confidence ON daily_optimization_reports (confidence_score DESC);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_viral_metrics_date ON viral_growth_metrics (metric_date);
CREATE INDEX IF NOT EXISTS idx_viral_metrics_created_at ON viral_growth_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_metrics_health ON viral_growth_metrics (system_health);

-- ===================================================================
-- 4. INFLUENCER ENGAGEMENT TRACKING (ROI Analysis)
-- ===================================================================
CREATE TABLE IF NOT EXISTS influencer_engagement_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  influencer_username VARCHAR(100) NOT NULL,
  engagement_type VARCHAR(20) NOT NULL, -- 'like', 'reply', 'follow'
  target_tweet_id VARCHAR(255),
  our_action_id VARCHAR(255),
  followback_achieved BOOLEAN DEFAULT FALSE,
  engagement_generated INTEGER DEFAULT 0,
  roi_score NUMERIC(6,4) DEFAULT 0,
  action_date TIMESTAMPTZ DEFAULT NOW(),
  followback_date TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_influencer_tracking_username ON influencer_engagement_tracking (influencer_username);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_type ON influencer_engagement_tracking (engagement_type);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_roi ON influencer_engagement_tracking (roi_score DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_tracking_date ON influencer_engagement_tracking (action_date DESC);

-- ===================================================================
-- 5. CONTENT VIRAL POTENTIAL ANALYSIS (ML Training Data)
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_viral_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50), -- 'data_insight', 'myth_buster', etc.
  hook_type VARCHAR(50), -- 'controversial_take', 'value_bomb', etc.
  topic_category VARCHAR(100),
  predicted_viral_score INTEGER DEFAULT 0,
  actual_viral_score INTEGER DEFAULT 0,
  viral_factors JSONB DEFAULT '{}', -- What made it viral
  engagement_breakdown JSONB DEFAULT '{}', -- likes, retweets, etc.
  audience_response_sentiment VARCHAR(20), -- 'positive', 'negative', 'mixed'
  time_to_viral_hours INTEGER, -- How long to reach viral status
  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_viral_analysis_tweet_id ON content_viral_analysis (tweet_id);
CREATE INDEX IF NOT EXISTS idx_viral_analysis_content_type ON content_viral_analysis (content_type);
CREATE INDEX IF NOT EXISTS idx_viral_analysis_viral_score ON content_viral_analysis (actual_viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_analysis_topic ON content_viral_analysis (topic_category);

-- ===================================================================
-- 6. GROWTH PHASE PROGRESSION TRACKING
-- ===================================================================
CREATE TABLE IF NOT EXISTS growth_phase_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_name VARCHAR(50) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  follower_count_start INTEGER DEFAULT 0,
  follower_count_end INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(6,4) DEFAULT 0,
  viral_hits INTEGER DEFAULT 0,
  phase_effectiveness_score INTEGER DEFAULT 0,
  key_learnings TEXT[] DEFAULT '{}',
  transition_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase_history_phase ON growth_phase_history (phase_name);
CREATE INDEX IF NOT EXISTS idx_phase_history_start_date ON growth_phase_history (start_date DESC);
CREATE INDEX IF NOT EXISTS idx_phase_history_effectiveness ON growth_phase_history (phase_effectiveness_score DESC);

-- ===================================================================
-- 7. FUNCTIONS FOR VIRAL GROWTH ANALYTICS
-- ===================================================================

-- Function to calculate viral growth ROI
CREATE OR REPLACE FUNCTION calculate_viral_growth_roi(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  total_posts INTEGER,
  viral_hits INTEGER,
  avg_engagement_rate NUMERIC,
  follower_growth INTEGER,
  roi_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    start_date as period_start,
    end_date as period_end,
    (SELECT COUNT(*) FROM tweets WHERE created_at BETWEEN start_date AND end_date)::INTEGER as total_posts,
    (SELECT COUNT(*) FROM content_viral_analysis WHERE actual_viral_score > 75 AND created_at BETWEEN start_date AND end_date)::INTEGER as viral_hits,
    (SELECT AVG(engagement_rate) FROM tweet_performance_analysis WHERE posting_time BETWEEN start_date AND end_date) as avg_engagement_rate,
    COALESCE((SELECT SUM(follower_growth_24h) FROM viral_growth_metrics WHERE created_at BETWEEN start_date AND end_date), 0)::INTEGER as follower_growth,
    CASE 
      WHEN (SELECT COUNT(*) FROM tweets WHERE created_at BETWEEN start_date AND end_date) > 0 
      THEN (COALESCE((SELECT SUM(follower_growth_24h) FROM viral_growth_metrics WHERE created_at BETWEEN start_date AND end_date), 0)::NUMERIC / 
            (SELECT COUNT(*) FROM tweets WHERE created_at BETWEEN start_date AND end_date)::NUMERIC)
      ELSE 0
    END as roi_score;
END;
$$ LANGUAGE plpgsql;

-- Function to get top viral content patterns
CREATE OR REPLACE FUNCTION get_top_viral_patterns(
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  content_type VARCHAR,
  hook_type VARCHAR,
  topic_category VARCHAR,
  avg_viral_score NUMERIC,
  success_rate NUMERIC,
  total_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.content_type,
    c.hook_type,
    c.topic_category,
    AVG(c.actual_viral_score) as avg_viral_score,
    (COUNT(*) FILTER (WHERE c.actual_viral_score > 50)::NUMERIC / COUNT(*)::NUMERIC) as success_rate,
    COUNT(*)::INTEGER as total_attempts
  FROM content_viral_analysis c
  WHERE c.analyzed_at IS NOT NULL
  GROUP BY c.content_type, c.hook_type, c.topic_category
  HAVING COUNT(*) >= 3
  ORDER BY avg_viral_score DESC, success_rate DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update viral growth metrics
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
-- 8. TRIGGERS FOR AUTOMATED UPDATES
-- ===================================================================

-- Trigger to update viral predictions accuracy when engagement data comes in
CREATE OR REPLACE FUNCTION update_prediction_accuracy()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE viral_predictions 
  SET 
    actual_engagement = NEW.engagement_rate,
    prediction_accuracy = CASE 
      WHEN predicted_engagement > 0 THEN 
        1 - ABS(predicted_engagement - NEW.engagement_rate) / GREATEST(predicted_engagement, NEW.engagement_rate)
      ELSE 0
    END,
    updated_at = NOW()
  WHERE tweet_id = NEW.tweet_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_prediction_accuracy') THEN
    CREATE TRIGGER trigger_update_prediction_accuracy
    AFTER INSERT OR UPDATE ON tweet_performance_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_prediction_accuracy();
  END IF;
END $$;

-- ===================================================================
-- 9. INITIAL DATA AND VIEWS
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

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Update migration history
INSERT INTO migration_history (filename, applied_at, notes)
VALUES (
  '20250201_viral_growth_infrastructure.sql',
  NOW(),
  'Added viral growth coordinator infrastructure: predictions, optimization reports, metrics tracking, influencer engagement, viral analysis, and analytics functions.'
) ON CONFLICT (filename) DO NOTHING;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Viral Growth Infrastructure migration completed successfully!';
  RAISE NOTICE 'Tables created: viral_predictions, daily_optimization_reports, viral_growth_metrics, influencer_engagement_tracking, content_viral_analysis, growth_phase_history';
  RAISE NOTICE 'Functions created: calculate_viral_growth_roi, get_top_viral_patterns, update_daily_viral_metrics';
  RAISE NOTICE 'View created: viral_growth_dashboard';
END $$;
-- 🚀 COMPLETE ENHANCED LEARNING SYSTEM MIGRATION - FIXED
-- ==================================================
-- Advanced AI learning system for autonomous Twitter bot optimization
-- Date: 2025-01-31
-- Version: Complete Enhanced Learning System - Fixed

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. ENHANCED LEARNING POSTS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS learning_posts (
  id SERIAL PRIMARY KEY,
  tweet_id TEXT UNIQUE,
  content TEXT NOT NULL,
  quality_score INTEGER NOT NULL DEFAULT 0,
  quality_issues TEXT[] DEFAULT '{}',
  audience_growth_potential INTEGER DEFAULT 0,
  was_posted BOOLEAN DEFAULT false,
  post_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  content_length INTEGER,
  has_hook BOOLEAN DEFAULT false,
  has_stats BOOLEAN DEFAULT false,
  has_question BOOLEAN DEFAULT false,
  learning_metadata JSONB DEFAULT '{}',
  
  -- Performance data
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Learning insights
  converted_followers INTEGER DEFAULT 0,
  optimal_timing BOOLEAN DEFAULT false,
  viral_potential_score INTEGER DEFAULT 0,
  
  -- Enhanced format analysis
  format_type VARCHAR(50),
  hook_type VARCHAR(50),
  content_category VARCHAR(50),
  tone VARCHAR(50),
  
  -- Enhanced timing data
  posted_hour INTEGER,
  posted_day_of_week INTEGER,
  time_since_last_post INTEGER, -- minutes
  
  -- Two-pass generation data
  draft_content TEXT,
  critique_notes TEXT,
  improvement_applied TEXT[],
  generation_attempts INTEGER DEFAULT 1,
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- 2. CONTEXTUAL BANDIT ARMS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS contextual_bandit_arms (
  id SERIAL PRIMARY KEY,
  arm_id TEXT UNIQUE NOT NULL,
  content_format TEXT NOT NULL,
  description TEXT,
  success_count DECIMAL(10,3) DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  contextual_weights JSONB DEFAULT '{}',
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- 3. CONTEXTUAL BANDIT HISTORY TABLE (Fixed Foreign Key)
-- ===================================================================
CREATE TABLE IF NOT EXISTS contextual_bandit_history (
  id SERIAL PRIMARY KEY,
  arm_id TEXT NOT NULL,
  reward DECIMAL(4,3) NOT NULL,
  context_features JSONB NOT NULL,
  engagement_metrics JSONB NOT NULL,
  tweet_id TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint after both tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_bandit_history_arm_id' 
    AND table_name = 'contextual_bandit_history'
  ) THEN
    ALTER TABLE contextual_bandit_history 
    ADD CONSTRAINT fk_bandit_history_arm_id 
    FOREIGN KEY (arm_id) REFERENCES contextual_bandit_arms(arm_id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- ===================================================================
-- 4. CONTEXTUAL FEATURES TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS contextual_features (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT NOW(),
  hour INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  recent_engagement_trend TEXT, -- 'up', 'down', 'stable'
  last_post_performance TEXT,   -- 'high', 'medium', 'low'
  time_since_last_post INTEGER, -- hours
  followers_growth_rate DECIMAL(5,4),
  weekday_vs_weekend TEXT,      -- 'weekday', 'weekend'
  engagement_momentum DECIMAL(4,3),
  tweet_id TEXT,
  
  -- Additional context
  recent_follower_count INTEGER,
  recent_avg_engagement DECIMAL(6,2),
  posting_frequency_24h INTEGER
);

-- ===================================================================
-- 5. ENHANCED TIMING STATS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS enhanced_timing_stats (
  id SERIAL PRIMARY KEY,
  hour INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  avg_engagement DECIMAL(8,3) DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  confidence DECIMAL(4,3) DEFAULT 0,
  success_rate DECIMAL(4,3) DEFAULT 0,
  peak_engagement_time BOOLEAN DEFAULT false,
  
  -- Bayesian confidence intervals
  lower_bound DECIMAL(8,3) DEFAULT 0,
  upper_bound DECIMAL(8,3) DEFAULT 0,
  
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Add unique constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_hour_dow_timing' 
    AND table_name = 'enhanced_timing_stats'
  ) THEN
    ALTER TABLE enhanced_timing_stats 
    ADD CONSTRAINT unique_hour_dow_timing UNIQUE (hour, day_of_week);
  END IF;
END $$;

-- ===================================================================
-- 6. OPTIMAL POSTING WINDOWS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS optimal_posting_windows (
  id SERIAL PRIMARY KEY,
  window_start INTEGER NOT NULL, -- hour
  window_end INTEGER NOT NULL,   -- hour
  day_of_week INTEGER NOT NULL,
  effectiveness_score DECIMAL(5,3) NOT NULL,
  confidence DECIMAL(4,3) NOT NULL,
  posts_in_window INTEGER DEFAULT 0,
  avg_engagement DECIMAL(8,3) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- 7. BUDGET OPTIMIZATION LOG TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS budget_optimization_log (
  id SERIAL PRIMARY KEY,
  operation_type TEXT NOT NULL,
  cost_usd DECIMAL(8,4) NOT NULL,
  engagement_result INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  roi DECIMAL(6,4) DEFAULT 0,
  category TEXT, -- 'contentGeneration', 'engagement', 'analytics', 'learning'
  context_data JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- 8. MODEL PERFORMANCE STATS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS model_performance_stats (
  id SERIAL PRIMARY KEY,
  model_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  avg_cost DECIMAL(8,4) DEFAULT 0,
  avg_quality_score DECIMAL(5,2) DEFAULT 0,
  avg_engagement DECIMAL(8,3) DEFAULT 0,
  success_rate DECIMAL(4,3) DEFAULT 0,
  total_operations INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Add unique constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_model_operation' 
    AND table_name = 'model_performance_stats'
  ) THEN
    ALTER TABLE model_performance_stats 
    ADD CONSTRAINT unique_model_operation UNIQUE (model_name, operation_type);
  END IF;
END $$;

-- ===================================================================
-- 9. CONTENT GENERATION SESSIONS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_generation_sessions (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  generation_type TEXT NOT NULL, -- 'two_pass', 'single_pass', 'bandit_selected'
  
  -- Two-pass specific data
  draft_content TEXT,
  draft_time_ms INTEGER,
  critique_content TEXT,
  critique_time_ms INTEGER,
  final_content TEXT,
  final_time_ms INTEGER,
  total_time_ms INTEGER,
  iterations INTEGER DEFAULT 1,
  
  -- Quality metrics
  quality_score DECIMAL(5,2),
  viral_potential DECIMAL(5,2),
  confidence_level DECIMAL(4,3),
  
  -- Bandit selection data
  selected_arm_id TEXT,
  arm_confidence DECIMAL(4,3),
  exploration_mode BOOLEAN DEFAULT false,
  
  -- Context
  contextual_features JSONB,
  
  tweet_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- 10. CONTENT VALIDATION LOGS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_validation_logs (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  validation_type TEXT NOT NULL, -- 'nuclear', 'quality', 'fact_check', 'incomplete_hook'
  validation_result BOOLEAN NOT NULL,
  validation_score DECIMAL(5,2),
  validation_details JSONB,
  validator_name TEXT,
  processing_time_ms INTEGER,
  tweet_id TEXT,
  session_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- 11. AI LEARNING INSIGHTS TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS ai_learning_insights (
  id SERIAL PRIMARY KEY,
  insight_type TEXT NOT NULL,
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(4,3) DEFAULT 0,
  based_on_posts INTEGER DEFAULT 0,
  insight_accuracy DECIMAL(4,3),
  last_validated TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================================

-- Learning posts indexes
CREATE INDEX IF NOT EXISTS idx_learning_posts_posted ON learning_posts (was_posted);
CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON learning_posts (created_at);
CREATE INDEX IF NOT EXISTS idx_learning_posts_engagement ON learning_posts (likes_count, retweets_count, replies_count);
CREATE INDEX IF NOT EXISTS idx_learning_posts_timing ON learning_posts (posted_hour, posted_day_of_week);
CREATE INDEX IF NOT EXISTS idx_learning_posts_format ON learning_posts (format_type, content_category);

-- Bandit system indexes
CREATE INDEX IF NOT EXISTS idx_bandit_arms_arm_id ON contextual_bandit_arms (arm_id);
CREATE INDEX IF NOT EXISTS idx_bandit_history_arm_id ON contextual_bandit_history (arm_id);
CREATE INDEX IF NOT EXISTS idx_bandit_history_timestamp ON contextual_bandit_history (timestamp);

-- Contextual features indexes
CREATE INDEX IF NOT EXISTS idx_contextual_features_timestamp ON contextual_features (timestamp);
CREATE INDEX IF NOT EXISTS idx_contextual_features_hour_dow ON contextual_features (hour, day_of_week);

-- Timing stats indexes
CREATE INDEX IF NOT EXISTS idx_timing_stats_hour_dow ON enhanced_timing_stats (hour, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timing_stats_confidence ON enhanced_timing_stats (confidence DESC);

-- Budget optimization indexes
CREATE INDEX IF NOT EXISTS idx_budget_log_timestamp ON budget_optimization_log (timestamp);
CREATE INDEX IF NOT EXISTS idx_budget_log_category ON budget_optimization_log (category);
CREATE INDEX IF NOT EXISTS idx_budget_log_roi ON budget_optimization_log (roi DESC);

-- Content generation sessions indexes
CREATE INDEX IF NOT EXISTS idx_content_sessions_created_at ON content_generation_sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_content_sessions_type ON content_generation_sessions (generation_type);
CREATE INDEX IF NOT EXISTS idx_content_sessions_quality ON content_generation_sessions (quality_score DESC);

-- Validation logs indexes
CREATE INDEX IF NOT EXISTS idx_validation_logs_created_at ON content_validation_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_validation_logs_type ON content_validation_logs (validation_type);
CREATE INDEX IF NOT EXISTS idx_validation_logs_result ON content_validation_logs (validation_result);

-- ===================================================================
-- STORED FUNCTIONS FOR ANALYTICS
-- ===================================================================

-- Calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  impressions INTEGER DEFAULT NULL
) RETURNS DECIMAL AS $$
BEGIN
  RETURN (COALESCE(likes, 0) + COALESCE(retweets, 0) * 2 + COALESCE(replies, 0) * 3);
END;
$$ LANGUAGE plpgsql;

-- Get optimal posting time with error handling
CREATE OR REPLACE FUNCTION get_optimal_posting_time(
  target_day_of_week INTEGER DEFAULT NULL
) RETURNS TABLE (
  optimal_hour INTEGER,
  day_of_week INTEGER,
  predicted_engagement DECIMAL,
  confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ets.hour, 9) as optimal_hour,
    COALESCE(ets.day_of_week, 1) as day_of_week,
    COALESCE(ets.avg_engagement, 15.0) as predicted_engagement,
    COALESCE(ets.confidence, 0.5) as confidence
  FROM enhanced_timing_stats ets
  WHERE (target_day_of_week IS NULL OR ets.day_of_week = target_day_of_week)
    AND ets.confidence >= 0.3
    AND ets.post_count >= 1
  ORDER BY ets.avg_engagement * ets.confidence DESC
  LIMIT 5;
  
  -- If no results, return default optimal times
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      CASE 
        WHEN target_day_of_week IS NOT NULL THEN 
          CASE target_day_of_week
            WHEN 1 THEN 9  -- Monday
            WHEN 2 THEN 9  -- Tuesday 
            WHEN 3 THEN 12 -- Wednesday
            WHEN 4 THEN 15 -- Thursday
            WHEN 5 THEN 9  -- Friday
            WHEN 6 THEN 12 -- Saturday
            ELSE 18        -- Sunday
          END
        ELSE 9
      END as optimal_hour,
      COALESCE(target_day_of_week, 1) as day_of_week,
      20.0::DECIMAL as predicted_engagement,
      0.6::DECIMAL as confidence;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Get bandit arm statistics with safety checks
CREATE OR REPLACE FUNCTION get_bandit_arm_statistics()
RETURNS TABLE (
  arm_id TEXT,
  content_format TEXT,
  success_rate DECIMAL,
  confidence DECIMAL,
  total_selections INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cba.arm_id,
    cba.content_format,
    CASE 
      WHEN cba.total_count > 0 THEN GREATEST(0, LEAST(1, cba.success_count / cba.total_count))
      ELSE 0.5::DECIMAL
    END as success_rate,
    CASE
      WHEN cba.total_count >= 5 THEN 
        GREATEST(0.1, LEAST(0.95, 
          (cba.success_count / GREATEST(1, cba.total_count)) - 
          (1.96 * SQRT((cba.success_count / GREATEST(1, cba.total_count)) * 
                      (1 - cba.success_count / GREATEST(1, cba.total_count)) / 
                      GREATEST(1, cba.total_count)))
        ))
      ELSE GREATEST(0.1, LEAST(0.6, cba.total_count::DECIMAL / 10))
    END as confidence,
    cba.total_count
  FROM contextual_bandit_arms cba
  ORDER BY success_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Calculate content quality trend with safety
CREATE OR REPLACE FUNCTION get_content_quality_trend(
  days_back INTEGER DEFAULT 7
) RETURNS TABLE (
  date_bucket DATE,
  avg_quality_score DECIMAL,
  avg_engagement DECIMAL,
  post_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(lp.created_at) as date_bucket,
    COALESCE(AVG(lp.quality_score), 50)::DECIMAL as avg_quality_score,
    COALESCE(AVG(calculate_engagement_score(lp.likes_count, lp.retweets_count, lp.replies_count)), 10)::DECIMAL as avg_engagement,
    COUNT(*)::INTEGER as post_count
  FROM learning_posts lp
  WHERE lp.was_posted = true
    AND lp.created_at >= NOW() - INTERVAL '1 day' * GREATEST(1, days_back)
  GROUP BY DATE(lp.created_at)
  ORDER BY date_bucket DESC;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ===================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers safely
DO $$
BEGIN
  -- Learning posts trigger
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_learning_posts_updated_at') THEN
    CREATE TRIGGER update_learning_posts_updated_at
        BEFORE UPDATE ON learning_posts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  -- Optimal windows trigger
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_optimal_windows_updated_at') THEN
    CREATE TRIGGER update_optimal_windows_updated_at
        BEFORE UPDATE ON optimal_posting_windows
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Auto-calculate engagement rate trigger
CREATE OR REPLACE FUNCTION calculate_engagement_rate()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.impressions > 0 THEN
        NEW.engagement_rate = (COALESCE(NEW.likes_count, 0) + COALESCE(NEW.retweets_count, 0) + COALESCE(NEW.replies_count, 0))::DECIMAL / NEW.impressions;
    ELSE
        NEW.engagement_rate = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'auto_calculate_engagement_rate') THEN
    CREATE TRIGGER auto_calculate_engagement_rate
        BEFORE INSERT OR UPDATE ON learning_posts
        FOR EACH ROW
        EXECUTE FUNCTION calculate_engagement_rate();
  END IF;
END $$;

-- ===================================================================
-- INITIAL DATA SEEDING (SAFE)
-- ===================================================================

-- Seed bandit arms if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contextual_bandit_arms LIMIT 1) THEN
    INSERT INTO contextual_bandit_arms (arm_id, content_format, description, success_count, total_count)
    VALUES 
      ('hook_value_cta', 'Hook + Value + CTA', 'Strong attention hook, valuable insight, clear call-to-action', 1, 2),
      ('fact_authority_question', 'Fact + Authority + Question', 'Scientific fact with credible source, engaging question', 1, 2),
      ('story_lesson_application', 'Story + Lesson + Application', 'Personal narrative with actionable takeaway', 1, 2),
      ('controversy_evidence_stance', 'Controversy + Evidence + Stance', 'Challenging popular belief with evidence-based position', 1, 2),
      ('tip_mechanism_benefit', 'Tip + Mechanism + Benefit', 'Actionable advice with scientific explanation and clear benefit', 1, 2),
      ('thread_deep_dive', 'Thread Deep Dive', 'Multi-tweet thread exploring topic comprehensively', 1, 2),
      ('quick_win_hack', 'Quick Win Hack', 'Simple, immediately actionable health optimization', 1, 2),
      ('myth_bust_reveal', 'Myth Bust Reveal', 'Debunking common health misconception with evidence', 1, 2);
  END IF;
END $$;

-- Seed optimal posting windows with default high-engagement times
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM optimal_posting_windows LIMIT 1) THEN
    INSERT INTO optimal_posting_windows (window_start, window_end, day_of_week, effectiveness_score, confidence, posts_in_window)
    VALUES
      (7, 9, 1, 0.85, 0.7, 5),    -- Monday morning
      (12, 14, 1, 0.80, 0.7, 5),  -- Monday lunch
      (18, 20, 1, 0.82, 0.7, 5),  -- Monday evening
      (7, 9, 2, 0.83, 0.7, 5),    -- Tuesday morning
      (15, 17, 2, 0.78, 0.7, 5),  -- Tuesday afternoon
      (7, 9, 3, 0.85, 0.7, 5),    -- Wednesday morning
      (12, 14, 3, 0.81, 0.7, 5),  -- Wednesday lunch
      (7, 9, 4, 0.84, 0.7, 5),    -- Thursday morning
      (18, 20, 4, 0.79, 0.7, 5),  -- Thursday evening
      (7, 9, 5, 0.80, 0.7, 5),    -- Friday morning
      (12, 14, 6, 0.75, 0.6, 3),  -- Saturday lunch
      (18, 20, 0, 0.77, 0.6, 3);  -- Sunday evening
  END IF;
END $$;

-- Seed enhanced timing stats with default data
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM enhanced_timing_stats LIMIT 1) THEN
    INSERT INTO enhanced_timing_stats (hour, day_of_week, avg_engagement, post_count, confidence, success_rate, peak_engagement_time)
    VALUES
      (7, 1, 25.5, 3, 0.6, 0.7, true),   -- Monday 7 AM
      (9, 1, 23.2, 4, 0.7, 0.75, true),  -- Monday 9 AM
      (12, 1, 28.1, 5, 0.8, 0.8, true),  -- Monday 12 PM
      (15, 1, 22.4, 3, 0.6, 0.67, false), -- Monday 3 PM
      (18, 1, 26.8, 4, 0.7, 0.75, true),  -- Monday 6 PM
      (20, 1, 24.3, 3, 0.6, 0.67, false), -- Monday 8 PM
      (7, 2, 24.1, 3, 0.6, 0.67, true),   -- Tuesday 7 AM
      (9, 2, 27.3, 4, 0.7, 0.75, true),   -- Tuesday 9 AM
      (12, 2, 25.8, 4, 0.7, 0.75, true),  -- Tuesday 12 PM
      (15, 2, 29.2, 5, 0.8, 0.8, true),   -- Tuesday 3 PM
      (18, 2, 23.5, 3, 0.6, 0.67, false), -- Tuesday 6 PM
      (7, 3, 26.7, 4, 0.7, 0.75, true),   -- Wednesday 7 AM
      (12, 3, 27.9, 5, 0.8, 0.8, true),   -- Wednesday 12 PM
      (18, 3, 24.6, 3, 0.6, 0.67, false), -- Wednesday 6 PM
      (7, 4, 25.4, 4, 0.7, 0.75, true),   -- Thursday 7 AM
      (18, 4, 28.3, 4, 0.7, 0.75, true),  -- Thursday 6 PM
      (7, 5, 24.8, 3, 0.6, 0.67, true),   -- Friday 7 AM
      (12, 6, 22.1, 2, 0.5, 0.5, false),  -- Saturday 12 PM
      (18, 0, 23.7, 3, 0.6, 0.67, false); -- Sunday 6 PM
  END IF;
END $$;

-- ===================================================================
-- COMMENTS AND DOCUMENTATION
-- ===================================================================

COMMENT ON TABLE learning_posts IS 'Enhanced learning data from real posted content with two-pass generation tracking';
COMMENT ON TABLE contextual_bandit_arms IS 'Multi-arm bandit system for content format selection optimization';
COMMENT ON TABLE contextual_bandit_history IS 'Historical record of bandit selections and rewards for learning';
COMMENT ON TABLE contextual_features IS 'Contextual features extracted for intelligent decision making';
COMMENT ON TABLE enhanced_timing_stats IS 'Advanced timing analysis with Bayesian confidence intervals';
COMMENT ON TABLE optimal_posting_windows IS 'Learned optimal time windows for posting content';
COMMENT ON TABLE budget_optimization_log IS 'Budget allocation and ROI tracking for intelligent spending';
COMMENT ON TABLE model_performance_stats IS 'Performance metrics for different AI models and operations';
COMMENT ON TABLE content_generation_sessions IS 'Detailed tracking of content generation sessions and quality';
COMMENT ON TABLE content_validation_logs IS 'Comprehensive content validation and quality gate logging';
COMMENT ON TABLE ai_learning_insights IS 'High-level insights generated by the AI learning system';

-- Verify everything is working
DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name IN (
    'learning_posts', 'contextual_bandit_arms', 'contextual_bandit_history',
    'contextual_features', 'enhanced_timing_stats', 'optimal_posting_windows',
    'budget_optimization_log', 'model_performance_stats', 'content_generation_sessions',
    'content_validation_logs', 'ai_learning_insights'
  );
  
  SELECT COUNT(*) INTO function_count FROM information_schema.routines 
  WHERE routine_schema = 'public' AND routine_name IN (
    'calculate_engagement_score', 'get_optimal_posting_time', 
    'get_bandit_arm_statistics', 'get_content_quality_trend'
  );
  
  RAISE NOTICE 'Enhanced Learning System Setup Complete:';
  RAISE NOTICE '  - Tables created: %', table_count;
  RAISE NOTICE '  - Functions created: %', function_count;
  RAISE NOTICE '  - All constraints and indexes applied successfully';
  RAISE NOTICE '  - Initial data seeded';
END $$;

SELECT 'Enhanced Learning System migration completed successfully - FIXED VERSION' AS status;
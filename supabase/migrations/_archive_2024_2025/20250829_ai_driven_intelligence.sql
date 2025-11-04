-- 🤖 AI-DRIVEN INTELLIGENCE MIGRATION
-- Comprehensive database structure for AI learning and data collection
-- Supports 0-100 posts/day decision making based on data

-- =============================================================================
-- 📊 COMPREHENSIVE POST PERFORMANCE TRACKING
-- =============================================================================

-- Enhanced post performance table with all AI learning data
CREATE TABLE IF NOT EXISTS ai_post_performance (
  id SERIAL PRIMARY KEY,
  post_id TEXT UNIQUE NOT NULL,
  posted_at TIMESTAMP NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('single', 'thread')) NOT NULL,
  content_length INTEGER NOT NULL,
  
  -- Performance metrics (updated over time)
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Follower attribution data
  followers_at_posting INTEGER NOT NULL,
  followers_after_1hour INTEGER DEFAULT 0,
  followers_after_24hours INTEGER DEFAULT 0,
  followers_after_7days INTEGER DEFAULT 0,
  followers_gained_attributed DECIMAL(10,2) DEFAULT 0,
  follower_quality_score DECIMAL(3,2) DEFAULT 0,
  
  -- Contextual factors
  day_of_week INTEGER NOT NULL,
  hour_posted INTEGER NOT NULL,
  minute_posted INTEGER NOT NULL,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_weekend BOOLEAN DEFAULT FALSE,
  seasonality TEXT,
  weather_impact DECIMAL(3,2) DEFAULT 1.0,
  economic_events JSONB DEFAULT '[]',
  health_news_events JSONB DEFAULT '[]',
  
  -- Competitive landscape
  competitor_posts_in_window INTEGER DEFAULT 0,
  competitor_engagement_avg DECIMAL(10,2) DEFAULT 0,
  market_saturation DECIMAL(3,2) DEFAULT 0.5,
  trending_topics_relevance DECIMAL(3,2) DEFAULT 0,
  viral_content_in_niche INTEGER DEFAULT 0,
  
  -- Content analysis
  sentiment_score DECIMAL(3,2) DEFAULT 0, -- -1 to 1
  emotional_triggers JSONB DEFAULT '[]',
  authority_signals JSONB DEFAULT '[]',
  actionability_score DECIMAL(3,2) DEFAULT 0,
  viral_elements JSONB DEFAULT '[]',
  controversy_level DECIMAL(3,2) DEFAULT 0,
  educational_value DECIMAL(3,2) DEFAULT 0,
  
  -- Engagement patterns
  early_engagement_velocity DECIMAL(10,2) DEFAULT 0,
  peak_engagement_hour INTEGER DEFAULT 0,
  engagement_decay_rate DECIMAL(5,4) DEFAULT 0,
  comment_quality DECIMAL(3,2) DEFAULT 0,
  share_to_like_ratio DECIMAL(5,4) DEFAULT 0,
  save_to_view_ratio DECIMAL(8,6) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance queries
CREATE INDEX idx_ai_post_performance_posted_at ON ai_post_performance (posted_at DESC);
CREATE INDEX idx_ai_post_performance_hour_day ON ai_post_performance (hour_posted, day_of_week);
CREATE INDEX idx_ai_post_performance_followers_gained ON ai_post_performance (followers_gained_attributed DESC);

-- =============================================================================
-- 🧠 AI LEARNING INSIGHTS
-- =============================================================================

-- Store AI-generated insights for continuous learning
CREATE TABLE IF NOT EXISTS ai_learning_insights (
  id SERIAL PRIMARY KEY,
  insight_text TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL, -- 0 to 1
  data_points INTEGER NOT NULL,
  impact TEXT CHECK (impact IN ('high', 'medium', 'low')) NOT NULL,
  category TEXT CHECK (category IN ('timing', 'content', 'frequency', 'context', 'competitive')) NOT NULL,
  recommendation TEXT NOT NULL,
  
  -- Validation tracking
  implemented BOOLEAN DEFAULT FALSE,
  implemented_at TIMESTAMP,
  performance_after_implementation DECIMAL(5,2), -- % improvement
  
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days' -- Insights expire after 30 days
);

CREATE INDEX idx_ai_insights_category_confidence ON ai_learning_insights (category, confidence DESC);
CREATE INDEX idx_ai_insights_impact ON ai_learning_insights (impact, generated_at DESC);

-- =============================================================================
-- 📈 AI POSTING DECISIONS LOG
-- =============================================================================

-- Track every AI posting decision for learning
CREATE TABLE IF NOT EXISTS ai_posting_decisions (
  id SERIAL PRIMARY KEY,
  decision_timestamp TIMESTAMP DEFAULT NOW(),
  should_post BOOLEAN NOT NULL,
  recommended_frequency INTEGER, -- 0-100 posts per day
  strategy TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  data_confidence DECIMAL(3,2) NOT NULL,
  
  -- Context at decision time
  current_followers INTEGER,
  posts_today INTEGER,
  minutes_since_last_post INTEGER,
  trending_topics JSONB DEFAULT '[]',
  competitor_activity DECIMAL(3,2),
  market_intelligence JSONB DEFAULT '{}',
  
  -- Outcome tracking
  decision_executed BOOLEAN DEFAULT FALSE,
  actual_performance JSONB, -- Store actual results
  decision_quality_score DECIMAL(3,2) -- How good was this decision (0-1)
);

CREATE INDEX idx_ai_decisions_timestamp ON ai_posting_decisions (decision_timestamp DESC);
CREATE INDEX idx_ai_decisions_frequency ON ai_posting_decisions (recommended_frequency, data_confidence);

-- =============================================================================
-- 🎯 DYNAMIC TIMING ANALYSIS
-- =============================================================================

-- Store real-time timing performance data
CREATE TABLE IF NOT EXISTS optimal_timing_analysis (
  id SERIAL PRIMARY KEY,
  analysis_date DATE DEFAULT CURRENT_DATE,
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  
  -- Performance metrics for this time slot
  avg_engagement DECIMAL(10,2) DEFAULT 0,
  avg_followers_gained DECIMAL(5,2) DEFAULT 0,
  engagement_velocity DECIMAL(10,2) DEFAULT 0,
  viral_probability DECIMAL(4,3) DEFAULT 0, -- 0 to 1
  
  -- Contextual factors
  is_holiday_period BOOLEAN DEFAULT FALSE,
  seasonal_factor DECIMAL(3,2) DEFAULT 1.0,
  news_event_impact DECIMAL(3,2) DEFAULT 1.0,
  competitor_activity_level DECIMAL(3,2) DEFAULT 0.5,
  
  -- Sample size and confidence
  sample_size INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0,
  
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(analysis_date, hour_of_day, day_of_week)
);

CREATE INDEX idx_timing_analysis_date_hour ON optimal_timing_analysis (analysis_date, hour_of_day);
CREATE INDEX idx_timing_analysis_performance ON optimal_timing_analysis (avg_followers_gained DESC, confidence_score DESC);

-- =============================================================================
-- 🏆 COMPETITIVE INTELLIGENCE
-- =============================================================================

-- Track competitor activity and performance
CREATE TABLE IF NOT EXISTS competitor_intelligence (
  id SERIAL PRIMARY KEY,
  tracked_at TIMESTAMP DEFAULT NOW(),
  competitor_handle TEXT,
  
  -- Activity metrics
  posts_in_last_hour INTEGER DEFAULT 0,
  posts_in_last_24h INTEGER DEFAULT 0,
  avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
  follower_growth_rate DECIMAL(8,4) DEFAULT 0,
  
  -- Content analysis
  trending_topics JSONB DEFAULT '[]',
  content_themes JSONB DEFAULT '[]',
  viral_posts_count INTEGER DEFAULT 0,
  
  -- Market insights
  market_share DECIMAL(5,4) DEFAULT 0,
  engagement_volume INTEGER DEFAULT 0,
  content_frequency DECIMAL(5,2) DEFAULT 0,
  
  analysis_confidence DECIMAL(3,2) DEFAULT 0
);

CREATE INDEX idx_competitor_intelligence_tracked_at ON competitor_intelligence (tracked_at DESC);

-- =============================================================================
-- ⚡ REAL-TIME PERFORMANCE FUNCTIONS
-- =============================================================================

-- Function to calculate optimal posting frequency based on recent performance
CREATE OR REPLACE FUNCTION calculate_optimal_frequency()
RETURNS INTEGER AS $$
DECLARE
  recent_performance DECIMAL(10,2);
  avg_followers_per_post DECIMAL(5,2);
  market_opportunity DECIMAL(3,2);
  optimal_freq INTEGER;
BEGIN
  -- Calculate recent performance
  SELECT AVG(followers_gained_attributed) 
  INTO avg_followers_per_post
  FROM ai_post_performance 
  WHERE posted_at >= NOW() - INTERVAL '7 days';
  
  -- Get market opportunity score
  SELECT AVG(trending_topics_relevance) 
  INTO market_opportunity
  FROM ai_post_performance 
  WHERE posted_at >= NOW() - INTERVAL '24 hours';
  
  -- Calculate optimal frequency (0-100 range)
  optimal_freq := GREATEST(1, LEAST(100, 
    ROUND(
      (COALESCE(avg_followers_per_post, 1) * 10) + 
      (COALESCE(market_opportunity, 0.5) * 20) + 
      5 -- baseline
    )
  ));
  
  RETURN optimal_freq;
END;
$$ LANGUAGE plpgsql;

-- Function to get best posting times based on data
CREATE OR REPLACE FUNCTION get_optimal_posting_times(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  hour INTEGER,
  expected_engagement DECIMAL(10,2),
  expected_followers DECIMAL(5,2),
  confidence DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ota.hour_of_day,
    ota.avg_engagement,
    ota.avg_followers_gained,
    ota.confidence_score
  FROM optimal_timing_analysis ota
  WHERE ota.analysis_date = target_date
    AND ota.sample_size >= 3
    AND ota.confidence_score >= 0.5
  ORDER BY ota.avg_followers_gained DESC, ota.confidence_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to record posting decision and outcome
CREATE OR REPLACE FUNCTION record_posting_decision(
  should_post_param BOOLEAN,
  frequency_param INTEGER,
  strategy_param TEXT,
  reasoning_param TEXT,
  confidence_param DECIMAL(3,2)
) RETURNS INTEGER AS $$
DECLARE
  decision_id INTEGER;
BEGIN
  INSERT INTO ai_posting_decisions (
    should_post, 
    recommended_frequency, 
    strategy, 
    reasoning, 
    data_confidence,
    current_followers,
    posts_today
  ) VALUES (
    should_post_param,
    frequency_param,
    strategy_param,
    reasoning_param,
    confidence_param,
    (SELECT COUNT(*) FROM ai_post_performance WHERE posted_at >= CURRENT_DATE), -- Approximate followers
    (SELECT COUNT(*) FROM ai_post_performance WHERE posted_at >= CURRENT_DATE)  -- Posts today
  ) RETURNING id INTO decision_id;
  
  RETURN decision_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 📊 PERFORMANCE ANALYTICS VIEWS
-- =============================================================================

-- View for hourly performance analysis
CREATE OR REPLACE VIEW hourly_performance_summary AS
SELECT 
  hour_posted,
  COUNT(*) as post_count,
  AVG(followers_gained_attributed) as avg_followers_gained,
  AVG(likes + retweets + replies) as avg_engagement,
  AVG(impressions) as avg_impressions,
  STDDEV(followers_gained_attributed) as followers_std_dev,
  MAX(followers_gained_attributed) as max_followers_gained,
  AVG(CASE WHEN followers_gained_attributed > 1 THEN 1.0 ELSE 0.0 END) as success_rate
FROM ai_post_performance
WHERE posted_at >= NOW() - INTERVAL '30 days'
GROUP BY hour_posted
ORDER BY avg_followers_gained DESC;

-- View for content type performance
CREATE OR REPLACE VIEW content_type_performance AS
SELECT 
  content_type,
  COUNT(*) as post_count,
  AVG(followers_gained_attributed) as avg_followers_gained,
  AVG(likes + retweets + replies) as avg_engagement,
  AVG(impressions) as avg_impressions,
  AVG(actionability_score) as avg_actionability,
  AVG(educational_value) as avg_educational_value
FROM ai_post_performance
WHERE posted_at >= NOW() - INTERVAL '30 days'
GROUP BY content_type;

-- View for AI decision effectiveness
CREATE OR REPLACE VIEW ai_decision_effectiveness AS
SELECT 
  strategy,
  COUNT(*) as decision_count,
  AVG(data_confidence) as avg_confidence,
  AVG(CASE WHEN decision_executed THEN 1.0 ELSE 0.0 END) as execution_rate,
  AVG(decision_quality_score) as avg_quality_score,
  AVG(recommended_frequency) as avg_recommended_frequency
FROM ai_posting_decisions
WHERE decision_timestamp >= NOW() - INTERVAL '7 days'
GROUP BY strategy
ORDER BY avg_quality_score DESC;

-- =============================================================================
-- 🔄 AUTOMATED DATA MAINTENANCE
-- =============================================================================

-- Clean up old insights (keep only recent and high-performing)
SELECT cron.schedule(
  'cleanup-old-insights',
  '0 2 * * *', -- Daily at 2 AM
  'DELETE FROM ai_learning_insights WHERE expires_at < NOW() AND impact = ''low'' AND confidence < 0.6;'
);

-- Update timing analysis daily
SELECT cron.schedule(
  'update-timing-analysis',
  '0 3 * * *', -- Daily at 3 AM
  $$
  INSERT INTO optimal_timing_analysis (
    hour_of_day, day_of_week, avg_engagement, avg_followers_gained, 
    engagement_velocity, sample_size, confidence_score
  )
  SELECT 
    hour_posted, day_of_week,
    AVG(likes + retweets + replies) as avg_engagement,
    AVG(followers_gained_attributed) as avg_followers_gained,
    AVG(early_engagement_velocity) as engagement_velocity,
    COUNT(*) as sample_size,
    LEAST(1.0, COUNT(*) / 10.0) as confidence_score
  FROM ai_post_performance 
  WHERE posted_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY hour_posted, day_of_week
  ON CONFLICT (analysis_date, hour_of_day, day_of_week) 
  DO UPDATE SET
    avg_engagement = EXCLUDED.avg_engagement,
    avg_followers_gained = EXCLUDED.avg_followers_gained,
    engagement_velocity = EXCLUDED.engagement_velocity,
    sample_size = EXCLUDED.sample_size,
    confidence_score = EXCLUDED.confidence_score,
    last_updated = NOW();
  $$
);

-- =============================================================================
-- ✅ MIGRATION COMPLETE
-- =============================================================================

-- Log successful completion
INSERT INTO ai_posting_decisions (
  should_post, recommended_frequency, strategy, reasoning, data_confidence
) VALUES (
  false, 8, 'migration_complete', 'AI-driven intelligence database structure created', 1.0
);

-- Output success message
DO $$
BEGIN
  RAISE NOTICE '🤖 AI-DRIVEN INTELLIGENCE MIGRATION COMPLETE';
  RAISE NOTICE '📊 Created comprehensive data collection tables';
  RAISE NOTICE '🧠 Added AI learning insights tracking';
  RAISE NOTICE '⚡ Implemented real-time performance functions';
  RAISE NOTICE '🎯 Set up dynamic timing analysis';
  RAISE NOTICE '🏆 Added competitive intelligence tracking';
  RAISE NOTICE '📈 Ready for 0-100 posts/day AI decision making';
END $$;

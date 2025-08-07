-- 🚀 AUDIENCE GROWTH OPTIMIZATION DATABASE SCHEMA
-- ================================================
-- This schema is designed specifically for learning and growing followers,
-- likes, comments, and replies through comprehensive data analysis
-- Date: 2025-08-06

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ===================================================================
-- 1. COMPREHENSIVE TWEET ANALYTICS (Fixed All Missing Columns)
-- ===================================================================
CREATE TABLE IF NOT EXISTS tweet_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL,
  
  -- Core Engagement Metrics (PRIMARY SUCCESS INDICATORS)
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  
  -- Reach & Discovery Metrics (CRITICAL for understanding virality)
  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  media_views INTEGER DEFAULT 0,
  
  -- MISSING COLUMNS CAUSING ERRORS (NOW ADDED)
  click_through_rate DECIMAL(8,4) DEFAULT 0,
  engagement_rate DECIMAL(8,4) DEFAULT 0,
  profile_visit_rate DECIMAL(8,4) DEFAULT 0,
  viral_score DECIMAL(8,4) DEFAULT 0,
  performance_score DECIMAL(8,4) DEFAULT 0,
  
  -- FOLLOWER GROWTH TRACKING (MOST IMPORTANT)
  follower_count_before INTEGER DEFAULT 0,
  follower_count_after INTEGER DEFAULT 0,
  new_followers_attributed INTEGER DEFAULT 0,
  follower_conversion_rate DECIMAL(8,4) DEFAULT 0,
  follower_growth_velocity DECIMAL(8,4) DEFAULT 0,
  
  -- Content Analysis for Learning
  content TEXT,
  content_type VARCHAR(50) DEFAULT 'original',
  has_media BOOLEAN DEFAULT false,
  has_hashtags BOOLEAN DEFAULT false,
  has_mentions BOOLEAN DEFAULT false,
  has_links BOOLEAN DEFAULT false,
  word_count INTEGER DEFAULT 0,
  sentiment_score DECIMAL(4,3) DEFAULT 0,
  readability_score DECIMAL(4,3) DEFAULT 0,
  
  -- Timing Analysis
  posted_hour INTEGER,
  posted_day_of_week INTEGER,
  posted_timezone VARCHAR(50),
  optimal_timing_score DECIMAL(4,3) DEFAULT 0,
  
  -- Advanced Learning Metrics
  audience_resonance_score DECIMAL(8,4) DEFAULT 0,
  content_uniqueness_score DECIMAL(8,4) DEFAULT 0,
  engagement_velocity DECIMAL(8,4) DEFAULT 0, -- how fast engagement happens
  sustained_engagement DECIMAL(8,4) DEFAULT 0, -- engagement over time
  community_building_score DECIMAL(8,4) DEFAULT 0, -- replies that create conversations
  
  -- Data Collection Metadata
  snapshot_interval VARCHAR(20) DEFAULT 'latest',
  snapshot_time TIMESTAMPTZ DEFAULT NOW(),
  collected_via VARCHAR(50) DEFAULT 'browser',
  collection_confidence DECIMAL(4,3) DEFAULT 1.0,
  
  -- Learning Flags
  is_viral BOOLEAN DEFAULT false, -- more than 10x normal engagement
  is_high_converting BOOLEAN DEFAULT false, -- generated followers
  is_community_building BOOLEAN DEFAULT false, -- generated meaningful replies
  quality_tier VARCHAR(20) DEFAULT 'standard', -- viral, high, standard, low
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tweet_id, snapshot_interval)
);

-- ===================================================================
-- 2. POST HISTORY TABLE (Fixed Missing Columns)
-- ===================================================================
CREATE TABLE IF NOT EXISTS post_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'original', -- MISSING COLUMN ADDED
  
  -- Content Strategy Tracking
  strategy_used VARCHAR(100),
  content_format VARCHAR(50), -- thread, single, poll, etc
  hook_type VARCHAR(50), -- question, statistic, controversial, etc
  call_to_action_type VARCHAR(50),
  
  -- Performance Prediction (AI Learning)
  predicted_engagement DECIMAL(8,4) DEFAULT 0,
  actual_engagement DECIMAL(8,4) DEFAULT 0,
  prediction_accuracy DECIMAL(4,3) DEFAULT 0,
  
  -- Learning Metadata
  content_embedding vector(1536), -- for similarity analysis
  topic_tags TEXT[],
  target_audience VARCHAR(100),
  posting_objective VARCHAR(100), -- followers, engagement, awareness
  
  -- Results Tracking
  achieved_objectives BOOLEAN DEFAULT false,
  lessons_learned TEXT,
  repeat_strategy BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 3. AUDIENCE GROWTH LEARNING TABLE
-- ===================================================================
CREATE TABLE IF NOT EXISTS audience_growth_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Learning Period
  analysis_period VARCHAR(20) NOT NULL, -- daily, weekly, monthly
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Growth Metrics
  followers_start INTEGER DEFAULT 0,
  followers_end INTEGER DEFAULT 0,
  net_follower_growth INTEGER DEFAULT 0,
  follower_growth_rate DECIMAL(8,4) DEFAULT 0,
  
  -- Content Performance Analysis
  total_posts INTEGER DEFAULT 0,
  viral_posts INTEGER DEFAULT 0,
  high_engagement_posts INTEGER DEFAULT 0,
  follower_converting_posts INTEGER DEFAULT 0,
  
  -- What's Working (AI Learning)
  top_performing_formats JSONB DEFAULT '[]',
  best_posting_times JSONB DEFAULT '[]',
  most_engaging_topics JSONB DEFAULT '[]',
  optimal_content_length JSONB DEFAULT '{}',
  successful_hooks JSONB DEFAULT '[]',
  effective_ctas JSONB DEFAULT '[]',
  
  -- What's Not Working
  low_performing_patterns JSONB DEFAULT '[]',
  content_to_avoid JSONB DEFAULT '[]',
  timing_to_avoid JSONB DEFAULT '[]',
  
  -- Audience Insights
  audience_demographics JSONB DEFAULT '{}',
  audience_interests JSONB DEFAULT '[]',
  audience_behavior_patterns JSONB DEFAULT '{}',
  
  -- Competitive Analysis
  competitive_benchmarks JSONB DEFAULT '{}',
  industry_trends JSONB DEFAULT '[]',
  
  -- AI Recommendations
  recommended_strategies JSONB DEFAULT '[]',
  content_suggestions JSONB DEFAULT '[]',
  timing_optimizations JSONB DEFAULT '[]',
  engagement_tactics JSONB DEFAULT '[]',
  
  -- Confidence Scores
  data_confidence DECIMAL(4,3) DEFAULT 0,
  recommendation_confidence DECIMAL(4,3) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 4. REAL-TIME ENGAGEMENT TRACKING
-- ===================================================================
CREATE TABLE IF NOT EXISTS engagement_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL,
  
  -- Event Details
  event_type VARCHAR(50) NOT NULL, -- like, retweet, reply, follow, profile_visit
  event_timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_identifier VARCHAR(255), -- when available
  
  -- Context
  minutes_after_post INTEGER,
  engagement_source VARCHAR(50), -- timeline, profile, search, notification
  
  -- User Analysis (when available)
  user_follower_count INTEGER,
  user_engagement_rate DECIMAL(4,3),
  user_authority_score DECIMAL(4,3),
  
  -- Learning Data
  was_reply_meaningful BOOLEAN, -- for replies, did it add value?
  generated_further_engagement BOOLEAN, -- did this event spark more?
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 5. CONTENT PERFORMANCE LEARNING
-- ===================================================================
CREATE TABLE IF NOT EXISTS content_learning_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Content Identification
  content_hash VARCHAR(64) NOT NULL, -- to identify similar content
  content_type VARCHAR(50) NOT NULL,
  content_format VARCHAR(50) NOT NULL,
  
  -- Performance Metrics
  avg_engagement_rate DECIMAL(8,4) DEFAULT 0,
  avg_follower_conversion DECIMAL(8,4) DEFAULT 0,
  avg_reply_quality DECIMAL(4,3) DEFAULT 0,
  virality_potential DECIMAL(4,3) DEFAULT 0,
  
  -- Learning Insights
  successful_elements JSONB DEFAULT '[]',
  improvement_areas JSONB DEFAULT '[]',
  optimal_variations JSONB DEFAULT '[]',
  
  -- Usage Tracking
  times_used INTEGER DEFAULT 0,
  success_rate DECIMAL(4,3) DEFAULT 0,
  last_used TIMESTAMPTZ,
  
  -- AI Recommendations
  should_repeat BOOLEAN DEFAULT false,
  suggested_improvements TEXT,
  confidence_score DECIMAL(4,3) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(content_hash)
);

-- ===================================================================
-- 6. GROWTH EXPERIMENT TRACKING
-- ===================================================================
CREATE TABLE IF NOT EXISTS growth_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Experiment Details
  experiment_name VARCHAR(100) NOT NULL,
  experiment_type VARCHAR(50) NOT NULL, -- content, timing, format, audience
  hypothesis TEXT NOT NULL,
  
  -- Control vs Test
  control_group_config JSONB DEFAULT '{}',
  test_group_config JSONB DEFAULT '{}',
  
  -- Results
  control_results JSONB DEFAULT '{}',
  test_results JSONB DEFAULT '{}',
  statistical_significance DECIMAL(4,3),
  
  -- Status
  status VARCHAR(20) DEFAULT 'planning', -- planning, running, completed, failed
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Outcomes
  winning_variant VARCHAR(20), -- control, test, inconclusive
  lessons_learned TEXT,
  implementation_plan TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ===================================================================

-- Tweet analytics indexes
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_performance ON tweet_analytics(performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_viral ON tweet_analytics(is_viral, viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_followers ON tweet_analytics(new_followers_attributed DESC);

-- Post history indexes
CREATE INDEX IF NOT EXISTS idx_post_history_content_type ON post_history(content_type);
CREATE INDEX IF NOT EXISTS idx_post_history_performance ON post_history(actual_engagement DESC);

-- Engagement events indexes
CREATE INDEX IF NOT EXISTS idx_engagement_events_tweet_id ON engagement_events(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_type ON engagement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_engagement_events_time ON engagement_events(event_timestamp);

-- Growth insights indexes
CREATE INDEX IF NOT EXISTS idx_growth_insights_period ON audience_growth_insights(analysis_period, period_start);

-- ===================================================================
-- 8. FUNCTIONS FOR AUTOMATED LEARNING
-- ===================================================================

-- Function to calculate content performance score
CREATE OR REPLACE FUNCTION calculate_content_performance_score(
  likes INTEGER,
  retweets INTEGER,
  replies INTEGER,
  impressions INTEGER,
  new_followers INTEGER
) RETURNS DECIMAL(8,4) AS $$
BEGIN
  -- Weighted formula prioritizing follower growth
  RETURN (
    (likes * 0.1) + 
    (retweets * 0.2) + 
    (replies * 0.3) + 
    (CASE WHEN impressions > 0 THEN (likes + retweets + replies)::DECIMAL / impressions * 100 ELSE 0 END * 0.2) +
    (new_followers * 5.0) -- Heavy weight on follower growth
  );
END;
$$ LANGUAGE plpgsql;

-- Function to update growth insights automatically
CREATE OR REPLACE FUNCTION update_growth_insights() RETURNS VOID AS $$
DECLARE
  insight_record audience_growth_insights%ROWTYPE;
BEGIN
  -- Calculate insights for the last 24 hours
  INSERT INTO audience_growth_insights (
    analysis_period,
    period_start,
    period_end,
    total_posts,
    viral_posts,
    high_engagement_posts,
    follower_converting_posts
  )
  SELECT
    'daily',
    NOW() - INTERVAL '24 hours',
    NOW(),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_viral = true),
    COUNT(*) FILTER (WHERE performance_score > 50),
    COUNT(*) FILTER (WHERE new_followers_attributed > 0)
  FROM tweet_analytics
  WHERE created_at >= NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 9. VIEWS FOR EASY LEARNING ACCESS
-- ===================================================================

-- View for top performing content
CREATE OR REPLACE VIEW top_performing_content AS
SELECT 
  ta.tweet_id,
  ph.content,
  ta.likes,
  ta.retweets,
  ta.replies,
  ta.new_followers_attributed,
  ta.performance_score,
  ph.content_type,
  ph.strategy_used
FROM tweet_analytics ta
JOIN post_history ph ON ta.tweet_id = ph.tweet_id
WHERE ta.performance_score > 0
ORDER BY ta.performance_score DESC;

-- View for content that grows followers
CREATE OR REPLACE VIEW follower_growing_content AS
SELECT 
  ta.tweet_id,
  ph.content,
  ta.new_followers_attributed,
  ta.follower_conversion_rate,
  ph.content_type,
  ph.hook_type,
  ph.call_to_action_type
FROM tweet_analytics ta
JOIN post_history ph ON ta.tweet_id = ph.tweet_id
WHERE ta.new_followers_attributed > 0
ORDER BY ta.new_followers_attributed DESC;

-- View for timing analysis
CREATE OR REPLACE VIEW optimal_timing_analysis AS
SELECT 
  posted_hour,
  posted_day_of_week,
  COUNT(*) as total_posts,
  AVG(performance_score) as avg_performance,
  AVG(new_followers_attributed) as avg_new_followers,
  AVG(engagement_rate) as avg_engagement_rate
FROM tweet_analytics
WHERE posted_hour IS NOT NULL
GROUP BY posted_hour, posted_day_of_week
ORDER BY avg_new_followers DESC, avg_performance DESC;

-- ===================================================================
-- 10. TRIGGERS FOR AUTOMATED UPDATES
-- ===================================================================

-- Trigger to automatically update growth insights daily
CREATE OR REPLACE FUNCTION trigger_daily_insights() RETURNS TRIGGER AS $$
BEGIN
  -- Only run once per day
  IF NOT EXISTS (
    SELECT 1 FROM audience_growth_insights 
    WHERE analysis_period = 'daily' 
    AND period_start >= CURRENT_DATE
  ) THEN
    PERFORM update_growth_insights();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_insights_trigger
  AFTER INSERT ON tweet_analytics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_daily_insights();

-- ===================================================================
-- SUMMARY: This schema provides comprehensive learning capabilities for:
-- 1. Tracking every metric that impacts follower growth
-- 2. Learning what content formats work best
-- 3. Optimizing posting timing
-- 4. Understanding audience behavior
-- 5. Running systematic growth experiments
-- 6. Automatically generating insights and recommendations
-- ===================================================================
-- 🚀 COMPREHENSIVE ANALYTICS ENHANCEMENT MIGRATION
-- ==================================================
-- This migration creates a complete analytics system for tracking tweet performance
-- and building advanced learning algorithms for follower growth optimization
-- Date: 2025-02-01

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. ENHANCED TWEET ANALYTICS TABLE
-- Tracks comprehensive performance data with multiple snapshots over time
-- ===================================================================
CREATE TABLE IF NOT EXISTS tweet_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL REFERENCES tweets(tweet_id) ON DELETE CASCADE,
  
  -- Performance Metrics (collected at different intervals)
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_interval VARCHAR(20) NOT NULL DEFAULT 'initial', -- 'initial', '1h', '6h', '24h', '72h', 'weekly'
  
  -- Core Engagement Data
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  quotes INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  
  -- Reach & Discovery Metrics
  impressions INTEGER DEFAULT 0,
  profile_visits INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  url_clicks INTEGER DEFAULT 0,
  media_views INTEGER DEFAULT 0,
  
  -- Calculated Metrics
  engagement_rate DECIMAL(8,4) DEFAULT 0,
  profile_visit_rate DECIMAL(8,4) DEFAULT 0,
  click_through_rate DECIMAL(8,4) DEFAULT 0,
  
  -- Follower Impact (most important for learning)
  new_followers_attributed INTEGER DEFAULT 0,
  follower_conversion_rate DECIMAL(8,4) DEFAULT 0,
  
  -- Metadata
  collected_via VARCHAR(50) DEFAULT 'api', -- 'api', 'browser', 'estimated'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per tweet per snapshot interval
  UNIQUE(tweet_id, snapshot_interval)
);

-- ===================================================================
-- 2. TWEET CONTENT FEATURES TABLE
-- Stores analyzed features of each tweet for learning algorithms
-- ===================================================================
CREATE TABLE IF NOT EXISTS tweet_content_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL REFERENCES tweets(tweet_id) ON DELETE CASCADE,
  
  -- Content Analysis
  content_type VARCHAR(50) NOT NULL, -- 'single_tip', 'thread', 'poll', 'myth_buster', 'story', 'list'
  tone_profile VARCHAR(50) NOT NULL, -- 'authoritative', 'conversational', 'data_driven', 'urgent', 'casual'
  format_style VARCHAR(50) NOT NULL, -- 'numbered_list', 'bullet_points', 'narrative', 'q_and_a', 'comparison'
  
  -- Content Structure Features
  character_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  sentence_count INTEGER NOT NULL,
  paragraph_count INTEGER NOT NULL,
  
  -- Engagement Elements
  has_question BOOLEAN DEFAULT false,
  has_call_to_action BOOLEAN DEFAULT false,
  has_emoji BOOLEAN DEFAULT false,
  emoji_count INTEGER DEFAULT 0,
  has_hashtags BOOLEAN DEFAULT false,
  hashtag_count INTEGER DEFAULT 0,
  has_mentions BOOLEAN DEFAULT false,
  mention_count INTEGER DEFAULT 0,
  has_media BOOLEAN DEFAULT false,
  has_links BOOLEAN DEFAULT false,
  
  -- Topic & Keywords (extracted via AI)
  primary_topic VARCHAR(100),
  secondary_topics TEXT[], -- Array of related topics
  key_phrases TEXT[], -- Important phrases extracted
  sentiment_score DECIMAL(4,3), -- -1.0 to 1.0
  complexity_score INTEGER, -- 1-10 scale
  
  -- Timing Features
  posted_hour INTEGER NOT NULL, -- 0-23
  posted_day_of_week INTEGER NOT NULL, -- 0-6 (Sunday=0)
  posted_month INTEGER NOT NULL, -- 1-12
  is_weekend BOOLEAN NOT NULL DEFAULT false,
  
  -- AI Analysis Metadata
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
  analysis_confidence DECIMAL(4,3) DEFAULT 0.8,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tweet_id)
);

-- ===================================================================
-- 3. PERFORMANCE SCORING TABLE
-- Calculates and stores performance scores for learning algorithms
-- ===================================================================
CREATE TABLE IF NOT EXISTS tweet_performance_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tweet_id VARCHAR(255) NOT NULL REFERENCES tweets(tweet_id) ON DELETE CASCADE,
  
  -- Performance Score Components (weighted for follower growth)
  follower_score DECIMAL(8,4) DEFAULT 0, -- new_followers * 10 (highest weight)
  engagement_score DECIMAL(8,4) DEFAULT 0, -- (likes + retweets*2 + replies*3 + bookmarks*2)
  reach_score DECIMAL(8,4) DEFAULT 0, -- impressions / 1000
  conversion_score DECIMAL(8,4) DEFAULT 0, -- profile_visits / impressions * 100
  retention_score DECIMAL(8,4) DEFAULT 0, -- detail_expands / impressions * 100
  
  -- Final Composite Score (0-100 scale)
  overall_score DECIMAL(6,3) DEFAULT 0,
  
  -- Score Calculation Metadata
  scoring_algorithm_version VARCHAR(20) DEFAULT 'v1.0',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  data_freshness_hours INTEGER DEFAULT 0, -- How old the analytics data was
  
  -- Performance Ranking
  percentile_rank DECIMAL(5,2), -- Percentile rank among all tweets (updated daily)
  is_top_performer BOOLEAN DEFAULT false, -- Top 20% of tweets
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tweet_id)
);

-- ===================================================================
-- 4. LEARNING PATTERNS TABLE
-- Stores discovered patterns that correlate with high performance
-- ===================================================================
CREATE TABLE IF NOT EXISTS learning_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Pattern Definition
  pattern_type VARCHAR(50) NOT NULL, -- 'content_type', 'timing', 'format', 'tone', 'topic'
  pattern_name VARCHAR(100) NOT NULL,
  pattern_description TEXT,
  
  -- Pattern Features (JSONB for flexible storage)
  pattern_features JSONB NOT NULL,
  
  -- Performance Data
  sample_size INTEGER NOT NULL, -- Number of tweets this pattern was found in
  avg_performance_score DECIMAL(6,3) NOT NULL,
  avg_follower_growth DECIMAL(6,3) NOT NULL,
  confidence_level DECIMAL(4,3) NOT NULL, -- Statistical confidence (0-1)
  
  -- Pattern Validation
  validation_status VARCHAR(20) DEFAULT 'active', -- 'active', 'testing', 'deprecated'
  last_validated TIMESTAMPTZ DEFAULT NOW(),
  validation_sample_size INTEGER DEFAULT 0,
  validation_success_rate DECIMAL(4,3) DEFAULT 0,
  
  -- Pattern Application
  times_applied INTEGER DEFAULT 0,
  successful_applications INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(pattern_type, pattern_name)
);

-- ===================================================================
-- 5. DAILY PERFORMANCE SUMMARY TABLE
-- Aggregated daily stats for dashboard and trending analysis
-- ===================================================================
CREATE TABLE IF NOT EXISTS daily_performance_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  summary_date DATE NOT NULL,
  
  -- Tweet Volume
  total_tweets INTEGER DEFAULT 0,
  successful_posts INTEGER DEFAULT 0,
  failed_posts INTEGER DEFAULT 0,
  
  -- Engagement Aggregates
  total_likes INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_bookmarks INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_profile_visits INTEGER DEFAULT 0,
  
  -- Growth Metrics
  new_followers INTEGER DEFAULT 0,
  follower_growth_rate DECIMAL(6,3) DEFAULT 0,
  avg_engagement_rate DECIMAL(6,3) DEFAULT 0,
  
  -- Performance Analysis
  best_performing_tweet_id VARCHAR(255),
  best_tweet_score DECIMAL(6,3) DEFAULT 0,
  avg_performance_score DECIMAL(6,3) DEFAULT 0,
  
  -- Learning Insights
  dominant_content_type VARCHAR(50),
  optimal_posting_hour INTEGER,
  top_performing_topic VARCHAR(100),
  
  -- Cost Analysis
  ai_cost_usd DECIMAL(8,4) DEFAULT 0,
  cost_per_follower DECIMAL(8,4) DEFAULT 0,
  cost_per_engagement DECIMAL(8,4) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(summary_date)
);

-- ===================================================================
-- 6. REAL-TIME TREND TRACKING TABLE
-- Tracks trending topics and their correlation with performance
-- ===================================================================
CREATE TABLE IF NOT EXISTS trend_performance_correlation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Trend Data
  trend_keyword VARCHAR(100) NOT NULL,
  trend_source VARCHAR(50) NOT NULL, -- 'twitter', 'google', 'news', 'manual'
  trend_strength INTEGER DEFAULT 1, -- 1-10 scale
  trend_detected_at TIMESTAMPTZ NOT NULL,
  
  -- Performance When Using This Trend
  tweets_using_trend INTEGER DEFAULT 0,
  avg_performance_boost DECIMAL(6,3) DEFAULT 0,
  follower_conversion_boost DECIMAL(6,3) DEFAULT 0,
  
  -- Trend Lifecycle
  trend_status VARCHAR(20) DEFAULT 'active', -- 'active', 'declining', 'expired'
  peak_performance_date DATE,
  last_used_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(trend_keyword, trend_source)
);

-- ===================================================================
-- 7. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ===================================================================

-- Tweet Analytics Indexes
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_snapshot_time ON tweet_analytics(snapshot_time);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_snapshot_interval ON tweet_analytics(snapshot_interval);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_new_followers ON tweet_analytics(new_followers_attributed DESC);

-- Content Features Indexes
CREATE INDEX IF NOT EXISTS idx_tweet_content_features_content_type ON tweet_content_features(content_type);
CREATE INDEX IF NOT EXISTS idx_tweet_content_features_tone_profile ON tweet_content_features(tone_profile);
CREATE INDEX IF NOT EXISTS idx_tweet_content_features_posted_hour ON tweet_content_features(posted_hour);
CREATE INDEX IF NOT EXISTS idx_tweet_content_features_primary_topic ON tweet_content_features(primary_topic);

-- Performance Scores Indexes
CREATE INDEX IF NOT EXISTS idx_tweet_performance_scores_overall_score ON tweet_performance_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_scores_is_top_performer ON tweet_performance_scores(is_top_performer);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_scores_calculated_at ON tweet_performance_scores(calculated_at);

-- Learning Patterns Indexes
CREATE INDEX IF NOT EXISTS idx_learning_patterns_pattern_type ON learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_avg_performance ON learning_patterns(avg_performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_validation_status ON learning_patterns(validation_status);

-- Daily Summary Indexes
CREATE INDEX IF NOT EXISTS idx_daily_performance_summary_date ON daily_performance_summary(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_performance_summary_new_followers ON daily_performance_summary(new_followers DESC);

-- Trend Correlation Indexes
CREATE INDEX IF NOT EXISTS idx_trend_performance_trend_status ON trend_performance_correlation(trend_status);
CREATE INDEX IF NOT EXISTS idx_trend_performance_detected_at ON trend_performance_correlation(trend_detected_at DESC);

-- ===================================================================
-- 8. FUNCTIONS FOR AUTOMATED CALCULATIONS
-- ===================================================================

-- Function to calculate overall performance score
CREATE OR REPLACE FUNCTION calculate_performance_score(
  p_new_followers INTEGER,
  p_likes INTEGER,
  p_retweets INTEGER,
  p_replies INTEGER,
  p_bookmarks INTEGER,
  p_impressions INTEGER,
  p_profile_visits INTEGER,
  p_detail_expands INTEGER
) RETURNS DECIMAL(6,3) AS $$
DECLARE
  follower_score DECIMAL(8,4);
  engagement_score DECIMAL(8,4);
  reach_score DECIMAL(8,4);
  conversion_score DECIMAL(8,4);
  retention_score DECIMAL(8,4);
  final_score DECIMAL(8,4);
BEGIN
  -- Follower score (highest weight - this is our primary goal)
  follower_score := COALESCE(p_new_followers, 0) * 10.0;
  
  -- Engagement score (weighted by engagement type value)
  engagement_score := (
    COALESCE(p_likes, 0) * 1.0 +
    COALESCE(p_retweets, 0) * 2.0 +
    COALESCE(p_replies, 0) * 3.0 +
    COALESCE(p_bookmarks, 0) * 2.5
  ) / 10.0;
  
  -- Reach score (normalized)
  reach_score := COALESCE(p_impressions, 0) / 1000.0;
  
  -- Conversion score (profile visits / impressions * 100)
  IF COALESCE(p_impressions, 0) > 0 THEN
    conversion_score := (COALESCE(p_profile_visits, 0)::DECIMAL / p_impressions) * 100.0;
  ELSE
    conversion_score := 0;
  END IF;
  
  -- Retention score (detail expands / impressions * 100)
  IF COALESCE(p_impressions, 0) > 0 THEN
    retention_score := (COALESCE(p_detail_expands, 0)::DECIMAL / p_impressions) * 100.0;
  ELSE
    retention_score := 0;
  END IF;
  
  -- Final weighted score (focus on follower growth)
  final_score := (
    follower_score * 0.5 +      -- 50% weight on new followers
    engagement_score * 0.25 +   -- 25% weight on engagement
    conversion_score * 0.15 +   -- 15% weight on profile visits
    retention_score * 0.1       -- 10% weight on detail expands
  );
  
  -- Cap at 100
  RETURN LEAST(final_score, 100.0);
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 9. AUTOMATED TRIGGERS
-- ===================================================================

-- Function to update performance scores when analytics data changes
CREATE OR REPLACE FUNCTION update_performance_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update for non-initial snapshots (we want mature data)
  IF NEW.snapshot_interval IN ('24h', '72h', 'weekly') THEN
    INSERT INTO tweet_performance_scores (
      tweet_id,
      follower_score,
      engagement_score,
      reach_score,
      conversion_score,
      retention_score,
      overall_score,
      data_freshness_hours
    )
    VALUES (
      NEW.tweet_id,
      COALESCE(NEW.new_followers_attributed, 0) * 10.0,
      (COALESCE(NEW.likes, 0) + COALESCE(NEW.retweets, 0) * 2 + COALESCE(NEW.replies, 0) * 3 + COALESCE(NEW.bookmarks, 0) * 2) / 10.0,
      COALESCE(NEW.impressions, 0) / 1000.0,
      CASE WHEN COALESCE(NEW.impressions, 0) > 0 THEN (COALESCE(NEW.profile_visits, 0)::DECIMAL / NEW.impressions) * 100.0 ELSE 0 END,
      CASE WHEN COALESCE(NEW.impressions, 0) > 0 THEN (COALESCE(NEW.detail_expands, 0)::DECIMAL / NEW.impressions) * 100.0 ELSE 0 END,
      calculate_performance_score(
        NEW.new_followers_attributed,
        NEW.likes,
        NEW.retweets,
        NEW.replies,
        NEW.bookmarks,
        NEW.impressions,
        NEW.profile_visits,
        NEW.detail_expands
      ),
      EXTRACT(EPOCH FROM (NOW() - NEW.snapshot_time)) / 3600 -- Hours since data collection
    )
    ON CONFLICT (tweet_id) DO UPDATE SET
      follower_score = EXCLUDED.follower_score,
      engagement_score = EXCLUDED.engagement_score,
      reach_score = EXCLUDED.reach_score,
      conversion_score = EXCLUDED.conversion_score,
      retention_score = EXCLUDED.retention_score,
      overall_score = EXCLUDED.overall_score,
      data_freshness_hours = EXCLUDED.data_freshness_hours,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_performance_score ON tweet_analytics;
CREATE TRIGGER trigger_update_performance_score
  AFTER INSERT OR UPDATE ON tweet_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_score();

-- ===================================================================
-- 10. INITIAL DATA SETUP
-- ===================================================================

-- Add feature flags for new analytics system
INSERT INTO bot_config (key, value) VALUES 
  ('ENABLE_ENHANCED_ANALYTICS', 'true'),
  ('ANALYTICS_COLLECTION_FREQUENCY', '{"initial": 0, "1h": 3600, "6h": 21600, "24h": 86400, "72h": 259200}'),
  ('ENABLE_BROWSER_ANALYTICS_COLLECTION', 'true'),
  ('ANALYTICS_DASHBOARD_ENABLED', 'true'),
  ('LEARNING_PATTERN_MIN_SAMPLE_SIZE', '10'),
  ('PERFORMANCE_SCORE_ALGORITHM_VERSION', 'v1.0')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- MIGRATION COMPLETE
-- ===================================================================
-- This migration adds comprehensive analytics tracking that will enable:
-- 1. Real-time performance monitoring
-- 2. Advanced learning algorithms focused on follower growth
-- 3. Pattern recognition for optimal content characteristics
-- 4. Trend correlation analysis
-- 5. Cost-effectiveness tracking
-- 6. Automated performance scoring and ranking
-- ===================================================================
/**
 * 🧠 INTELLIGENT GROWTH ENGINE DATABASE SCHEMA
 * Advanced analytics and learning tables for autonomous Twitter optimization
 */

-- ================================================================
-- 1. ADAPTIVE POSTING FREQUENCY ANALYTICS
-- ================================================================

CREATE TABLE IF NOT EXISTS posting_time_analytics (
  id BIGSERIAL PRIMARY KEY,
  hour_slot INTEGER NOT NULL CHECK (hour_slot >= 0 AND hour_slot <= 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  avg_likes DECIMAL(10,2) DEFAULT 0,
  avg_impressions DECIMAL(10,2) DEFAULT 0,
  avg_replies DECIMAL(10,2) DEFAULT 0,
  avg_retweets DECIMAL(10,2) DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  follower_conversion_rate DECIMAL(5,4) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  performance_score DECIMAL(5,2) DEFAULT 0,
  UNIQUE(hour_slot, day_of_week)
);

CREATE INDEX idx_posting_time_performance ON posting_time_analytics(performance_score DESC);
CREATE INDEX idx_posting_time_hour ON posting_time_analytics(hour_slot);

-- ================================================================
-- 2. TOPIC PERFORMANCE TRACKING
-- ================================================================

CREATE TABLE IF NOT EXISTS topic_performance_analytics (
  id BIGSERIAL PRIMARY KEY,
  topic_name VARCHAR(100) NOT NULL,
  topic_category VARCHAR(50) NOT NULL,
  total_posts INTEGER DEFAULT 0,
  avg_likes DECIMAL(10,2) DEFAULT 0,
  avg_impressions DECIMAL(10,2) DEFAULT 0,
  avg_replies DECIMAL(10,2) DEFAULT 0,
  avg_retweets DECIMAL(10,2) DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  follower_gain_correlation DECIMAL(5,4) DEFAULT 0,
  viral_potential_score DECIMAL(5,2) DEFAULT 0,
  content_saturation_level DECIMAL(5,4) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trending_momentum DECIMAL(5,2) DEFAULT 0,
  priority_weight DECIMAL(5,4) DEFAULT 0.5,
  UNIQUE(topic_name)
);

CREATE INDEX idx_topic_priority ON topic_performance_analytics(priority_weight DESC);
CREATE INDEX idx_topic_viral_score ON topic_performance_analytics(viral_potential_score DESC);

-- ================================================================
-- 3. INFLUENCER ENGAGEMENT INTELLIGENCE
-- ================================================================

CREATE TABLE IF NOT EXISTS influencer_engagement_log (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  twitter_id VARCHAR(50),
  follower_count INTEGER DEFAULT 0,
  engagement_actions JSONB DEFAULT '{}',
  our_interactions INTEGER DEFAULT 0,
  their_responses INTEGER DEFAULT 0,
  response_rate DECIMAL(5,4) DEFAULT 0,
  avg_response_time_hours INTEGER DEFAULT 0,
  influence_score DECIMAL(5,2) DEFAULT 0,
  engagement_value DECIMAL(5,2) DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE,
  interaction_success_rate DECIMAL(5,4) DEFAULT 0,
  follower_overlap_potential DECIMAL(5,4) DEFAULT 0,
  priority_tier INTEGER DEFAULT 3 CHECK (priority_tier >= 1 AND priority_tier <= 5),
  engagement_strategy JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(username)
);

CREATE INDEX idx_influencer_priority ON influencer_engagement_log(priority_tier, engagement_value DESC);
CREATE INDEX idx_influencer_response_rate ON influencer_engagement_log(response_rate DESC);

-- ================================================================
-- 4. REPLY STRATEGY & VIRAL DETECTION
-- ================================================================

CREATE TABLE IF NOT EXISTS viral_reply_opportunities (
  id BIGSERIAL PRIMARY KEY,
  target_tweet_id VARCHAR(50) NOT NULL,
  target_username VARCHAR(50) NOT NULL,
  tweet_content TEXT NOT NULL,
  engagement_metrics JSONB DEFAULT '{}',
  viral_score DECIMAL(5,2) DEFAULT 0,
  relevance_score DECIMAL(5,2) DEFAULT 0,
  competition_level DECIMAL(5,2) DEFAULT 0,
  optimal_reply_timing TIMESTAMP WITH TIME ZONE,
  reply_strategy JSONB DEFAULT '{}',
  attempted_reply BOOLEAN DEFAULT FALSE,
  reply_success BOOLEAN DEFAULT FALSE,
  our_reply_performance JSONB DEFAULT '{}',
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_viral_opportunities ON viral_reply_opportunities(viral_score DESC, attempted_reply);
CREATE INDEX idx_reply_timing ON viral_reply_opportunities(optimal_reply_timing);

-- ================================================================
-- 5. CONTENT FORMAT LEARNING
-- ================================================================

CREATE TABLE IF NOT EXISTS content_format_analytics (
  id BIGSERIAL PRIMARY KEY,
  format_type VARCHAR(50) NOT NULL,
  format_pattern TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  avg_performance_score DECIMAL(5,2) DEFAULT 0,
  avg_likes DECIMAL(10,2) DEFAULT 0,
  avg_impressions DECIMAL(10,2) DEFAULT 0,
  avg_engagement_rate DECIMAL(5,4) DEFAULT 0,
  viral_hit_rate DECIMAL(5,4) DEFAULT 0,
  follower_conversion_rate DECIMAL(5,4) DEFAULT 0,
  format_effectiveness DECIMAL(5,2) DEFAULT 0,
  optimal_topics JSONB DEFAULT '[]',
  best_timing_hours JSONB DEFAULT '[]',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trend_momentum DECIMAL(5,2) DEFAULT 0,
  UNIQUE(format_type, format_pattern)
);

CREATE INDEX idx_format_effectiveness ON content_format_analytics(format_effectiveness DESC);
CREATE INDEX idx_format_viral_rate ON content_format_analytics(viral_hit_rate DESC);

-- ================================================================
-- 6. DAILY STRATEGY OPTIMIZATION
-- ================================================================

CREATE TABLE IF NOT EXISTS daily_growth_strategy (
  id BIGSERIAL PRIMARY KEY,
  strategy_date DATE NOT NULL DEFAULT CURRENT_DATE,
  optimal_posting_schedule JSONB NOT NULL DEFAULT '{}',
  priority_topics JSONB NOT NULL DEFAULT '[]',
  target_influencers JSONB NOT NULL DEFAULT '[]',
  content_format_weights JSONB NOT NULL DEFAULT '{}',
  engagement_targets JSONB NOT NULL DEFAULT '{}',
  budget_allocation JSONB NOT NULL DEFAULT '{}',
  performance_targets JSONB NOT NULL DEFAULT '{}',
  strategy_reasoning TEXT,
  implementation_status VARCHAR(20) DEFAULT 'pending',
  actual_performance JSONB DEFAULT '{}',
  strategy_effectiveness DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(strategy_date)
);

CREATE INDEX idx_strategy_date ON daily_growth_strategy(strategy_date DESC);
CREATE INDEX idx_strategy_effectiveness ON daily_growth_strategy(strategy_effectiveness DESC);

-- ================================================================
-- 7. COMPREHENSIVE PERFORMANCE TRACKING
-- ================================================================

CREATE TABLE IF NOT EXISTS hourly_performance_metrics (
  id BIGSERIAL PRIMARY KEY,
  recorded_hour TIMESTAMP WITH TIME ZONE NOT NULL,
  total_followers INTEGER DEFAULT 0,
  follower_change INTEGER DEFAULT 0,
  total_posts_today INTEGER DEFAULT 0,
  engagement_rate_24h DECIMAL(5,4) DEFAULT 0,
  viral_tweets_count INTEGER DEFAULT 0,
  top_performing_topic VARCHAR(100),
  best_engagement_time INTEGER,
  budget_spent_usd DECIMAL(6,2) DEFAULT 0,
  roi_score DECIMAL(5,2) DEFAULT 0,
  growth_velocity DECIMAL(5,2) DEFAULT 0,
  strategy_adherence DECIMAL(5,4) DEFAULT 0,
  anomalies_detected JSONB DEFAULT '[]',
  optimization_opportunities JSONB DEFAULT '[]',
  UNIQUE(recorded_hour)
);

CREATE INDEX idx_hourly_metrics_time ON hourly_performance_metrics(recorded_hour DESC);
CREATE INDEX idx_growth_velocity ON hourly_performance_metrics(growth_velocity DESC);

-- ================================================================
-- 8. LEARNING SYSTEM INSIGHTS
-- ================================================================

CREATE TABLE IF NOT EXISTS ai_learning_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_type VARCHAR(50) NOT NULL,
  insight_category VARCHAR(50) NOT NULL,
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(5,4) NOT NULL,
  supporting_evidence JSONB DEFAULT '{}',
  actionable_recommendations JSONB DEFAULT '[]',
  implementation_priority INTEGER DEFAULT 3 CHECK (implementation_priority >= 1 AND implementation_priority <= 5),
  validation_status VARCHAR(20) DEFAULT 'pending',
  performance_impact DECIMAL(5,2) DEFAULT 0,
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_validated TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_learning_insights_priority ON ai_learning_insights(implementation_priority, confidence_score DESC);
CREATE INDEX idx_learning_insights_category ON ai_learning_insights(insight_category, discovered_at DESC);

-- ================================================================
-- 9. ENHANCED TWEET PERFORMANCE TABLE (extend existing)
-- ================================================================

-- Add new columns to existing tweets table if they don't exist
DO $$
BEGIN
  -- Add performance tracking columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'hour_posted') THEN
    ALTER TABLE tweets ADD COLUMN hour_posted INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'day_of_week') THEN
    ALTER TABLE tweets ADD COLUMN day_of_week INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'topic_category') THEN
    ALTER TABLE tweets ADD COLUMN topic_category VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'content_format') THEN
    ALTER TABLE tweets ADD COLUMN content_format VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'engagement_rate') THEN
    ALTER TABLE tweets ADD COLUMN engagement_rate DECIMAL(5,4) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'viral_score') THEN
    ALTER TABLE tweets ADD COLUMN viral_score DECIMAL(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'follower_impact') THEN
    ALTER TABLE tweets ADD COLUMN follower_impact INTEGER DEFAULT 0;
  END IF;
END $$;

-- ================================================================
-- 10. STORED PROCEDURES FOR INTELLIGENCE OPERATIONS
-- ================================================================

-- Function to calculate optimal posting times
CREATE OR REPLACE FUNCTION calculate_optimal_posting_schedule()
RETURNS JSONB AS $$
DECLARE
  optimal_schedule JSONB := '{}';
  hour_data RECORD;
BEGIN
  -- Calculate best hours based on engagement rates
  FOR hour_data IN 
    SELECT 
      hour_slot,
      performance_score,
      engagement_rate,
      ROW_NUMBER() OVER (ORDER BY performance_score DESC) as rank
    FROM posting_time_analytics 
    WHERE total_posts >= 3
    ORDER BY performance_score DESC
    LIMIT 10
  LOOP
    optimal_schedule := optimal_schedule || jsonb_build_object(
      hour_data.hour_slot::text, 
      jsonb_build_object(
        'score', hour_data.performance_score,
        'engagement_rate', hour_data.engagement_rate,
        'priority', hour_data.rank
      )
    );
  END LOOP;
  
  RETURN optimal_schedule;
END;
$$ LANGUAGE plpgsql;

-- Function to get top-performing topics
CREATE OR REPLACE FUNCTION get_priority_topics(limit_count INTEGER DEFAULT 10)
RETURNS JSONB AS $$
DECLARE
  topics JSONB := '[]';
  topic_data RECORD;
BEGIN
  FOR topic_data IN 
    SELECT 
      topic_name,
      priority_weight,
      viral_potential_score,
      engagement_rate
    FROM topic_performance_analytics 
    ORDER BY priority_weight DESC, viral_potential_score DESC
    LIMIT limit_count
  LOOP
    topics := topics || jsonb_build_object(
      'topic', topic_data.topic_name,
      'weight', topic_data.priority_weight,
      'viral_score', topic_data.viral_potential_score,
      'engagement_rate', topic_data.engagement_rate
    );
  END LOOP;
  
  RETURN topics;
END;
$$ LANGUAGE plpgsql;

-- Function to identify high-value influencers
CREATE OR REPLACE FUNCTION get_target_influencers(tier_limit INTEGER DEFAULT 2)
RETURNS JSONB AS $$
DECLARE
  influencers JSONB := '[]';
  influencer_data RECORD;
BEGIN
  FOR influencer_data IN 
    SELECT 
      username,
      engagement_value,
      response_rate,
      priority_tier,
      follower_count
    FROM influencer_engagement_log 
    WHERE priority_tier <= tier_limit
    ORDER BY engagement_value DESC, response_rate DESC
    LIMIT 20
  LOOP
    influencers := influencers || jsonb_build_object(
      'username', influencer_data.username,
      'value_score', influencer_data.engagement_value,
      'response_rate', influencer_data.response_rate,
      'tier', influencer_data.priority_tier,
      'followers', influencer_data.follower_count
    );
  END LOOP;
  
  RETURN influencers;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 11. SAMPLE DATA INITIALIZATION
-- ================================================================

-- Initialize with basic health topics
INSERT INTO topic_performance_analytics (topic_name, topic_category, priority_weight) VALUES
  ('gut_health', 'health', 0.8),
  ('immune_system', 'health', 0.75),
  ('nutrition_myths', 'health', 0.7),
  ('exercise_science', 'fitness', 0.65),
  ('mental_health', 'wellness', 0.6),
  ('sleep_optimization', 'wellness', 0.6),
  ('supplements', 'health', 0.55),
  ('longevity', 'health', 0.5),
  ('biohacking', 'wellness', 0.45),
  ('hydration', 'health', 0.4)
ON CONFLICT (topic_name) DO NOTHING;

-- Initialize common content formats
INSERT INTO content_format_analytics (format_type, format_pattern, format_effectiveness) VALUES
  ('breaking_news', 'BREAKING: {fact}', 7.5),
  ('myth_buster', 'You''ve been lied to about {topic}...', 8.2),
  ('how_to', 'Here''s how to {action} in {timeframe}:', 6.8),
  ('shocking_fact', 'This will shock you: {fact}', 7.9),
  ('personal_story', 'I used to {problem} until I discovered {solution}', 6.5),
  ('list_format', '{number} {topic} that will {benefit}:', 7.1),
  ('question_hook', 'Why do {percentage}% of people {action}?', 6.9),
  ('contrarian', 'Everyone says {common_belief}. They''re wrong.', 8.0)
ON CONFLICT (format_type, format_pattern) DO NOTHING;

-- Initialize sample influencer targets
INSERT INTO influencer_engagement_log (username, follower_count, priority_tier, engagement_value) VALUES
  ('hubermanlab', 2500000, 1, 9.5),
  ('drmarkhyman', 1200000, 1, 8.8),
  ('peterattiamd', 800000, 1, 9.2),
  ('bengreenfield', 400000, 2, 7.5),
  ('drrhondapatrick', 600000, 1, 8.9),
  ('theliverfactor', 150000, 2, 7.0),
  ('drdavinagha', 300000, 2, 7.2),
  ('drjasonchung', 100000, 3, 6.5)
ON CONFLICT (username) DO NOTHING;

-- ================================================================

RAISE NOTICE 'Intelligent Growth Engine database schema created successfully!';
RAISE NOTICE 'Tables created: posting_time_analytics, topic_performance_analytics, influencer_engagement_log';
RAISE NOTICE 'Advanced features: viral_reply_opportunities, content_format_analytics, daily_growth_strategy';
RAISE NOTICE 'Analytics: hourly_performance_metrics, ai_learning_insights';
RAISE NOTICE 'Stored procedures: calculate_optimal_posting_schedule, get_priority_topics, get_target_influencers'; 
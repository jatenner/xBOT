-- 🚀 TWITTER ALGORITHM INTELLIGENCE DATABASE SCHEMA
-- Stores all data needed for algorithm analysis and optimization

-- Algorithm signals detection
CREATE TABLE IF NOT EXISTS algorithm_signals (
  id BIGSERIAL PRIMARY KEY,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('engagement_boost', 'reach_throttle', 'viral_trigger', 'shadow_ban', 'trend_amplification')),
  signal_strength FLOAT NOT NULL CHECK (signal_strength >= 0 AND signal_strength <= 1),
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  associated_content TEXT,
  metrics JSONB NOT NULL DEFAULT '{}',
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Viral content patterns
CREATE TABLE IF NOT EXISTS viral_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_id TEXT UNIQUE NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('hook_structure', 'controversy_level', 'timing_window', 'hashtag_combo', 'thread_format')),
  pattern_elements TEXT[] NOT NULL,
  success_rate FLOAT NOT NULL CHECK (success_rate >= 0 AND success_rate <= 1),
  avg_engagement FLOAT NOT NULL DEFAULT 0,
  follower_conversion_rate FLOAT NOT NULL DEFAULT 0,
  examples TEXT[] NOT NULL DEFAULT '{}',
  optimal_conditions JSONB NOT NULL DEFAULT '{}',
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Follower acquisition triggers
CREATE TABLE IF NOT EXISTS follower_triggers (
  id BIGSERIAL PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('authority_display', 'controversy_take', 'value_delivery', 'community_building', 'fomo_creation')),
  trigger_strength FLOAT NOT NULL CHECK (trigger_strength >= 0 AND trigger_strength <= 1),
  conversion_rate FLOAT NOT NULL CHECK (conversion_rate >= 0 AND conversion_rate <= 1),
  optimal_usage TEXT NOT NULL,
  examples TEXT[] NOT NULL DEFAULT '{}',
  psychological_mechanism TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Algorithm insights and recommendations
CREATE TABLE IF NOT EXISTS algorithm_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('posting_optimization', 'content_strategy', 'engagement_tactics', 'follower_acquisition')),
  recommendation TEXT NOT NULL,
  expected_impact FLOAT NOT NULL DEFAULT 0, -- Expected percentage improvement
  confidence_level FLOAT NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 1),
  implementation_priority TEXT NOT NULL CHECK (implementation_priority IN ('immediate', 'high', 'medium', 'low')),
  supporting_data JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  implemented_at TIMESTAMP WITH TIME ZONE,
  actual_impact FLOAT -- Measured impact after implementation
);

-- Real-time engagement tracking for velocity analysis
CREATE TABLE IF NOT EXISTS engagement_velocity_tracking (
  id BIGSERIAL PRIMARY KEY,
  tweet_id BIGINT NOT NULL,
  tracked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  likes_count INT NOT NULL DEFAULT 0,
  retweets_count INT NOT NULL DEFAULT 0,
  replies_count INT NOT NULL DEFAULT 0,
  impressions_count BIGINT,
  minutes_since_posting INT NOT NULL,
  velocity_score FLOAT, -- Calculated engagement velocity
  viral_probability FLOAT -- Predicted viral probability
);

-- Competitor analysis data
CREATE TABLE IF NOT EXISTS competitor_analysis (
  id BIGSERIAL PRIMARY KEY,
  competitor_handle TEXT NOT NULL,
  tweet_content TEXT NOT NULL,
  likes_count INT NOT NULL DEFAULT 0,
  retweets_count INT NOT NULL DEFAULT 0,
  replies_count INT NOT NULL DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content_category TEXT,
  viral_elements JSONB DEFAULT '{}',
  engagement_rate FLOAT,
  follower_gain_estimate INT DEFAULT 0
);

-- Trending topics in health/wellness
CREATE TABLE IF NOT EXISTS health_trending_topics (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  trend_strength FLOAT NOT NULL CHECK (trend_strength >= 0 AND trend_strength <= 1),
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL, -- 'twitter_api', 'google_trends', 'news_api', etc.
  related_keywords TEXT[] DEFAULT '{}',
  opportunity_score FLOAT, -- How well this aligns with our niche
  content_suggestions TEXT[] DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Follower psychology profiles
CREATE TABLE IF NOT EXISTS follower_psychology_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT, -- Twitter user ID if available
  follower_segment TEXT NOT NULL, -- 'health_enthusiasts', 'fitness_focused', 'diet_seekers', etc.
  trigger_preferences JSONB NOT NULL DEFAULT '{}', -- What makes them follow
  content_preferences JSONB NOT NULL DEFAULT '{}', -- What content they engage with
  optimal_timing JSONB NOT NULL DEFAULT '{}', -- When they're most active
  psychological_drivers TEXT[] DEFAULT '{}', -- Authority, community, controversy, etc.
  conversion_probability FLOAT,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content performance predictions
CREATE TABLE IF NOT EXISTS content_performance_predictions (
  id BIGSERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  content_preview TEXT NOT NULL,
  predicted_likes INT NOT NULL DEFAULT 0,
  predicted_retweets INT NOT NULL DEFAULT 0,
  predicted_follower_gain INT NOT NULL DEFAULT 0,
  viral_probability FLOAT NOT NULL CHECK (viral_probability >= 0 AND viral_probability <= 1),
  optimal_posting_time TIMESTAMP WITH TIME ZONE,
  confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  prediction_model_version TEXT NOT NULL,
  predicted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actual_likes INT, -- Filled after posting
  actual_retweets INT,
  actual_follower_gain INT,
  prediction_accuracy FLOAT -- Calculated after results come in
);

-- Algorithm A/B testing results
CREATE TABLE IF NOT EXISTS algorithm_ab_tests (
  id BIGSERIAL PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_variant TEXT NOT NULL, -- 'control', 'variant_a', 'variant_b', etc.
  content_strategy JSONB NOT NULL,
  posts_count INT NOT NULL DEFAULT 0,
  total_likes INT NOT NULL DEFAULT 0,
  total_retweets INT NOT NULL DEFAULT 0,
  total_followers_gained INT NOT NULL DEFAULT 0,
  avg_engagement_rate FLOAT,
  statistical_significance FLOAT,
  test_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  test_end_date TIMESTAMP WITH TIME ZONE,
  winner BOOLEAN DEFAULT FALSE,
  insights TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_algorithm_signals_type_date ON algorithm_signals(signal_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_success_rate ON viral_patterns(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_follower_triggers_conversion ON follower_triggers(conversion_rate DESC);
CREATE INDEX IF NOT EXISTS idx_algorithm_insights_priority ON algorithm_insights(implementation_priority, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_velocity_tweet ON engagement_velocity_tracking(tweet_id, tracked_at);
CREATE INDEX IF NOT EXISTS idx_competitor_analysis_handle_date ON competitor_analysis(competitor_handle, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_strength ON health_trending_topics(trend_strength DESC, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_predictions_viral ON content_performance_predictions(viral_probability DESC, predicted_at DESC);

-- Views for quick analysis
CREATE OR REPLACE VIEW algorithm_performance_summary AS
SELECT 
  DATE(detected_at) as analysis_date,
  signal_type,
  COUNT(*) as signal_count,
  AVG(signal_strength) as avg_strength,
  AVG(confidence) as avg_confidence
FROM algorithm_signals 
WHERE detected_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(detected_at), signal_type
ORDER BY analysis_date DESC, signal_count DESC;

CREATE OR REPLACE VIEW top_viral_patterns AS
SELECT 
  pattern_type,
  pattern_elements,
  success_rate,
  avg_engagement,
  follower_conversion_rate,
  analyzed_at
FROM viral_patterns 
ORDER BY success_rate DESC, avg_engagement DESC
LIMIT 10;

CREATE OR REPLACE VIEW recent_algorithm_insights AS
SELECT 
  insight_type,
  recommendation,
  expected_impact,
  confidence_level,
  implementation_priority,
  generated_at
FROM algorithm_insights 
WHERE generated_at >= NOW() - INTERVAL '7 days'
ORDER BY 
  CASE implementation_priority 
    WHEN 'immediate' THEN 1
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  confidence_level DESC;

-- Functions for real-time analysis
CREATE OR REPLACE FUNCTION calculate_engagement_velocity(p_tweet_id BIGINT)
RETURNS FLOAT AS $$
DECLARE
  v_velocity FLOAT := 0;
  v_latest_likes INT;
  v_latest_retweets INT;
  v_minutes_elapsed INT;
BEGIN
  SELECT 
    likes_count, 
    retweets_count, 
    minutes_since_posting 
  INTO v_latest_likes, v_latest_retweets, v_minutes_elapsed
  FROM engagement_velocity_tracking 
  WHERE tweet_id = p_tweet_id 
  ORDER BY tracked_at DESC 
  LIMIT 1;
  
  IF v_minutes_elapsed > 0 THEN
    v_velocity := (v_latest_likes + v_latest_retweets * 2.0) / v_minutes_elapsed;
  END IF;
  
  RETURN v_velocity;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION predict_viral_probability(p_tweet_id BIGINT)
RETURNS FLOAT AS $$
DECLARE
  v_velocity FLOAT;
  v_probability FLOAT := 0;
BEGIN
  v_velocity := calculate_engagement_velocity(p_tweet_id);
  
  -- Simple viral prediction based on early velocity
  -- In production, this would use a trained ML model
  CASE 
    WHEN v_velocity >= 5.0 THEN v_probability := 0.9;
    WHEN v_velocity >= 2.0 THEN v_probability := 0.7;
    WHEN v_velocity >= 1.0 THEN v_probability := 0.5;
    WHEN v_velocity >= 0.5 THEN v_probability := 0.3;
    ELSE v_probability := 0.1;
  END CASE;
  
  RETURN v_probability;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate velocity scores
CREATE OR REPLACE FUNCTION update_velocity_scores()
RETURNS TRIGGER AS $$
BEGIN
  NEW.velocity_score := calculate_engagement_velocity(NEW.tweet_id);
  NEW.viral_probability := predict_viral_probability(NEW.tweet_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_velocity_scores
  BEFORE INSERT OR UPDATE ON engagement_velocity_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_velocity_scores();

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;
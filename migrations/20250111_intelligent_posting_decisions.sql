-- Intelligent Posting Decisions Tracking
-- Track the AI's decision-making process and outcomes

-- Table to track posting decisions
CREATE TABLE IF NOT EXISTS decision_outcomes (
  id BIGSERIAL PRIMARY KEY,
  decision_strategy TEXT NOT NULL, -- 'immediate', 'wait_optimal', 'wait_spacing', etc.
  decision_reason TEXT NOT NULL,
  decision_confidence DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
  success BOOLEAN NOT NULL,
  result_data JSONB,
  expected_likes INTEGER,
  expected_retweets INTEGER,
  expected_replies INTEGER,
  expected_viral_potential DECIMAL(3,2),
  actual_likes INTEGER DEFAULT 0,
  actual_retweets INTEGER DEFAULT 0,
  actual_replies INTEGER DEFAULT 0,
  content_guidance JSONB,
  wait_time_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tweet_id TEXT -- Reference to the actual tweet if posted
);

-- Table to track performance analysis patterns
CREATE TABLE IF NOT EXISTS performance_patterns (
  id BIGSERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL,
  avg_engagement_24h DECIMAL(8,2) NOT NULL,
  best_performing_hour INTEGER NOT NULL,
  worst_performing_hour INTEGER NOT NULL,
  current_trend TEXT NOT NULL, -- 'improving', 'declining', 'stable'
  total_posts_analyzed INTEGER NOT NULL,
  insights JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to track timing insights
CREATE TABLE IF NOT EXISTS timing_effectiveness (
  id BIGSERIAL PRIMARY KEY,
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  decision_made BOOLEAN NOT NULL, -- Whether AI decided to post
  post_success BOOLEAN, -- Whether post was successful (null if no post)
  engagement_score DECIMAL(8,2), -- Actual engagement if posted
  confidence_level DECIMAL(3,2) NOT NULL,
  strategy_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to track content guidance effectiveness
CREATE TABLE IF NOT EXISTS content_guidance_tracking (
  id BIGSERIAL PRIMARY KEY,
  guidance_type TEXT NOT NULL, -- 'viral', 'educational', 'news_reaction', etc.
  target_audience TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  implemented BOOLEAN NOT NULL,
  engagement_result DECIMAL(8,2),
  viral_achieved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_strategy ON decision_outcomes(decision_strategy);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_success ON decision_outcomes(success);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_created_at ON decision_outcomes(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_patterns_date ON performance_patterns(analysis_date);
CREATE INDEX IF NOT EXISTS idx_timing_effectiveness_hour_day ON timing_effectiveness(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_content_guidance_type ON content_guidance_tracking(guidance_type);

-- Function to update actual engagement data
CREATE OR REPLACE FUNCTION update_decision_outcome_engagement(
  p_tweet_id TEXT,
  p_likes INTEGER,
  p_retweets INTEGER,
  p_replies INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE decision_outcomes 
  SET 
    actual_likes = p_likes,
    actual_retweets = p_retweets,
    actual_replies = p_replies
  WHERE tweet_id = p_tweet_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate decision accuracy
CREATE OR REPLACE FUNCTION get_decision_accuracy(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  strategy TEXT,
  total_decisions BIGINT,
  successful_decisions BIGINT,
  accuracy_rate DECIMAL(5,2),
  avg_confidence DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.decision_strategy as strategy,
    COUNT(*) as total_decisions,
    SUM(CASE WHEN d.success THEN 1 ELSE 0 END) as successful_decisions,
    ROUND(
      (SUM(CASE WHEN d.success THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 
      2
    ) as accuracy_rate,
    ROUND(AVG(d.decision_confidence), 2) as avg_confidence
  FROM decision_outcomes d
  WHERE d.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY d.decision_strategy
  ORDER BY accuracy_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get timing insights
CREATE OR REPLACE FUNCTION get_timing_insights(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  hour_of_day INTEGER,
  total_decisions BIGINT,
  posts_made BIGINT,
  avg_engagement DECIMAL(8,2),
  success_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.hour_of_day,
    COUNT(*) as total_decisions,
    SUM(CASE WHEN t.post_success IS TRUE THEN 1 ELSE 0 END) as posts_made,
    ROUND(AVG(t.engagement_score), 2) as avg_engagement,
    ROUND(
      (SUM(CASE WHEN t.post_success IS TRUE THEN 1 ELSE 0 END)::DECIMAL / 
       NULLIF(SUM(CASE WHEN t.decision_made THEN 1 ELSE 0 END), 0)) * 100, 
      2
    ) as success_rate
  FROM timing_effectiveness t
  WHERE t.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY t.hour_of_day
  ORDER BY t.hour_of_day;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing
INSERT INTO performance_patterns (
  analysis_date, 
  avg_engagement_24h, 
  best_performing_hour, 
  worst_performing_hour, 
  current_trend, 
  total_posts_analyzed,
  insights
) VALUES (
  CURRENT_DATE,
  15.5,
  14, -- 2 PM
  3,  -- 3 AM
  'stable',
  10,
  '["Good engagement during business hours", "Low engagement late night"]'::jsonb
) ON CONFLICT DO NOTHING;

-- Add a comment about the intelligent decision system
COMMENT ON TABLE decision_outcomes IS 'Tracks AI posting decisions and their outcomes for learning and optimization';
COMMENT ON TABLE performance_patterns IS 'Tracks analysis of posting performance patterns over time';
COMMENT ON TABLE timing_effectiveness IS 'Tracks effectiveness of posting at different times';
COMMENT ON TABLE content_guidance_tracking IS 'Tracks effectiveness of different content guidance strategies'; 
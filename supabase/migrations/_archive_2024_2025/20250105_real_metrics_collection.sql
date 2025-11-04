-- 🎯 REAL METRICS COLLECTION SYSTEM
-- Replace fake engagement data with authentic Twitter metrics

-- Create table for real tweet metrics
CREATE TABLE IF NOT EXISTS real_tweet_metrics (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  bookmarks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER,
  profile_clicks INTEGER,
  engagement_rate DECIMAL(10,6) NOT NULL DEFAULT 0,
  collection_phase TEXT NOT NULL, -- 'collection_1', 'collection_2', etc.
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_verified BOOLEAN NOT NULL DEFAULT true, -- TRUE = real data, FALSE = estimated
  
  -- Content metadata for learning
  content_length INTEGER,
  persona TEXT,
  emotion TEXT,
  framework TEXT,
  posted_at TIMESTAMPTZ,
  
  -- Performance tracking
  viral_score INTEGER DEFAULT 0,
  hours_after_post INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one metrics record per tweet per collection phase
CREATE UNIQUE INDEX IF NOT EXISTS real_tweet_metrics_unique 
ON real_tweet_metrics (tweet_id, collection_phase);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS real_tweet_metrics_collected_at_idx ON real_tweet_metrics (collected_at DESC);
CREATE INDEX IF NOT EXISTS real_tweet_metrics_engagement_rate_idx ON real_tweet_metrics (engagement_rate DESC);
CREATE INDEX IF NOT EXISTS real_tweet_metrics_verified_idx ON real_tweet_metrics (is_verified, collected_at DESC);
CREATE INDEX IF NOT EXISTS real_tweet_metrics_persona_idx ON real_tweet_metrics (persona, engagement_rate DESC);

-- Create view for latest metrics per tweet
CREATE OR REPLACE VIEW latest_real_metrics AS
SELECT DISTINCT ON (tweet_id) 
  *
FROM real_tweet_metrics 
WHERE is_verified = true
ORDER BY tweet_id, collected_at DESC;

-- Create aggregate view for analytics
CREATE OR REPLACE VIEW real_metrics_analytics AS
SELECT 
  DATE_TRUNC('day', collected_at) as day,
  COUNT(DISTINCT tweet_id) as tweets_tracked,
  AVG(engagement_rate) as avg_engagement_rate,
  SUM(likes) as total_likes,
  SUM(retweets) as total_retweets,
  SUM(replies) as total_replies,
  SUM(bookmarks) as total_bookmarks,
  MAX(engagement_rate) as max_engagement_rate,
  AVG(viral_score) as avg_viral_score
FROM real_tweet_metrics
WHERE is_verified = true
GROUP BY DATE_TRUNC('day', collected_at)
ORDER BY day DESC;

-- Create function to calculate real engagement trends
CREATE OR REPLACE FUNCTION get_real_engagement_trends(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  persona TEXT,
  emotion TEXT,
  framework TEXT,
  avg_engagement_rate DECIMAL,
  total_tweets BIGINT,
  avg_viral_score DECIMAL,
  trend_direction TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.persona,
    m.emotion,
    m.framework,
    ROUND(AVG(m.engagement_rate), 6) as avg_engagement_rate,
    COUNT(DISTINCT m.tweet_id) as total_tweets,
    ROUND(AVG(m.viral_score), 2) as avg_viral_score,
    CASE 
      WHEN AVG(m.engagement_rate) > 0.05 THEN 'high_performing'
      WHEN AVG(m.engagement_rate) > 0.02 THEN 'moderate'
      ELSE 'needs_improvement'
    END as trend_direction
  FROM real_tweet_metrics m
  WHERE m.is_verified = true
    AND m.collected_at >= NOW() - INTERVAL '1 day' * days_back
    AND m.persona IS NOT NULL
  GROUP BY m.persona, m.emotion, m.framework
  HAVING COUNT(DISTINCT m.tweet_id) >= 2 -- Minimum sample size
  ORDER BY avg_engagement_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to identify top performing content patterns
CREATE OR REPLACE FUNCTION get_top_performing_patterns()
RETURNS TABLE(
  pattern_type TEXT,
  pattern_value TEXT,
  avg_engagement_rate DECIMAL,
  sample_tweets BIGINT,
  viral_potential DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  -- Persona patterns
  SELECT 
    'persona' as pattern_type,
    m.persona as pattern_value,
    ROUND(AVG(m.engagement_rate), 6) as avg_engagement_rate,
    COUNT(DISTINCT m.tweet_id) as sample_tweets,
    ROUND(AVG(m.viral_score), 2) as viral_potential
  FROM real_tweet_metrics m
  WHERE m.is_verified = true
    AND m.persona IS NOT NULL
    AND m.collected_at >= NOW() - INTERVAL '30 days'
  GROUP BY m.persona
  HAVING COUNT(DISTINCT m.tweet_id) >= 3
  
  UNION ALL
  
  -- Emotion patterns
  SELECT 
    'emotion' as pattern_type,
    m.emotion as pattern_value,
    ROUND(AVG(m.engagement_rate), 6) as avg_engagement_rate,
    COUNT(DISTINCT m.tweet_id) as sample_tweets,
    ROUND(AVG(m.viral_score), 2) as viral_potential
  FROM real_tweet_metrics m
  WHERE m.is_verified = true
    AND m.emotion IS NOT NULL
    AND m.collected_at >= NOW() - INTERVAL '30 days'
  GROUP BY m.emotion
  HAVING COUNT(DISTINCT m.tweet_id) >= 3
  
  UNION ALL
  
  -- Framework patterns  
  SELECT 
    'framework' as pattern_type,
    m.framework as pattern_value,
    ROUND(AVG(m.engagement_rate), 6) as avg_engagement_rate,
    COUNT(DISTINCT m.tweet_id) as sample_tweets,
    ROUND(AVG(m.viral_score), 2) as viral_potential
  FROM real_tweet_metrics m
  WHERE m.is_verified = true
    AND m.framework IS NOT NULL
    AND m.collected_at >= NOW() - INTERVAL '30 days'
  GROUP BY m.framework
  HAVING COUNT(DISTINCT m.tweet_id) >= 3
  
  ORDER BY avg_engagement_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_real_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER real_tweet_metrics_updated_at
  BEFORE UPDATE ON real_tweet_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_real_metrics_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON real_tweet_metrics TO anon, authenticated;
GRANT SELECT ON latest_real_metrics TO anon, authenticated;
GRANT SELECT ON real_metrics_analytics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_real_engagement_trends(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_performing_patterns() TO anon, authenticated;

-- Add comment for documentation
COMMENT ON TABLE real_tweet_metrics IS 'Stores REAL Twitter engagement metrics collected from actual tweets via browser automation. Replaces all fake/simulated engagement data.';
COMMENT ON COLUMN real_tweet_metrics.is_verified IS 'TRUE = Real data from Twitter, FALSE = Estimated/calculated data';
COMMENT ON COLUMN real_tweet_metrics.collection_phase IS 'Tracks when metrics were collected (collection_1 = 5min, collection_2 = 30min, etc.)';
COMMENT ON VIEW latest_real_metrics IS 'Shows the most recent real metrics for each tweet';
COMMENT ON FUNCTION get_real_engagement_trends(INTEGER) IS 'Analyzes real engagement trends by persona/emotion/framework over specified days';

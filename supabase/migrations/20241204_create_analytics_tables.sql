-- Create comprehensive analytics tables for Twitter data tracking

-- Profile analytics table
CREATE TABLE IF NOT EXISTS profile_analytics (
  id SERIAL PRIMARY KEY,
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  total_tweets INTEGER NOT NULL DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  mentions_received INTEGER DEFAULT 0,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tweet analytics table  
CREATE TABLE IF NOT EXISTS tweet_analytics (
  id SERIAL PRIMARY KEY,
  tweet_id VARCHAR(50) UNIQUE NOT NULL,
  tweet_url TEXT,
  content TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  quotes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  detail_expands INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Analytics insights table for AI learning
CREATE TABLE IF NOT EXISTS analytics_insights (
  id SERIAL PRIMARY KEY,
  insight_type VARCHAR(50) NOT NULL, -- 'top_performing', 'content_pattern', 'timing_pattern'
  insight_data JSONB NOT NULL,
  performance_score DECIMAL(8,2),
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance tracking for learning system
CREATE TABLE IF NOT EXISTS content_performance_tracking (
  id SERIAL PRIMARY KEY,
  tweet_id VARCHAR(50),
  content_type VARCHAR(50), -- 'thread', 'single', 'reply'
  content_topic VARCHAR(100),
  content_style VARCHAR(50), -- 'breaking', 'investigative', 'underground'
  hook_type VARCHAR(50),
  predicted_engagement DECIMAL(5,2),
  actual_engagement DECIMAL(5,2),
  engagement_delta DECIMAL(5,2), -- actual - predicted
  followers_before INTEGER,
  followers_after INTEGER,
  follower_delta INTEGER,
  quality_score DECIMAL(3,2),
  learning_insights JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_scraped_at ON tweet_analytics(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_engagement_rate ON tweet_analytics(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_profile_analytics_scraped_at ON profile_analytics(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_performance_tweet_id ON content_performance_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_created_at ON content_performance_tracking(created_at DESC);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tweet_analytics_updated_at 
  BEFORE UPDATE ON tweet_analytics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_performance_updated_at 
  BEFORE UPDATE ON content_performance_tracking 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE profile_analytics IS 'Stores Twitter profile metrics scraped every 30 minutes';
COMMENT ON TABLE tweet_analytics IS 'Stores individual tweet performance metrics for learning';
COMMENT ON TABLE analytics_insights IS 'Stores AI-generated insights from analytics data';
COMMENT ON TABLE content_performance_tracking IS 'Links content generation decisions to actual performance for AI learning';

COMMENT ON COLUMN tweet_analytics.engagement_rate IS 'Calculated engagement rate percentage';
COMMENT ON COLUMN content_performance_tracking.engagement_delta IS 'Difference between predicted and actual engagement for AI learning';
COMMENT ON COLUMN content_performance_tracking.learning_insights IS 'JSON blob containing ML insights and patterns';

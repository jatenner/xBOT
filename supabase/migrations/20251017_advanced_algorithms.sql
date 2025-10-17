-- Advanced Algorithm Tables

-- Engagement Velocity Tracking
CREATE TABLE IF NOT EXISTS engagement_velocity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  
  velocity_5min NUMERIC(10,2) DEFAULT 0,
  velocity_15min NUMERIC(10,2) DEFAULT 0,
  velocity_30min NUMERIC(10,2) DEFAULT 0,
  
  weighted_score NUMERIC(10,2) DEFAULT 0,
  viral_potential NUMERIC(3,2) DEFAULT 0,
  is_viral BOOLEAN DEFAULT FALSE,
  
  profile_clicks INTEGER DEFAULT 0,
  follow_through_rate NUMERIC(5,4) DEFAULT 0,
  
  tracked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_velocity_tweet ON engagement_velocity(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_velocity_is_viral ON engagement_velocity(is_viral);
CREATE INDEX IF NOT EXISTS idx_engagement_velocity_tracked ON engagement_velocity(tracked_at DESC);

COMMENT ON TABLE engagement_velocity IS 'Tracks engagement velocity for Twitter algorithm optimization';

-- Conversion Funnel Metrics
CREATE TABLE IF NOT EXISTS conversion_funnel_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  
  impressions INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  follows INTEGER DEFAULT 0,
  
  engagement_rate NUMERIC(5,4) DEFAULT 0,
  click_rate NUMERIC(5,4) DEFAULT 0,
  follow_rate NUMERIC(5,4) DEFAULT 0,
  overall_conversion NUMERIC(6,5) DEFAULT 0,
  
  content_type TEXT,
  topic TEXT,
  has_controversy BOOLEAN DEFAULT FALSE,
  has_numbers BOOLEAN DEFAULT FALSE,
  format TEXT,
  hook_type TEXT,
  
  performance_tier TEXT,
  
  tracked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_metrics_post ON conversion_funnel_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_funnel_metrics_conversion ON conversion_funnel_metrics(overall_conversion DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_metrics_tier ON conversion_funnel_metrics(performance_tier);

COMMENT ON TABLE conversion_funnel_metrics IS 'Tracks full conversion funnel for follower optimization';

-- Follower Predictions
CREATE TABLE IF NOT EXISTS follower_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  
  predicted_followers INTEGER NOT NULL,
  actual_followers INTEGER,
  
  confidence NUMERIC(3,2) DEFAULT 0,
  
  content_score NUMERIC(3,2),
  timing_score NUMERIC(3,2),
  viral_potential NUMERIC(3,2),
  conversion_potential NUMERIC(3,2),
  
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_predictions_post ON follower_predictions(post_id);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON follower_predictions(predicted_at DESC);

COMMENT ON TABLE follower_predictions IS 'ML-based follower predictions and accuracy tracking';

-- Timing Patterns (for personalized scheduling)
CREATE TABLE IF NOT EXISTS timing_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  
  avg_impressions NUMERIC(10,2) DEFAULT 0,
  avg_engagement NUMERIC(10,2) DEFAULT 0,
  avg_followers_gained NUMERIC(5,2) DEFAULT 0,
  success_rate NUMERIC(3,2) DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hour, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_timing_patterns_hour ON timing_patterns(hour);
CREATE INDEX IF NOT EXISTS idx_timing_patterns_success ON timing_patterns(success_rate DESC);

COMMENT ON TABLE timing_patterns IS 'Personalized timing patterns based on YOUR followers activity';

-- Reply Performance Tracking (extended)
ALTER TABLE ai_discovered_targets 
ADD COLUMN IF NOT EXISTS avg_engagement_on_replies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS optimal_reply_time TEXT;

COMMENT ON COLUMN ai_discovered_targets.avg_engagement_on_replies IS 'Average engagement when replying to this account';
COMMENT ON COLUMN ai_discovered_targets.optimal_reply_time IS 'Best time to reply to this account for maximum visibility';


-- Advanced Learning Tables for Multi-Dimensional System

-- Multi-dimensional metrics table
CREATE TABLE IF NOT EXISTS multi_dimensional_metrics (
  post_id UUID PRIMARY KEY,
  posted_at TIMESTAMPTZ NOT NULL,
  
  -- Traditional metrics
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  
  -- Velocity metrics
  velocity_30min INTEGER DEFAULT 0,
  velocity_2hours INTEGER DEFAULT 0,
  velocity_24hours INTEGER DEFAULT 0,
  velocity_score INTEGER DEFAULT 0,
  
  -- Funnel metrics
  impressions INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  view_rate NUMERIC(5,4) DEFAULT 0.0,
  click_rate NUMERIC(5,4) DEFAULT 0.0,
  follow_rate NUMERIC(5,4) DEFAULT 0.0,
  
  -- Network metrics
  high_value_engagers INTEGER DEFAULT 0,
  engagement_quality_score INTEGER DEFAULT 0,
  reply_chain_depth INTEGER DEFAULT 0,
  
  -- Timing context
  hour INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  competition_level TEXT CHECK (competition_level IN ('low', 'medium', 'high')),
  
  -- Calculated scores
  twitter_algorithm_score INTEGER DEFAULT 0,
  follower_conversion_score INTEGER DEFAULT 0,
  overall_effectiveness INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multi_dim_effectiveness ON multi_dimensional_metrics(overall_effectiveness DESC);
CREATE INDEX IF NOT EXISTS idx_multi_dim_posted_at ON multi_dimensional_metrics(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_multi_dim_hour ON multi_dimensional_metrics(hour);

-- Titan accounts performance tracking
CREATE TABLE IF NOT EXISTS titan_accounts (
  username TEXT PRIMARY KEY,
  display_name TEXT,
  follower_count INTEGER,
  category TEXT,
  
  -- Performance tracking
  times_replied INTEGER DEFAULT 0,
  times_engaged INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,4) DEFAULT 0.0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual reply performance to titans
CREATE TABLE IF NOT EXISTS titan_reply_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titan_username TEXT REFERENCES titan_accounts(username),
  reply_id TEXT NOT NULL,
  
  -- Performance metrics
  titan_engaged BOOLEAN DEFAULT FALSE,
  profile_clicks INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_titan_reply_username ON titan_reply_performance(titan_username);
CREATE INDEX IF NOT EXISTS idx_titan_reply_created ON titan_reply_performance(created_at DESC);

-- Viral thread attempts tracking
CREATE TABLE IF NOT EXISTS viral_thread_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID,
  
  -- Thread details
  hook_type TEXT,
  target_emotion TEXT,
  viral_score INTEGER,
  thread_length INTEGER,
  
  -- Performance
  actual_likes INTEGER DEFAULT 0,
  actual_retweets INTEGER DEFAULT 0,
  actual_replies INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  
  -- Analysis
  went_viral BOOLEAN DEFAULT FALSE,
  viral_threshold INTEGER DEFAULT 1000, -- 1000+ retweets = viral
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viral_attempts_score ON viral_thread_attempts(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_attempts_went_viral ON viral_thread_attempts(went_viral);

COMMENT ON TABLE multi_dimensional_metrics IS 'Comprehensive metrics for multi-dimensional learning system';
COMMENT ON TABLE titan_accounts IS 'High-value accounts we target for strategic replies';
COMMENT ON TABLE titan_reply_performance IS 'Performance tracking for individual replies to titans';
COMMENT ON TABLE viral_thread_attempts IS 'Tracking viral thread attempts and their actual performance';


-- Learning Database Schema
-- For collecting real Twitter performance data

CREATE TABLE IF NOT EXISTS learning_posts (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  quality_score INTEGER NOT NULL,
  quality_issues TEXT[],
  audience_growth_potential INTEGER,
  was_posted BOOLEAN DEFAULT false,
  post_reason TEXT,
  tweet_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  content_length INTEGER,
  has_hook BOOLEAN DEFAULT false,
  has_stats BOOLEAN DEFAULT false,
  has_question BOOLEAN DEFAULT false,
  learning_metadata JSONB,
  
  -- Performance data (collected after posting)
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Learning insights
  converted_followers INTEGER DEFAULT 0,
  optimal_timing BOOLEAN DEFAULT false,
  viral_potential_score INTEGER DEFAULT 0,
  
  UNIQUE(tweet_id)
);

CREATE TABLE IF NOT EXISTS learning_engagement (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL, -- 'like', 'reply', 'follow'
  target_username TEXT NOT NULL,
  target_content TEXT,
  our_response TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  success BOOLEAN DEFAULT false,
  learning_purpose TEXT,
  
  -- Results tracking
  resulted_in_follow BOOLEAN DEFAULT false,
  resulted_in_engagement BOOLEAN DEFAULT false,
  response_time INTEGER, -- milliseconds
  
  -- Context
  target_follower_count INTEGER,
  target_engagement_rate DECIMAL(5,4),
  strategic_value INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS learning_insights (
  id SERIAL PRIMARY KEY,
  insight_type TEXT NOT NULL, -- 'optimal_length', 'best_timing', 'hook_performance'
  insight_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  based_on_posts INTEGER DEFAULT 0,
  
  -- Performance tracking
  insight_accuracy DECIMAL(3,2), -- How accurate this insight proved to be
  last_validated TIMESTAMP
);
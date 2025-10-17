-- CRITICAL TABLES ONLY - Apply to fix data collection
CREATE TABLE IF NOT EXISTS unified_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL,
  tweet_id TEXT,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  collection_phase TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  decision_id TEXT,
  followers_before INTEGER,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  followers_gained INTEGER DEFAULT 0,
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  generator_type TEXT,
  topic TEXT,
  content_format TEXT,
  hook_type TEXT,
  viral_score INTEGER,
  follower_gain INTEGER DEFAULT 0,
  engagement_rate DECIMAL,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  quality_score DECIMAL,
  success_score DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unified_outcomes_decision_id ON unified_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_post_attribution_post_id ON post_attribution(post_id);
CREATE INDEX IF NOT EXISTS idx_learning_data_post_id ON learning_data(post_id);

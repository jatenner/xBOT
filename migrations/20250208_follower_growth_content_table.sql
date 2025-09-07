-- 🚀 FOLLOWER GROWTH CONTENT TABLE
-- Tracks content specifically optimized for follower acquisition

CREATE TABLE IF NOT EXISTS follower_growth_content (
  id SERIAL PRIMARY KEY,
  content_type TEXT CHECK (content_type IN ('news_reaction', 'myth_buster', 'insider_secret', 'quick_tip', 'question_bait', 'controversy', 'case_study')) NOT NULL,
  content TEXT NOT NULL,
  predicted_viral INTEGER CHECK (predicted_viral >= 0 AND predicted_viral <= 100),
  predicted_follow INTEGER CHECK (predicted_follow >= 0 AND predicted_follow <= 100),
  actual_likes INTEGER DEFAULT 0,
  actual_retweets INTEGER DEFAULT 0,
  actual_replies INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  format TEXT CHECK (format IN ('single', 'thread')) NOT NULL,
  audience TEXT,
  tweet_id TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_follower_content_type ON follower_growth_content(content_type);
CREATE INDEX IF NOT EXISTS idx_follower_performance ON follower_growth_content(followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_follower_posted_at ON follower_growth_content(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_follower_engagement ON follower_growth_content(engagement_rate DESC);

-- Enable RLS
ALTER TABLE follower_growth_content ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations" ON follower_growth_content FOR ALL USING (true);

COMMIT;

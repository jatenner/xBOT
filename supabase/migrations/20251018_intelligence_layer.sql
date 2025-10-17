-- Intelligence Layer: Follower Attribution, Hook Analysis, Competitive Intelligence
-- Pure additions - no modifications to existing tables

-- 1. Add intelligence columns to existing outcomes table
ALTER TABLE outcomes 
ADD COLUMN IF NOT EXISTS followers_before INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS followers_after INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS followers_gained INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hook_text TEXT,
ADD COLUMN IF NOT EXISTS hook_type TEXT,
ADD COLUMN IF NOT EXISTS post_hour INTEGER,
ADD COLUMN IF NOT EXISTS predicted_followers NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS predicted_engagement INTEGER DEFAULT 0;

-- Indexes for intelligence queries
CREATE INDEX IF NOT EXISTS idx_outcomes_followers_gained ON outcomes(followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_post_hour ON outcomes(post_hour);
CREATE INDEX IF NOT EXISTS idx_outcomes_hook_type ON outcomes(hook_type);

-- 2. Follower snapshots (historical tracking)
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'main',
  follower_count INTEGER NOT NULL,
  following_count INTEGER DEFAULT 0,
  snapshot_at TIMESTAMP DEFAULT NOW(),
  source TEXT DEFAULT 'scraper',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_snapshots_time ON follower_snapshots(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_account ON follower_snapshots(account_id);

-- 3. Competitive intelligence (learn from top accounts)
CREATE TABLE IF NOT EXISTS competitive_intelligence (
  id BIGSERIAL PRIMARY KEY,
  competitor_username TEXT NOT NULL,
  competitor_followers INTEGER DEFAULT 0,
  tweet_id TEXT UNIQUE NOT NULL,
  tweet_text TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  posted_at TIMESTAMP,
  scraped_at TIMESTAMP DEFAULT NOW(),
  hook_text TEXT,
  hook_type TEXT,
  topic_detected TEXT,
  success_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitive_success ON competitive_intelligence(success_score DESC);
CREATE INDEX IF NOT EXISTS idx_competitive_competitor ON competitive_intelligence(competitor_username);
CREATE INDEX IF NOT EXISTS idx_competitive_posted ON competitive_intelligence(posted_at DESC);

-- 4. Competitive insights (learned patterns)
CREATE TABLE IF NOT EXISTS competitive_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_type TEXT NOT NULL, -- 'hook_pattern', 'topic_trend', 'timing_pattern', 'format_pattern'
  pattern TEXT NOT NULL,
  effectiveness_score NUMERIC DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  learned_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(insight_type, pattern)
);

CREATE INDEX IF NOT EXISTS idx_competitive_insights_type ON competitive_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_competitive_insights_effectiveness ON competitive_insights(effectiveness_score DESC);

-- 5. Hook performance tracking
CREATE TABLE IF NOT EXISTS hook_performance (
  id BIGSERIAL PRIMARY KEY,
  hook_text TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  generator_used TEXT,
  topic_cluster TEXT,
  post_hour INTEGER,
  followers_gained INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  posted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_performance_type ON hook_performance(hook_type);
CREATE INDEX IF NOT EXISTS idx_hook_performance_followers ON hook_performance(followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_hook_performance_generator ON hook_performance(generator_used);

-- 6. Time optimization tracking
CREATE TABLE IF NOT EXISTS time_performance (
  id BIGSERIAL PRIMARY KEY,
  post_hour INTEGER NOT NULL,
  day_of_week INTEGER, -- 0=Sunday, 6=Saturday
  avg_impressions NUMERIC DEFAULT 0,
  avg_likes NUMERIC DEFAULT 0,
  avg_followers_gained NUMERIC DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_hour, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_time_performance_hour ON time_performance(post_hour);
CREATE INDEX IF NOT EXISTS idx_time_performance_followers ON time_performance(avg_followers_gained DESC);

-- Functions for intelligence layer

-- Update time performance (called after analytics)
CREATE OR REPLACE FUNCTION update_time_performance()
RETURNS void AS $$
BEGIN
  INSERT INTO time_performance (post_hour, day_of_week, avg_impressions, avg_likes, avg_followers_gained, total_posts)
  SELECT 
    post_hour,
    EXTRACT(DOW FROM created_at)::INTEGER as day_of_week,
    AVG(impressions) as avg_impressions,
    AVG(likes) as avg_likes,
    AVG(followers_gained) as avg_followers_gained,
    COUNT(*) as total_posts
  FROM outcomes
  WHERE post_hour IS NOT NULL
  GROUP BY post_hour, EXTRACT(DOW FROM created_at)
  ON CONFLICT (post_hour, day_of_week) 
  DO UPDATE SET
    avg_impressions = EXCLUDED.avg_impressions,
    avg_likes = EXCLUDED.avg_likes,
    avg_followers_gained = EXCLUDED.avg_followers_gained,
    total_posts = EXCLUDED.total_posts,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Get optimal posting hours
CREATE OR REPLACE FUNCTION get_optimal_posting_hours(
  top_n INTEGER DEFAULT 3,
  min_posts INTEGER DEFAULT 5
)
RETURNS TABLE (
  hour INTEGER,
  avg_followers NUMERIC,
  avg_engagement NUMERIC,
  total_posts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    post_hour as hour,
    avg_followers_gained as avg_followers,
    (avg_likes + avg_impressions / 10) as avg_engagement,
    total_posts
  FROM time_performance
  WHERE total_posts >= min_posts
  ORDER BY avg_followers_gained DESC
  LIMIT top_n;
END;
$$ LANGUAGE plpgsql;

-- Get top performing hooks
CREATE OR REPLACE FUNCTION get_top_hooks(
  limit_count INTEGER DEFAULT 10,
  min_followers INTEGER DEFAULT 1
)
RETURNS TABLE (
  hook TEXT,
  hook_type TEXT,
  followers_gained INTEGER,
  engagement_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hook_text as hook,
    hook_type,
    o.followers_gained,
    (o.likes + o.retweets * 2) as engagement_score
  FROM outcomes o
  WHERE o.hook_text IS NOT NULL
  AND o.followers_gained >= min_followers
  ORDER BY o.followers_gained DESC, engagement_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old competitive intelligence (>30 days)
CREATE OR REPLACE FUNCTION cleanup_old_competitive_data()
RETURNS void AS $$
BEGIN
  DELETE FROM competitive_intelligence
  WHERE scraped_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE follower_snapshots IS 'Historical follower count tracking for attribution';
COMMENT ON TABLE competitive_intelligence IS 'Scraped posts from top health accounts for learning';
COMMENT ON TABLE competitive_insights IS 'Learned patterns from competitive analysis';
COMMENT ON TABLE hook_performance IS 'Individual hook performance tracking';
COMMENT ON TABLE time_performance IS 'Optimal posting time analysis';


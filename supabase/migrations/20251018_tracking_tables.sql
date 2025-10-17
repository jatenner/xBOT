-- Tracking Tables for Follower Attribution & Velocity Analysis
-- Simple version: Baseline + 24h checkpoints only

-- Table: Post Follower Tracking
-- Tracks follower count at different checkpoints after posting
CREATE TABLE IF NOT EXISTS post_follower_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  tweet_id text NOT NULL,
  check_time timestamp with time zone NOT NULL,
  follower_count integer NOT NULL,
  profile_views integer DEFAULT 0,
  hours_after_post numeric NOT NULL,
  collection_phase text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follower_tracking_post ON post_follower_tracking(post_id);
CREATE INDEX IF NOT EXISTS idx_follower_tracking_tweet ON post_follower_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_tracking_hours ON post_follower_tracking(hours_after_post);
CREATE INDEX IF NOT EXISTS idx_follower_tracking_time ON post_follower_tracking(check_time DESC);

-- Table: Post Velocity Tracking
-- Tracks engagement metrics at different checkpoints
CREATE TABLE IF NOT EXISTS post_velocity_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL,
  tweet_id text NOT NULL,
  check_time timestamp with time zone NOT NULL,
  hours_after_post numeric NOT NULL,
  likes integer DEFAULT 0,
  retweets integer DEFAULT 0,
  replies integer DEFAULT 0,
  bookmarks integer DEFAULT 0,
  views integer DEFAULT 0,
  collection_phase text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_velocity_tracking_post ON post_velocity_tracking(post_id);
CREATE INDEX IF NOT EXISTS idx_velocity_tracking_tweet ON post_velocity_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_velocity_tracking_hours ON post_velocity_tracking(hours_after_post);
CREATE INDEX IF NOT EXISTS idx_velocity_tracking_time ON post_velocity_tracking(check_time DESC);

-- View: Follower Attribution (Easy ML access)
-- Shows baseline vs 24h follower counts and calculates gains
CREATE OR REPLACE VIEW follower_attribution_simple AS
SELECT 
  post_id,
  MAX(CASE WHEN hours_after_post = 0 THEN follower_count END) as baseline_followers,
  MAX(CASE WHEN hours_after_post = 24 THEN follower_count END) as followers_24h,
  MAX(CASE WHEN hours_after_post = 48 THEN follower_count END) as followers_48h,
  
  -- Calculate gains
  COALESCE(MAX(CASE WHEN hours_after_post = 24 THEN follower_count END), 0) - 
  COALESCE(MAX(CASE WHEN hours_after_post = 0 THEN follower_count END), 0) as followers_gained_24h,
  
  COALESCE(MAX(CASE WHEN hours_after_post = 48 THEN follower_count END), 0) - 
  COALESCE(MAX(CASE WHEN hours_after_post = 0 THEN follower_count END), 0) as followers_gained_48h,
  
  -- Data completeness
  CASE WHEN MAX(CASE WHEN hours_after_post = 0 THEN 1 END) = 1 THEN true ELSE false END as has_baseline,
  CASE WHEN MAX(CASE WHEN hours_after_post = 24 THEN 1 END) = 1 THEN true ELSE false END as has_24h_data
  
FROM post_follower_tracking
GROUP BY post_id;

-- View: Velocity Analysis (Easy ML access)
-- Shows engagement velocity and growth rates
CREATE OR REPLACE VIEW velocity_analysis_simple AS
SELECT 
  post_id,
  
  -- Baseline metrics
  MAX(CASE WHEN hours_after_post = 0 THEN likes END) as likes_baseline,
  
  -- 24h metrics
  MAX(CASE WHEN hours_after_post = 24 THEN likes END) as likes_24h,
  MAX(CASE WHEN hours_after_post = 24 THEN retweets END) as retweets_24h,
  MAX(CASE WHEN hours_after_post = 24 THEN replies END) as replies_24h,
  MAX(CASE WHEN hours_after_post = 24 THEN bookmarks END) as bookmarks_24h,
  MAX(CASE WHEN hours_after_post = 24 THEN views END) as views_24h,
  
  -- Calculate velocity (engagement per hour)
  CASE 
    WHEN MAX(CASE WHEN hours_after_post = 24 THEN likes END) IS NOT NULL 
    THEN (
      COALESCE(MAX(CASE WHEN hours_after_post = 24 THEN likes END), 0) - 
      COALESCE(MAX(CASE WHEN hours_after_post = 0 THEN likes END), 0)
    ) / 24.0
    ELSE 0
  END as velocity_likes_per_hour,
  
  -- Total engagement at 24h
  COALESCE(MAX(CASE WHEN hours_after_post = 24 THEN likes END), 0) +
  COALESCE(MAX(CASE WHEN hours_after_post = 24 THEN retweets END), 0) * 2 +
  COALESCE(MAX(CASE WHEN hours_after_post = 24 THEN replies END), 0) * 3 as total_engagement_24h,
  
  -- Data completeness
  CASE WHEN MAX(CASE WHEN hours_after_post = 0 THEN 1 END) = 1 THEN true ELSE false END as has_baseline,
  CASE WHEN MAX(CASE WHEN hours_after_post = 24 THEN 1 END) = 1 THEN true ELSE false END as has_24h_data
  
FROM post_velocity_tracking
GROUP BY post_id;

-- Comments for documentation
COMMENT ON TABLE post_follower_tracking IS 'Tracks follower count at multiple checkpoints after each post for attribution analysis';
COMMENT ON TABLE post_velocity_tracking IS 'Tracks engagement metrics at multiple checkpoints to analyze velocity and growth patterns';
COMMENT ON VIEW follower_attribution_simple IS 'Aggregated view showing follower gains attributed to each post';
COMMENT ON VIEW velocity_analysis_simple IS 'Aggregated view showing engagement velocity and growth rates for each post';


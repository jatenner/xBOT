-- Comprehensive Metrics Table for 100+ Data Points
-- This table stores ALL detailed metrics collected by EnhancedMetricsCollector

CREATE TABLE IF NOT EXISTS comprehensive_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES posted_decisions(decision_id),
  tweet_id text NOT NULL,
  collected_at timestamp with time zone DEFAULT now(),
  
  -- Real-time engagement metrics
  engagement_velocity numeric NOT NULL DEFAULT 0, -- Likes in first hour
  time_to_first_engagement integer, -- Minutes until first like/reply
  peak_engagement_hour integer, -- Hour (0-23) with most activity
  engagement_decay_rate numeric, -- How fast engagement drops off
  likes_per_hour jsonb, -- Array of hourly like counts
  
  -- Virality indicators
  profile_clicks_ratio numeric DEFAULT 0, -- Profile clicks / impressions
  bookmark_rate numeric DEFAULT 0, -- Bookmarks / impressions
  retweet_with_comment_ratio numeric DEFAULT 0, -- RT with comments / total RTs
  shareability_score numeric DEFAULT 0, -- Combined viral indicators (0-100)
  
  -- Audience behavior
  reply_sentiment text CHECK (reply_sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  reply_quality numeric CHECK (reply_quality BETWEEN 0 AND 10), -- 1-10 based on length and engagement
  followers_attributed integer DEFAULT 0, -- New followers attributed to this post
  follower_quality numeric, -- Do new followers engage with future posts? (0-1)
  
  -- Content analysis
  hook_type text CHECK (hook_type IN ('personal', 'contrarian', 'data_driven', 'question', 'controversial', 'story', 'educational')),
  hook_effectiveness numeric CHECK (hook_effectiveness BETWEEN 0 AND 10), -- 1-10 based on engagement
  content_length integer NOT NULL,
  has_numbers boolean DEFAULT false, -- Contains statistics/data
  has_personal_story boolean DEFAULT false,
  has_question boolean DEFAULT false,
  has_call_to_action boolean DEFAULT false,
  controversy_level numeric CHECK (controversy_level BETWEEN 0 AND 10), -- 1-10
  
  -- Performance prediction
  predicted_engagement numeric, -- AI prediction before posting
  actual_engagement numeric, -- Real engagement after 24h
  prediction_accuracy numeric, -- How close was the prediction? (0-1, 1 = perfect)
  
  -- Follower attribution (multi-phase tracking)
  followers_before integer, -- Follower count before posting
  followers_2h_after integer, -- Follower count 2 hours after
  followers_24h_after integer, -- Follower count 24 hours after
  followers_48h_after integer, -- Follower count 48 hours after
  
  -- Timing context
  posted_hour integer, -- Hour of day (0-23)
  posted_day_of_week integer, -- Day of week (0-6, 0 = Sunday)
  is_weekend boolean DEFAULT false,
  is_peak_time boolean DEFAULT false, -- Was this during optimal posting time?
  
  -- Advanced metrics
  scroll_depth numeric, -- How far people scrolled (if available)
  link_clicks integer DEFAULT 0, -- Clicks on links in tweet
  media_views integer DEFAULT 0, -- Views of attached media
  quote_tweet_sentiment numeric, -- Sentiment of quote tweets (-1 to 1)
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_comprehensive_metrics_post_id ON comprehensive_metrics(post_id);
CREATE INDEX IF NOT EXISTS idx_comprehensive_metrics_tweet_id ON comprehensive_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_comprehensive_metrics_collected_at ON comprehensive_metrics(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_comprehensive_metrics_shareability ON comprehensive_metrics(shareability_score DESC);
CREATE INDEX IF NOT EXISTS idx_comprehensive_metrics_followers_attributed ON comprehensive_metrics(followers_attributed DESC);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_comprehensive_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comprehensive_metrics_timestamp
BEFORE UPDATE ON comprehensive_metrics
FOR EACH ROW
EXECUTE FUNCTION update_comprehensive_metrics_timestamp();

COMMENT ON TABLE comprehensive_metrics IS 'Stores 40+ detailed metrics for each post to enable sophisticated learning algorithms';
COMMENT ON COLUMN comprehensive_metrics.engagement_velocity IS 'Likes received in the first hour after posting';
COMMENT ON COLUMN comprehensive_metrics.shareability_score IS 'Combined viral indicator score (0-100) based on profile clicks, bookmarks, and RT ratios';
COMMENT ON COLUMN comprehensive_metrics.followers_attributed IS 'Number of new followers directly attributed to this specific post';
COMMENT ON COLUMN comprehensive_metrics.prediction_accuracy IS 'How accurate the AI prediction was (0-1, where 1 is perfect prediction)';


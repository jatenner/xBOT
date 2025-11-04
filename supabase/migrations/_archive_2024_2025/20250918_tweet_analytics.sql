-- Tweet analytics table for raw snapshots collected from Twitter
-- Real engagement data collected via scraper or API

CREATE TABLE IF NOT EXISTS tweet_analytics (
  tweet_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  impressions INT,
  likes INT,
  retweets INT,
  replies INT,
  bookmarks INT,
  quotes INT,
  author_followers INT,
  PRIMARY KEY (tweet_id, captured_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_tweet ON tweet_analytics(tweet_id);

-- Comments for clarity
COMMENT ON TABLE tweet_analytics IS 'Raw Twitter engagement snapshots collected from platform';
COMMENT ON COLUMN tweet_analytics.captured_at IS 'When this snapshot was collected';
COMMENT ON COLUMN tweet_analytics.posted_at IS 'When the tweet was originally posted';

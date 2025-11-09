-- FOLLOWER TRACKING TABLE
-- Stores periodic snapshots of follower count for growth tracking

CREATE TABLE IF NOT EXISTS follower_snapshots (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  follower_count INTEGER NOT NULL,
  following_count INTEGER DEFAULT 0,
  tweet_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'scraped', -- 'scraped' or 'estimated'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_timestamp ON follower_snapshots(timestamp DESC);

-- Add comment
COMMENT ON TABLE follower_snapshots IS 'Periodic snapshots of account metrics for growth tracking and attribution';


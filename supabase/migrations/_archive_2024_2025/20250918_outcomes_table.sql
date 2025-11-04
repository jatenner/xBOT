-- Outcomes table for unified decision tracking
-- Stores both real (simulated=false) and synthetic (simulated=true) outcomes
-- Used by learning system to update bandit arms and train predictors

CREATE TABLE IF NOT EXISTS outcomes (
  id BIGSERIAL PRIMARY KEY,
  decision_id TEXT NOT NULL,        -- reference to decisions.id (text/uuid tolerated)
  tweet_id TEXT,                    -- set for real posts
  simulated BOOLEAN NOT NULL DEFAULT false,
  impressions INT,
  likes INT,
  retweets INT,
  replies INT,
  bookmarks INT,
  quotes INT,
  engagement_rate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_outcomes_decision_created ON outcomes(decision_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_tweet_created ON outcomes(tweet_id, created_at DESC);

-- Comments for clarity
COMMENT ON TABLE outcomes IS 'Unified outcome tracking for both real and simulated engagement data';
COMMENT ON COLUMN outcomes.simulated IS 'false=real Twitter metrics, true=synthetic shadow mode data';

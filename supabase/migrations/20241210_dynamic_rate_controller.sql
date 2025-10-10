-- Dynamic Rate Controller - Rate Decision Tracking
-- Stores decisions made by the dynamic rate controller for learning and optimization

CREATE TABLE IF NOT EXISTS rate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posts_per_hour INTEGER NOT NULL,
  replies_per_hour INTEGER NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  reasoning TEXT[] NOT NULL,
  should_scale_up BOOLEAN NOT NULL DEFAULT FALSE,
  should_scale_down BOOLEAN NOT NULL DEFAULT FALSE,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for recent decisions lookup
CREATE INDEX IF NOT EXISTS idx_rate_decisions_created_at ON rate_decisions(created_at DESC);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_rate_decisions_scaling ON rate_decisions(should_scale_up, should_scale_down, created_at);

-- Comments
COMMENT ON TABLE rate_decisions IS 'Tracks dynamic rate controller decisions for learning and optimization';
COMMENT ON COLUMN rate_decisions.posts_per_hour IS 'Recommended posts per hour';
COMMENT ON COLUMN rate_decisions.replies_per_hour IS 'Recommended replies per hour';
COMMENT ON COLUMN rate_decisions.confidence IS 'Confidence in recommendation (0.0-1.0)';
COMMENT ON COLUMN rate_decisions.reasoning IS 'Array of reasons for the rate decision';
COMMENT ON COLUMN rate_decisions.metrics IS 'Performance metrics that influenced the decision';

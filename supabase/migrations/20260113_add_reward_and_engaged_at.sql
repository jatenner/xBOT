-- Add reward_24h and engaged_at columns to reply_decisions
-- For learning loop v1: track rewards and when engagement was recorded

ALTER TABLE reply_decisions
  ADD COLUMN IF NOT EXISTS reward_24h numeric,
  ADD COLUMN IF NOT EXISTS engaged_at timestamptz;

-- Index for reward queries
CREATE INDEX IF NOT EXISTS idx_reply_decisions_reward_24h 
  ON reply_decisions(reward_24h) 
  WHERE reward_24h IS NOT NULL;

-- Index for engaged_at queries
CREATE INDEX IF NOT EXISTS idx_reply_decisions_engaged_at 
  ON reply_decisions(engaged_at) 
  WHERE engaged_at IS NOT NULL;

COMMENT ON COLUMN reply_decisions.reward_24h IS 'Reward signal computed from 24h engagement metrics (likes + replies*3 + retweets*2 + views*0.1)';
COMMENT ON COLUMN reply_decisions.engaged_at IS 'Timestamp when engagement metrics were recorded and reward_24h was computed';

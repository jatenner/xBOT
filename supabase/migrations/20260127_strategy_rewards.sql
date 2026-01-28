-- ═══════════════════════════════════════════════════════════════════════════════
-- STRATEGY REWARDS TABLE
-- 
-- Purpose: Track reward signals per strategy for ε-greedy learning
-- Stores aggregated reward statistics (mean, total, sample count) per strategy
-- 
-- Date: January 27, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create strategy_rewards table
CREATE TABLE IF NOT EXISTS strategy_rewards (
  strategy_id TEXT NOT NULL,
  strategy_version TEXT NOT NULL DEFAULT '1',
  
  -- Aggregated statistics
  sample_count INTEGER NOT NULL DEFAULT 0,
  total_reward DOUBLE PRECISION NOT NULL DEFAULT 0,
  mean_reward DOUBLE PRECISION NOT NULL DEFAULT 0,
  
  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  PRIMARY KEY (strategy_id, strategy_version)
);

-- Index for efficient ε-greedy selection (sort by mean_reward desc)
CREATE INDEX IF NOT EXISTS idx_strategy_rewards_mean_reward 
  ON strategy_rewards(mean_reward DESC);

-- Index for filtering by sample_count (for min_samples threshold)
CREATE INDEX IF NOT EXISTS idx_strategy_rewards_sample_count 
  ON strategy_rewards(sample_count DESC);

-- Function to atomically update reward statistics
CREATE OR REPLACE FUNCTION update_strategy_reward(
  p_strategy_id TEXT,
  p_strategy_version TEXT,
  p_reward DOUBLE PRECISION
) RETURNS VOID AS $$
BEGIN
  INSERT INTO strategy_rewards (
    strategy_id,
    strategy_version,
    sample_count,
    total_reward,
    mean_reward,
    last_updated_at
  ) VALUES (
    p_strategy_id,
    p_strategy_version,
    1,
    p_reward,
    p_reward,
    NOW()
  )
  ON CONFLICT (strategy_id, strategy_version)
  DO UPDATE SET
    sample_count = strategy_rewards.sample_count + 1,
    total_reward = strategy_rewards.total_reward + p_reward,
    mean_reward = (strategy_rewards.total_reward + p_reward) / (strategy_rewards.sample_count + 1),
    last_updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE strategy_rewards IS 'Reward statistics per strategy for ε-greedy learning';
COMMENT ON COLUMN strategy_rewards.strategy_id IS 'Strategy identifier (e.g., "baseline", "high_topic_fit", "tier_s")';
COMMENT ON COLUMN strategy_rewards.strategy_version IS 'Strategy version for A/B testing';
COMMENT ON COLUMN strategy_rewards.mean_reward IS 'Average reward per sample (used for ε-greedy exploit)';
COMMENT ON COLUMN strategy_rewards.sample_count IS 'Number of samples (used for min_samples threshold)';

COMMIT;

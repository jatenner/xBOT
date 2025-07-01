-- Monthly Budget Management System Migration
-- Creates intelligent monthly budget distribution (1500 tweets/month)

-- Create monthly_budget_state table for tracking monthly tweet budget
CREATE TABLE IF NOT EXISTS monthly_budget_state (
  month TEXT PRIMARY KEY, -- YYYY-MM format
  tweets_used INTEGER DEFAULT 0,
  tweets_budget INTEGER DEFAULT 1500,
  days_remaining INTEGER DEFAULT 30,
  daily_targets JSONB DEFAULT '{}',
  strategic_reserves INTEGER DEFAULT 225, -- 15% of 1500
  performance_multiplier REAL DEFAULT 1.0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update bot_config to use intelligent monthly budget system
INSERT INTO bot_config (key, value, description) VALUES 
(
  'monthly_budget_config',
  '{
    "monthly_tweet_budget": 1500,
    "dynamic_daily_targeting": true,
    "max_daily_tweets": 75,
    "min_daily_tweets": 20,
    "baseline_daily_target": 50,
    "strategic_reserve_percentage": 0.15,
    "performance_boost_enabled": true,
    "opportunity_boost_enabled": true
  }',
  'Intelligent monthly budget management configuration'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Initialize current month's budget state
INSERT INTO monthly_budget_state (month, tweets_used, tweets_budget) 
VALUES (
  TO_CHAR(NOW(), 'YYYY-MM'), 
  0, 
  1500
)
ON CONFLICT (month) DO NOTHING;

-- Update runtime_config to use new intelligent system
UPDATE bot_config 
SET value = jsonb_set(
  COALESCE(value, '{}'),
  '{posting_strategy}',
  '"intelligent_monthly_budget"'
)
WHERE key = 'runtime_config';

UPDATE bot_config 
SET value = jsonb_set(
  COALESCE(value, '{}'),
  '{fallback_stagger_minutes}',
  '30'
)
WHERE key = 'runtime_config';

-- Remove artificial daily limits
DELETE FROM bot_config WHERE key = 'target_tweets_per_day' AND CAST(value AS TEXT)::INTEGER < 50;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_monthly_budget_month ON monthly_budget_state(month);
CREATE INDEX IF NOT EXISTS idx_monthly_budget_updated ON monthly_budget_state(last_updated);

-- Add comments
COMMENT ON TABLE monthly_budget_state IS 'Tracks monthly Twitter API budget usage and intelligent daily distribution';
COMMENT ON COLUMN monthly_budget_state.strategic_reserves IS 'Tweets reserved for viral opportunities and trending topics';
COMMENT ON COLUMN monthly_budget_state.performance_multiplier IS 'Multiplier based on recent engagement performance';
COMMENT ON COLUMN monthly_budget_state.daily_targets IS 'JSON object storing calculated daily targets for each date'; 
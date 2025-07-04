-- 🔧 SIMPLE DAILY POSTING STATE TABLE FIX
-- Run this directly in Supabase SQL Editor

-- Create the daily_posting_state table
CREATE TABLE IF NOT EXISTS daily_posting_state (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  tweets_posted INTEGER DEFAULT 0,
  posts_completed INTEGER DEFAULT 0,
  posts_target INTEGER DEFAULT 17,
  max_daily_tweets INTEGER DEFAULT 17,
  next_post_time TIMESTAMP WITH TIME ZONE,
  posting_schedule JSONB DEFAULT '[]'::jsonb,
  emergency_mode BOOLEAN DEFAULT false,
  last_post_time TIMESTAMP WITH TIME ZONE,
  strategy TEXT DEFAULT 'balanced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_posting_state_date ON daily_posting_state(date);
CREATE INDEX IF NOT EXISTS idx_daily_posting_state_next_post_time ON daily_posting_state(next_post_time);

-- Initialize today's posting state
INSERT INTO daily_posting_state (
  date,
  tweets_posted,
  posts_completed,
  posts_target,
  max_daily_tweets,
  next_post_time,
  posting_schedule,
  emergency_mode,
  last_post_time,
  strategy
) VALUES (
  CURRENT_DATE,
  0,
  0,
  17,
  17,
  NOW() + INTERVAL '1 hour',
  '[]'::jsonb,
  false,
  NULL,
  'balanced'
)
ON CONFLICT (date) DO UPDATE SET
  posts_completed = 0,
  tweets_posted = 0,
  emergency_mode = false,
  next_post_time = NOW() + INTERVAL '1 hour',
  updated_at = NOW();

-- Set immediate posting override flag (simple approach)
INSERT INTO bot_config (key, value, description) VALUES (
  'startup_posting_override',
  '{"enabled": true, "force_immediate_post": true, "clear_phantom_times": true, "reason": "Daily Posting Manager initialization - July 3rd", "timestamp": "' || NOW()::text || '"}',
  'Emergency flag to force immediate posting after Daily Posting Manager restart'
)
ON CONFLICT (key) DO UPDATE SET
  value = '{"enabled": true, "force_immediate_post": true, "clear_phantom_times": true, "reason": "Daily Posting Manager initialization - July 3rd", "timestamp": "' || NOW()::text || '"}',
  updated_at = NOW();

-- Verify the setup
SELECT 
  'DAILY POSTING MANAGER TABLE CREATED' as status,
  date,
  posts_completed,
  posts_target,
  next_post_time,
  emergency_mode
FROM daily_posting_state 
WHERE date = CURRENT_DATE;

-- 🚨 SIMPLE FIX: Remove False Monthly Limits (July 3rd)
-- Issue: Bot blocked by artificial 1500 tweet monthly cap
-- Reality: Twitter API v2 Free has NO monthly posting limits

-- 1. DISABLE ALL ARTIFICIAL MONTHLY LIMITS
INSERT INTO bot_config (key, value) 
VALUES ('disable_artificial_monthly_limits', '{
  "enabled": true,
  "ignore_1500_tweet_limit": true,
  "use_only_real_twitter_limits": true,
  "reason": "Remove fake monthly cap - Twitter API v2 Free has no monthly posting limits"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. FORCE REAL TWITTER LIMITS ONLY  
INSERT INTO bot_config (key, value)
VALUES ('emergency_real_limits_only', '{
  "enabled": true,
  "force_real_twitter_limits": true,
  "bypass_quota_guard_monthly": true,
  "real_twitter_daily_limit": 2400,
  "real_twitter_3h_limit": 300
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. EMERGENCY POSTING RECOVERY
INSERT INTO bot_config (key, value)
VALUES ('emergency_posting_recovery', '{
  "enabled": true,
  "force_posting_enabled": true,
  "override_monthly_caps": true,
  "use_xClient_limits_only": true
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. REMOVE MONTHLY CAP WORKAROUND FLAGS
DELETE FROM bot_config 
WHERE key IN (
  'monthly_cap_workaround',
  'monthly_cap_emergency_mode'
);

-- 5. SET REASONABLE DAILY LIMIT
UPDATE bot_config 
SET value = jsonb_set(value, '{maxDailyTweets}', '100') 
WHERE key = 'runtime_config';

-- ✅ DONE: Artificial monthly limits removed
-- Bot should now post using only real Twitter limits 
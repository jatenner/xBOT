-- 🔧 FIXED SQL for Supabase - Real Twitter Rate Limits Setup
-- Run this in your Supabase SQL Editor

BEGIN;

-- 1. Remove artificial monthly cap modes
UPDATE bot_config 
SET value = jsonb_set(COALESCE(value, '{}'), '{enabled}', 'false'::jsonb)
WHERE key IN ('emergency_monthly_cap_mode', 'smart_monthly_cap_mode', 'monthly_cap_workaround');

-- 2. Set real Twitter rate limits configuration (FIXED JSON)
INSERT INTO bot_config (key, value, description, created_by)
VALUES (
  'real_twitter_limits',
  jsonb_build_object(
    'tweets_3_hour', jsonb_build_object(
      'limit', 300,
      'description', 'Real Twitter API v2 Free Tier: 300 tweets per 3-hour rolling window'
    ),
    'tweets_24_hour', jsonb_build_object(
      'limit', 2400,
      'description', 'Real Twitter API v2 Free Tier: 2400 tweets per 24-hour rolling window'
    ),
    'enabled', true,
    'artificial_limits_removed', true
  ),
  'Real Twitter API rate limits - no artificial caps',
  'migration'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 3. Update runtime config to remove artificial limits
UPDATE bot_config 
SET value = jsonb_build_object(
  'quality', jsonb_build_object(
    'readabilityMin', 55,
    'credibilityMin', 0.85
  ),
  'fallbackStaggerMinutes', 30,
  'postingStrategy', 'real_twitter_limits_only',
  'artificial_limits_removed', true,
  'maxDailyTweets', null,
  'monthlyTweetBudget', null
)
WHERE key = 'runtime_config';

-- 4. Clean up artificial limit tracking tables
DROP TABLE IF EXISTS twitter_api_limits CASCADE;
DROP TABLE IF EXISTS daily_posting_state CASCADE;

-- 5. Create new rate limit tracking table for real Twitter limits
CREATE TABLE IF NOT EXISTS real_twitter_rate_limits (
  id SERIAL PRIMARY KEY,
  window_type VARCHAR(20) NOT NULL CHECK (window_type IN ('3_hour', '24_hour')),
  tweets_used INTEGER DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  window_end TIMESTAMP WITH TIME ZONE,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Insert initial rate limit windows
INSERT INTO real_twitter_rate_limits (window_type, tweets_used, window_start, window_end)
VALUES 
  ('3_hour', 0, NOW(), NOW() + INTERVAL '3 hours'),
  ('24_hour', 0, NOW(), NOW() + INTERVAL '24 hours')
ON CONFLICT DO NOTHING;

-- 7. Create function to reset rate limit windows
CREATE OR REPLACE FUNCTION reset_rate_limit_window(window_type_param VARCHAR(20))
RETURNS VOID AS $$
BEGIN
  UPDATE real_twitter_rate_limits
  SET 
    tweets_used = 0,
    window_start = NOW(),
    window_end = CASE 
      WHEN window_type_param = '3_hour' THEN NOW() + INTERVAL '3 hours'
      WHEN window_type_param = '24_hour' THEN NOW() + INTERVAL '24 hours'
    END,
    last_reset = NOW(),
    updated_at = NOW()
  WHERE window_type = window_type_param;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to increment tweet count
CREATE OR REPLACE FUNCTION increment_tweet_count()
RETURNS VOID AS $$
BEGIN
  -- Reset windows if they've expired
  UPDATE real_twitter_rate_limits
  SET 
    tweets_used = 0,
    window_start = NOW(),
    window_end = CASE 
      WHEN window_type = '3_hour' THEN NOW() + INTERVAL '3 hours'
      WHEN window_type = '24_hour' THEN NOW() + INTERVAL '24 hours'
    END,
    last_reset = NOW(),
    updated_at = NOW()
  WHERE window_end < NOW();
  
  -- Increment counters
  UPDATE real_twitter_rate_limits
  SET 
    tweets_used = tweets_used + 1,
    updated_at = NOW()
  WHERE window_end >= NOW();
END;
$$ LANGUAGE plpgsql;

-- 9. Add user ID configuration support
INSERT INTO bot_config (key, value, description, created_by)
VALUES (
  'twitter_user_id_cached',
  jsonb_build_object(
    'enabled', false,
    'user_id', null,
    'cached_at', null,
    'eliminates_users_me_calls', true
  ),
  'Cached Twitter user ID to eliminate /users/me API calls',
  'migration'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 10. Clean up any remaining artificial monthly cap configurations
DELETE FROM bot_config 
WHERE key IN (
  'monthly_cap_emergency_mode',
  'monthly_cap_detection',
  'false_monthly_cap_fix',
  'daily_tweet_limit',
  'monthly_tweet_limit'
);

-- 11. Update posting strategy to enforce real limits only
UPDATE bot_config 
SET value = jsonb_build_object('strategy', 'real_twitter_limits_only')
WHERE key = 'posting_strategy';

-- 12. Add configuration for rate limit monitoring
INSERT INTO bot_config (key, value, description, created_by)
VALUES (
  'rate_limit_monitoring',
  jsonb_build_object(
    'enabled', true,
    'track_429_responses', true,
    'reset_on_429', true,
    'log_all_rate_limits', true,
    'artificial_limits_disabled', true
  ),
  'Real-time rate limit monitoring based on HTTP 429 responses',
  'migration'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

COMMIT;

-- Verification queries (run these after the migration)
SELECT 'Real Twitter Limits Config:' as check_type, value 
FROM bot_config WHERE key = 'real_twitter_limits';

SELECT 'Runtime Config:' as check_type, value 
FROM bot_config WHERE key = 'runtime_config';

SELECT 'Rate Limit Windows:' as check_type, window_type, tweets_used, window_end 
FROM real_twitter_rate_limits;

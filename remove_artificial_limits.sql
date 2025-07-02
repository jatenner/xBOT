-- 🚨 REMOVE ARTIFICIAL TWITTER LIMITS MIGRATION
-- This migration removes all artificial daily/monthly caps and enables real Twitter API limits only
-- Real Twitter API v2 Free Tier: 300 tweets/3h, 2400 tweets/24h

-- =============================================
-- 1. REMOVE ARTIFICIAL MONTHLY/DAILY CAP MODES
-- =============================================

-- Disable all artificial monthly cap modes
UPDATE bot_config 
SET value = jsonb_set(value, '{enabled}', 'false')
WHERE key IN ('emergency_monthly_cap_mode', 'smart_monthly_cap_mode', 'monthly_cap_workaround');

-- Remove artificial daily caps from runtime config
UPDATE bot_config 
SET value = value - 'maxDailyTweets' - 'max_daily_tweets' - 'monthlyTweetBudget' - 'dynamicDailyTargeting'
WHERE key = 'runtime_config';

-- =============================================
-- 2. UPDATE TO REAL TWITTER LIMITS
-- =============================================

-- Set real Twitter rate limits configuration
INSERT INTO bot_config (key, value, description, created_by)
VALUES (
  'real_twitter_limits',
  '{"tweets_3_hour": {"limit": 300}, "tweets_24_hour": {"limit": 2400}, "enabled": true}',
  'Real Twitter API rate limits - no artificial caps',
  'migration'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- =============================================
-- 3. CLEAN UP ARTIFICIAL LIMIT TRACKING
-- =============================================

-- Remove twitter_api_limits table if it exists (artificial tracking)
DROP TABLE IF EXISTS twitter_api_limits CASCADE;

-- Remove daily posting state tracking (artificial)
DROP TABLE IF EXISTS daily_posting_state CASCADE;

COMMIT;

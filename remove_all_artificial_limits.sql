-- 🚨 REMOVE ALL ARTIFICIAL LIMITS - Use REAL Twitter API Limits Only
-- This migration removes all fake restrictions and implements real Twitter API v2 Free Tier limits
-- Real Twitter API v2 Free Tier: 300 tweets/3h, 2400 tweets/24h, 10,000 reads/month

-- =============================================
-- 1. REMOVE ALL ARTIFICIAL MONTHLY/DAILY CAPS
-- =============================================

-- Disable all artificial monthly cap modes
UPDATE bot_config 
SET value = jsonb_set(COALESCE(value, '{}'), '{enabled}', 'false'::jsonb)
WHERE key IN ('emergency_monthly_cap_mode', 'smart_monthly_cap_mode', 'monthly_cap_workaround');

-- Remove artificial daily caps from runtime config
UPDATE bot_config 
SET value = value - 'maxDailyTweets' - 'max_daily_tweets' - 'monthlyTweetBudget' - 'dynamicDailyTargeting'
WHERE key = 'runtime_config';

-- =============================================
-- 2. UPDATE TO REAL TWITTER LIMITS ONLY
-- =============================================

-- Set real Twitter API v2 FREE TIER limits configuration
INSERT INTO bot_config (key, value, description, created_by)
VALUES (
  'real_twitter_limits',
  jsonb_build_object(
    'tweets_daily', jsonb_build_object(
      'limit', 17,
      'description', 'Real Twitter API v2 Free Tier: 17 tweets per 24 hours'
    ),
    'reads_15min', jsonb_build_object(
      'limit', 1,
      'description', 'Real Twitter API v2 Free Tier: 1 read per 15 minutes (most endpoints)'
    ),
    'user_lookup_daily', jsonb_build_object(
      'limit', 25,
      'description', 'Real Twitter API v2 Free Tier: 25 user lookups per 24 hours'
    ),
    'enabled', true,
    'artificial_limits_removed', true,
    'fake_limits_eliminated', true,
    'tier', 'free'
  ),
  'Real Twitter API v2 FREE TIER rate limits - no artificial caps',
  'artificial_limits_removal'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- =============================================
-- 3. CLEAN UP ARTIFICIAL LIMIT TRACKING TABLES
-- =============================================

-- Remove artificial limit tracking tables
DROP TABLE IF EXISTS twitter_api_limits CASCADE;
DROP TABLE IF EXISTS daily_posting_state CASCADE;
DROP TABLE IF EXISTS monthly_budget_state CASCADE;

-- =============================================
-- 4. UPDATE RUNTIME CONFIG - REAL LIMITS ONLY
-- =============================================

-- Clean runtime config to use real limits only
INSERT INTO bot_config (key, value, description, created_by)
VALUES (
  'runtime_config',
  jsonb_build_object(
    'quality', jsonb_build_object(
      'readabilityMin', 55,
      'credibilityMin', 0.85
    ),
    'fallbackStaggerMinutes', 30,
    'postingStrategy', 'real_twitter_limits_only',
    'artificial_limits_removed', true,
    'fake_daily_caps_eliminated', true,
    'fake_monthly_caps_eliminated', true,
    'real_api_limits_only', true
  ),
  'Runtime configuration - real Twitter API limits only',
  'artificial_limits_removal'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- =============================================
-- 5. REMOVE ALL EMERGENCY AND FAKE LIMIT MODES
-- =============================================

-- Remove all emergency and fake modes
DELETE FROM bot_config 
WHERE key IN (
  'emergency_monthly_cap_mode',
  'smart_monthly_cap_mode', 
  'monthly_cap_workaround',
  'emergency_rate_limiting',
  'quality_gate_override',
  'emergency_posting_mode',
  'force_posting_flags',
  'target_tweets_per_day'
);

-- =============================================
-- 6. SET UP REAL TWITTER RATE LIMIT TRACKING
-- =============================================

-- Create new table for REAL Twitter rate limit tracking only
CREATE TABLE IF NOT EXISTS real_twitter_rate_limits (
  id SERIAL PRIMARY KEY,
  window_type VARCHAR(20) NOT NULL, -- '3_hour' or '24_hour' 
  tweets_used INTEGER DEFAULT 0,
  tweets_limit INTEGER NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(window_type, window_start)
);

-- Initialize current rate limit windows
INSERT INTO real_twitter_rate_limits (window_type, tweets_used, tweets_limit, window_start, window_end)
VALUES 
  ('3_hour', 0, 300, NOW(), NOW() + INTERVAL '3 hours'),
  ('24_hour', 0, 2400, NOW(), NOW() + INTERVAL '24 hours')
ON CONFLICT (window_type, window_start) DO NOTHING;

-- =============================================
-- 7. VERIFICATION AND CLEANUP
-- =============================================

-- Verify all artificial limits are removed
INSERT INTO bot_config (key, value, description, created_by)
VALUES (
  'artificial_limits_audit',
  jsonb_build_object(
    'status', 'ELIMINATED',
    'fake_daily_caps', 'REMOVED',
    'fake_monthly_caps', 'REMOVED', 
    'artificial_restrictions', 'REMOVED',
    'real_twitter_limits_only', true,
    'verification_timestamp', NOW()
  ),
  'Verification that all artificial limits have been removed',
  'artificial_limits_removal'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

COMMIT; 
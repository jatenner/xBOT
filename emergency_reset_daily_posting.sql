-- 🎯 EMERGENCY RESET: Daily Posting State Only
-- KEEP QUALITY SETTINGS: 6/55/0.85/90
-- Only reset posting counters to allow new posts

-- 1. Reset daily posting state for today
DELETE FROM daily_posting_state WHERE date = CURRENT_DATE;

INSERT INTO daily_posting_state (
  date,
  tweets_posted,
  posts_completed,
  max_daily_tweets,
  posts_target,
  last_post_time,
  next_post_time,
  posting_schedule,
  emergency_mode,
  strategy
) VALUES (
  CURRENT_DATE,
  0,                              -- Reset to 0 posts
  0,                              -- Reset completed count
  6,                              -- Keep existing daily limit
  6,                              -- Keep existing target
  NULL,                           -- No last post
  NOW(),                          -- Next post can be now
  '[]'::jsonb,                    -- Empty schedule (will be regenerated)
  false,                          -- No emergency mode
  'balanced'                      -- Keep existing strategy
);

-- 2. Add emergency bypass flags (without changing quality settings)
INSERT INTO bot_config (key, value, updated_at)
VALUES (
  'emergency_posting_bypass',
  '{
    "daily_limit_bypass": true,
    "api_error_bypass": true,
    "method_error_fallback": true,
    "twitter_rate_limit_pause": 3600
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 3. Verify current runtime config (should remain unchanged)
SELECT 
  key,
  value->>'maxDailyTweets' as daily_limit,
  value->'quality'->>'readabilityMin' as readability,
  value->'quality'->>'credibilityMin' as credibility,
  value->>'fallbackStaggerMinutes' as stagger_minutes
FROM bot_config 
WHERE key = 'runtime_config';

-- 4. Verify daily posting reset
SELECT 
  date,
  tweets_posted,
  posts_completed,
  max_daily_tweets,
  emergency_mode,
  strategy
FROM daily_posting_state 
WHERE date = CURRENT_DATE;

-- 5. Show emergency flags
SELECT 
  key,
  value
FROM bot_config 
WHERE key = 'emergency_posting_bypass';

-- Expected Results:
-- ✅ daily_posting_state: 0/6 posts (RESET)
-- ✅ runtime_config: 6/55/0.85/90 (UNCHANGED)
-- ✅ emergency_posting_bypass: active (NEW) 
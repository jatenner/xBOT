-- 🚨 EMERGENCY FORCE HUMAN EXPERT POST
-- This completely bypasses all failing systems and forces immediate posting

-- Clear all blocking configurations
DELETE FROM bot_config WHERE key IN (
  'emergency_posting_disabled',
  'startup_conservation_mode',
  'api_rate_limiting',
  'content_generation_pause'
);

-- Force emergency posting mode
INSERT INTO bot_config (key, value) 
VALUES ('emergency_force_post_now', '{
  "enabled": true,
  "bypass_all_checks": true,
  "force_human_expert": true,
  "ignore_rate_limits": true,
  "ignore_failures": true,
  "emergency_reason": "Human Expert content quality fix - force immediate post",
  "timestamp": "2025-07-03T16:45:00.000Z"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Disable all failing systems temporarily
INSERT INTO bot_config (key, value) 
VALUES ('disable_failing_systems', '{
  "disable_search_api": true,
  "disable_news_api": true,
  "disable_viral_analysis": true,
  "disable_competitive_intelligence": true,
  "force_simple_posting": true,
  "reason": "Bypass failing systems to enable Human Expert posting",
  "timestamp": "2025-07-03T16:45:00.000Z"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Force immediate next post time
UPDATE daily_posting_state 
SET 
  next_post_time = NOW(),
  emergency_mode = true,
  posting_schedule = '["immediate"]'::jsonb
WHERE date = CURRENT_DATE;

-- Verify configurations
SELECT 
  key, 
  value->'enabled' as enabled,
  value->'reason' as reason
FROM bot_config 
WHERE key IN (
  'emergency_force_post_now',
  'disable_failing_systems',
  'content_mode_override'
); 
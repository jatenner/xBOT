-- 🚨 EMERGENCY MONTHLY API CAP RESOLUTION
-- Disable all read-heavy operations to focus on posting quality content

-- Disable all operations that use Twitter read API
INSERT INTO bot_config (key, value) 
VALUES ('monthly_cap_emergency_mode', '{
  "enabled": true,
  "disable_search_operations": true,
  "disable_engagement_tracking": true,
  "disable_competitive_intelligence": true,
  "disable_reply_finding": true,
  "disable_follow_operations": true,
  "focus_posting_only": true,
  "reason": "Monthly API cap hit - focus on posting quality Human Expert content only",
  "timestamp": "2025-07-03T17:15:00.000Z"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Force posting-only mode with Human Expert content
INSERT INTO bot_config (key, value) 
VALUES ('posting_only_mode', '{
  "enabled": true,
  "human_expert_priority": 100,
  "disable_all_reads": true,
  "post_frequency": "every_2_hours",
  "quality_focus": "maximum",
  "reason": "API cap emergency - quality posts only",
  "timestamp": "2025-07-03T17:15:00.000Z"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Set realistic posting schedule under API constraints
UPDATE daily_posting_state 
SET 
  posts_target = 8,
  max_daily_tweets = 8,
  emergency_mode = true,
  posting_schedule = '["10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "21:00", "22:00"]'::jsonb
WHERE date = CURRENT_DATE;

-- Verify configurations
SELECT 
  key, 
  value->'enabled' as enabled,
  value->'reason' as reason
FROM bot_config 
WHERE key IN (
  'monthly_cap_emergency_mode',
  'posting_only_mode',
  'content_mode_override'
); 
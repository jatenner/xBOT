-- 🧠 EMERGENCY HUMAN EXPERT QUALITY FIX
-- Run this in Supabase SQL Editor to force better content quality

-- Force Human Expert mode exclusively
INSERT INTO bot_config (key, value) 
VALUES ('content_mode_override', '{
  "enabled": true,
  "force_human_expert": true,
  "disable_viral_contamination": true,
  "disable_nuclear_enhancement": true,
  "reason": "Emergency quality fix - prevent terrible bot content",
  "timestamp": "2025-07-03T14:00:00.000Z"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Set emergency posting override
INSERT INTO bot_config (key, value) 
VALUES ('startup_posting_override', '{
  "enabled": true,
  "force_immediate_post": true,
  "force_human_expert_mode": true,
  "clear_phantom_times": true,
  "reason": "Quality improvement - switching to Human Expert only",
  "timestamp": "2025-07-03T14:00:00.000Z"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Enforce content quality standards
INSERT INTO bot_config (key, value) 
VALUES ('content_quality_enforcement', '{
  "enabled": true,
  "require_persona_compliance": true,
  "block_academic_language": true,
  "block_hashtags": true,
  "enforce_conversational_tone": true,
  "minimum_quality_score": 0.8,
  "timestamp": "2025-07-03T14:00:00.000Z"
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Verify the configurations
SELECT key, value FROM bot_config 
WHERE key IN (
  'content_mode_override', 
  'startup_posting_override', 
  'content_quality_enforcement'
);

-- Clear any phantom posting blocks
UPDATE daily_posting_state 
SET 
  emergency_mode = false,
  next_post_time = NOW() + INTERVAL '5 minutes'
WHERE date = CURRENT_DATE; 
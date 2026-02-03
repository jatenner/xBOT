-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATE content_metadata VIEW TO INCLUDE RATE CONTROLLER COLUMNS
-- 
-- Adds prompt_version, strategy_id, hour_bucket, outcome_score to the view
-- These columns were added to content_generation_metadata_comprehensive in
-- 20260203_rate_controller_schema.sql
-- 
-- Date: February 3, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Recreate view with new columns
DROP VIEW IF EXISTS content_metadata CASCADE;

CREATE VIEW content_metadata AS
SELECT 
  decision_id,
  decision_type,
  content,
  thread_parts,
  status,
  created_at,
  posted_at,
  scheduled_at,
  tweet_id,
  generator_name,
  quality_score,
  predicted_er,
  topic_cluster,
  target_tweet_id,
  target_username,
  visual_format,
  content_slot,
  experiment_group,
  hook_variant,
  generation_source,
  angle,
  tone,
  format_strategy,
  bandit_arm,
  features,
  updated_at,
  -- Rate controller columns (added 2026-02-03)
  prompt_version,
  strategy_id,
  hour_bucket,
  outcome_score
FROM content_generation_metadata_comprehensive;

-- Restore permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO service_role;

COMMENT ON VIEW content_metadata IS 
  'Unified view of content metadata with all required columns including rate controller tracking';

COMMIT;

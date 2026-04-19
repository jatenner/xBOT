-- Phase 0.2: Baseline capture status
-- Distinguishes "we didn't measure" from "we measured zero gain" in the learning signal.
-- Previously, when MultiPointFollowerTracker.captureBaseline() failed/timed out/was disabled,
-- downstream learning read followers_before=NULL as 0, silently polluting the attribution signal.

BEGIN;

ALTER TABLE content_generation_metadata_comprehensive
  ADD COLUMN IF NOT EXISTS baseline_status TEXT
    CHECK (baseline_status IN ('success', 'failed', 'timeout', 'disabled', 'pending'));

ALTER TABLE content_generation_metadata_comprehensive
  ADD COLUMN IF NOT EXISTS baseline_error TEXT;

COMMENT ON COLUMN content_generation_metadata_comprehensive.baseline_status IS
  'Outcome of MultiPointFollowerTracker.captureBaseline at post time. '
  'Learning queries must filter to baseline_status = ''success'' before trusting followers_before.';

CREATE INDEX IF NOT EXISTS idx_content_gen_baseline_status
  ON content_generation_metadata_comprehensive(baseline_status)
  WHERE baseline_status IS NOT NULL;

-- Recreate content_metadata view to expose the new columns.
-- (Keep column list identical to 20251027_add_format_strategy_column.sql + new columns.)
-- CREATE OR REPLACE (not DROP CASCADE) because vw_learning and other dependents
-- read FROM content_metadata; CASCADE would silently drop them. As long as we
-- only append columns at the end and don't change existing types, REPLACE works.
CREATE OR REPLACE VIEW content_metadata AS
SELECT
  id,
  decision_id,
  content,
  thread_parts,
  topic_cluster,
  generation_source,
  generator_name,
  generator_confidence,
  bandit_arm,
  timing_arm,
  angle,
  style,
  hook_type,
  hook_pattern,
  cta_type,
  fact_source,
  fact_count,
  quality_score,
  predicted_er,
  predicted_engagement,
  novelty,
  readability_score,
  sentiment,
  actual_likes,
  actual_retweets,
  actual_replies,
  actual_impressions,
  actual_engagement_rate,
  viral_score,
  prediction_accuracy,
  style_effectiveness,
  hook_effectiveness,
  cta_effectiveness,
  fact_resonance,
  status,
  scheduled_at,
  posted_at,
  tweet_id,
  skip_reason,
  error_message,
  target_tweet_id,
  target_username,
  features,
  content_hash,
  embedding,
  experiment_id,
  experiment_arm,
  thread_length,
  created_at,
  updated_at,
  decision_type,
  raw_topic,
  tone,
  format_strategy,
  baseline_status,
  baseline_error
FROM content_generation_metadata_comprehensive;

COMMIT;

-- =====================================================================================
-- ADD CONTENT_SLOT COLUMN TO CONTENT_METADATA
-- Purpose: Fix database schema mismatch preventing content insertion
-- Date: 2025-01-14
-- Issue: Plan job failing with "Could not find the 'content_slot' column"
-- =====================================================================================

BEGIN;

-- Add content_slot column to underlying table
ALTER TABLE content_generation_metadata_comprehensive 
ADD COLUMN IF NOT EXISTS content_slot TEXT;

-- Recreate VIEW to include content_slot
DROP VIEW IF EXISTS content_metadata CASCADE;

CREATE VIEW content_metadata AS
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
  visual_format,
  content_slot
FROM content_generation_metadata_comprehensive;

COMMIT;


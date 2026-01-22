-- =====================================================================================
-- ADD is_test_post COLUMN TO content_metadata
-- Purpose: Separate test posts from production posts
-- Date: 2026-01-22
-- Note: content_metadata is a VIEW, so we add to underlying table and recreate view
-- =====================================================================================

BEGIN;

-- Add is_test_post column to underlying table (content_metadata is a VIEW)
ALTER TABLE content_generation_metadata_comprehensive
ADD COLUMN IF NOT EXISTS is_test_post BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_content_metadata_is_test_post 
ON content_generation_metadata_comprehensive (is_test_post) 
WHERE is_test_post = true;

-- Recreate VIEW to include new column
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
  content_slot,
  is_test_post  -- ✅ NEW COLUMN
FROM content_generation_metadata_comprehensive;

-- Restore permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO service_role;

-- Add comment for documentation
COMMENT ON COLUMN content_generation_metadata_comprehensive.is_test_post IS 
'Flag to separate test posts from production. Test posts are blocked by default unless ALLOW_TEST_POSTS=true env var is set.';

COMMIT;

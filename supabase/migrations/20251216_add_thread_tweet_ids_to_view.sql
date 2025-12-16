-- =====================================================================================
-- Add thread_tweet_ids to content_metadata view
-- Date: 2025-12-16
-- Purpose: Enable storing all tweet IDs for threads in the view
-- =====================================================================================

BEGIN;

-- Add thread_tweet_ids column to underlying table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'thread_tweet_ids'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN thread_tweet_ids TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.thread_tweet_ids IS 
      'JSON array of all tweet IDs in a thread (null for single tweets)';
  END IF;
END $$;

-- Recreate view to include thread_tweet_ids
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
  content_slot,
  hook_type,
  structure_type,
  visual_format,
  features,
  error_message,
  skip_reason,
  experiment_arm,
  experiment_group,
  hook_variant,
  quality_score,
  predicted_er,
  status,
  scheduled_at,
  posted_at,
  created_at,
  updated_at,
  tweet_id,
  thread_tweet_ids,  -- ✅ NEW: All tweet IDs for threads
  target_tweet_id,
  target_username,
  decision_type,
  format_strategy,
  raw_topic,
  tone,
  actual_impressions,
  actual_likes,
  actual_retweets,
  actual_replies,
  actual_engagement_rate
FROM content_generation_metadata_comprehensive;

-- Restore permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO service_role;

COMMENT ON VIEW content_metadata IS 
  'Unified view of content metadata including thread_tweet_ids for thread tracking';

COMMIT;


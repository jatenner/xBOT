-- =====================================================================================
-- Fix Complete View Columns - Include ALL columns used by code
-- Date: 2025-12-16
-- Purpose: Recreate content_metadata view with ALL required columns
-- =====================================================================================

BEGIN;

-- Ensure all required columns exist in underlying table
DO $$
BEGIN
  -- visual_format
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'visual_format'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN visual_format TEXT DEFAULT NULL;
  END IF;
  
  -- features (JSONB)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'features'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN features JSONB DEFAULT NULL;
  END IF;
  
  -- error_message
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN error_message TEXT DEFAULT NULL;
  END IF;
  
  -- skip_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'skip_reason'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN skip_reason TEXT DEFAULT NULL;
  END IF;
  
  -- experiment_arm (legacy, may not exist)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'experiment_arm'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN experiment_arm TEXT DEFAULT NULL;
  END IF;
  
  -- experiment_group (if experiments enabled)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'experiment_group'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN experiment_group TEXT DEFAULT NULL;
  END IF;
  
  -- hook_variant (if experiments enabled)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'hook_variant'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN hook_variant TEXT DEFAULT NULL;
  END IF;
END $$;

-- Recreate view with ALL columns
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
  'Unified view of content metadata with all required columns (Phase 5 + legacy support)';

COMMIT;


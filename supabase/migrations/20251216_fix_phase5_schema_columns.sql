-- =====================================================================================
-- Fix Phase 5 Schema Columns (hook_type, structure_type)
-- Date: 2025-12-16
-- Purpose: Add missing Phase 5 columns to content_metadata view
-- =====================================================================================

BEGIN;

-- Add structure_type column to underlying table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'structure_type'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN structure_type TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.structure_type IS 
      'Content structure type (single, thread, reply) for Phase 5 voice guide';
  END IF;
END $$;

-- Ensure hook_type exists (should already exist, but check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'hook_type'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN hook_type TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.hook_type IS 
      'Hook type (question, statistic, etc.) for Phase 5 voice guide';
  END IF;
END $$;

-- Recreate view to include hook_type and structure_type
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
  hook_type, -- ✅ Phase 5: Voice guide hook type
  structure_type, -- ✅ Phase 5: Voice guide structure type
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
  'Unified view of content metadata including Phase 5 voice guide columns (hook_type, structure_type)';

COMMIT;


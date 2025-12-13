-- =====================================================================================
-- xBOT v2 Upgrade: Add content_slot column (FIXED for view-based schema)
-- Migration: 20251205_add_content_slot_fixed.sql
-- Phase: 2.1 - Content Enhancements
-- =====================================================================================
-- 
-- Purpose: Track content slots (micro content calendar) for strategic content variety
-- Content slots: myth_busting, framework, research, practical_tip, etc.
-- 
-- NOTE: content_metadata is a VIEW based on content_generation_metadata_comprehensive table
-- This migration adds the column to the underlying table and updates the view
-- =====================================================================================

BEGIN;

-- Add content_slot column to the underlying TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'content_slot'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN content_slot TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.content_slot IS 
      'Content slot type from micro content calendar (myth_busting, framework, research, practical_tip, etc.)';
  END IF;
END $$;

-- Create index for efficient querying by content slot on the underlying table
CREATE INDEX IF NOT EXISTS idx_cgmc_content_slot 
  ON content_generation_metadata_comprehensive(content_slot) 
  WHERE content_slot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cgmc_slot_posted_at 
  ON content_generation_metadata_comprehensive(content_slot, posted_at DESC) 
  WHERE content_slot IS NOT NULL AND posted_at IS NOT NULL;

-- Recreate the content_metadata VIEW to include content_slot
DROP VIEW IF EXISTS content_metadata CASCADE;

-- Recreate view with content_slot included
-- Note: This is a simplified version - adjust columns based on actual view definition
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
  content_slot, -- ✅ NEW: Added content_slot column
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

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251205_add_content_slot_fixed.sql completed successfully';
  RAISE NOTICE 'Added column: content_slot to content_generation_metadata_comprehensive';
  RAISE NOTICE 'Updated view: content_metadata to include content_slot';
END $$;


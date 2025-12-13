-- =====================================================================================
-- xBOT v2 Upgrade: Add content_slot column to content_metadata
-- Migration: 20251205_add_content_slot.sql
-- Phase: 2.1 - Content Enhancements
-- =====================================================================================
-- 
-- Purpose: Track content slots (micro content calendar) for strategic content variety
-- Content slots: myth_busting, framework, research, practical_tip, etc.
-- 
-- Dependencies: None (standalone enhancement)
-- =====================================================================================

-- Add content_slot column to content_metadata table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_metadata' 
    AND column_name = 'content_slot'
  ) THEN
    ALTER TABLE content_metadata 
    ADD COLUMN content_slot TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_metadata.content_slot IS 
      'Content slot type from micro content calendar (myth_busting, framework, research, practical_tip, etc.)';
  END IF;
END $$;

-- Create index for efficient querying by content slot
CREATE INDEX IF NOT EXISTS idx_content_metadata_content_slot 
  ON content_metadata(content_slot) 
  WHERE content_slot IS NOT NULL;

-- Create index for content slot + posted_at (for learning analysis)
CREATE INDEX IF NOT EXISTS idx_content_metadata_slot_posted_at 
  ON content_metadata(content_slot, posted_at DESC) 
  WHERE content_slot IS NOT NULL AND posted_at IS NOT NULL;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251205_add_content_slot.sql completed successfully';
  RAISE NOTICE 'Added column: content_slot to content_metadata';
END $$;


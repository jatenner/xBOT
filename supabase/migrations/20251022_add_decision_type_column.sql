-- ✅ FIX: Add decision_type column to content_metadata
-- This was causing ALL content generation to fail storage
-- Error: "Could not find the 'decision_type' column"
--
-- Applied: 2025-10-22 (emergency fix to production)
-- Impact: Unblocks content generation and posting

-- Add decision_type column to underlying table
ALTER TABLE content_generation_metadata_comprehensive
ADD COLUMN IF NOT EXISTS decision_type TEXT DEFAULT 'single' 
CHECK (decision_type IN ('single', 'thread', 'reply'));

-- Recreate view to include the new column
DROP VIEW IF EXISTS content_metadata CASCADE;

CREATE VIEW content_metadata AS
SELECT * FROM content_generation_metadata_comprehensive;

-- Restore permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO service_role;

-- Add helpful comment
COMMENT ON COLUMN content_generation_metadata_comprehensive.decision_type IS 
  'Type of content: single (tweet), thread (multi-tweet), or reply (to another tweet)';

-- Verify column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'decision_type'
  ) THEN
    RAISE NOTICE '✅ decision_type column exists and accessible';
  ELSE
    RAISE EXCEPTION '❌ decision_type column not found!';
  END IF;
END $$;


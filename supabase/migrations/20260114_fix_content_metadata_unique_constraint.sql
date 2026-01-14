-- =====================================================================================
-- Fix content_metadata duplicate decision_id issue
-- Purpose: Add UNIQUE constraint on decision_id and clean duplicates
-- Date: 2026-01-14
-- =====================================================================================

BEGIN;

-- Step 1: Clean up duplicates (keep newest row per decision_id)
WITH ranked_rows AS (
  SELECT 
    id,
    decision_id,
    ROW_NUMBER() OVER (PARTITION BY decision_id ORDER BY created_at DESC, id DESC) as rn
  FROM content_metadata
  WHERE decision_id IS NOT NULL
)
DELETE FROM content_metadata
WHERE id IN (
  SELECT id FROM ranked_rows WHERE rn > 1
);

-- Step 2: Drop existing unique constraint if it exists (might be named differently)
DO $$
BEGIN
  -- Try to drop constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'content_metadata_decision_id_key' 
    AND conrelid = 'content_metadata'::regclass
  ) THEN
    ALTER TABLE content_metadata DROP CONSTRAINT content_metadata_decision_id_key;
  END IF;
END $$;

-- Step 3: Add UNIQUE constraint on decision_id (only for non-null values)
-- Note: PostgreSQL UNIQUE constraint allows NULL values, but we want to ensure
-- non-null decision_ids are unique
CREATE UNIQUE INDEX IF NOT EXISTS content_metadata_decision_id_unique 
ON content_metadata(decision_id) 
WHERE decision_id IS NOT NULL;

-- Step 4: Add index for faster lookups
CREATE INDEX IF NOT EXISTS content_metadata_decision_id_status_idx 
ON content_metadata(decision_id, status) 
WHERE decision_id IS NOT NULL;

COMMIT;

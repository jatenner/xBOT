-- =====================================================================================
-- Fix content_metadata duplicate decision_id issue
-- Purpose: Add UNIQUE constraint on decision_id and clean duplicates
-- Date: 2026-01-14
-- Note: content_metadata is a VIEW, so we work on the underlying table
-- =====================================================================================

BEGIN;

-- Step 1: Identify the underlying table (likely content_generation_metadata_comprehensive)
-- Clean up duplicates in the underlying table (keep newest row per decision_id)
WITH ranked_rows AS (
  SELECT 
    id,
    decision_id,
    ROW_NUMBER() OVER (PARTITION BY decision_id ORDER BY created_at DESC, id DESC) as rn
  FROM content_generation_metadata_comprehensive
  WHERE decision_id IS NOT NULL
)
DELETE FROM content_generation_metadata_comprehensive
WHERE id IN (
  SELECT id FROM ranked_rows WHERE rn > 1
);

-- Step 2: Drop existing unique constraint/index if it exists
DO $$
BEGIN
  -- Drop unique index if exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'content_generation_metadata_comprehensive_decision_id_unique'
  ) THEN
    DROP INDEX content_generation_metadata_comprehensive_decision_id_unique;
  END IF;
END $$;

-- Step 3: Add UNIQUE index on decision_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS content_generation_metadata_comprehensive_decision_id_unique 
ON content_generation_metadata_comprehensive(decision_id) 
WHERE decision_id IS NOT NULL;

-- Step 4: Add index for faster lookups
CREATE INDEX IF NOT EXISTS content_generation_metadata_comprehensive_decision_id_status_idx 
ON content_generation_metadata_comprehensive(decision_id, status) 
WHERE decision_id IS NOT NULL;

COMMIT;

-- Fix outcomes table: Add unique constraint for upsert operations
-- This fixes the error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- Add unique constraint on decision_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'outcomes_decision_id_unique'
  ) THEN
    ALTER TABLE outcomes ADD CONSTRAINT outcomes_decision_id_unique UNIQUE (decision_id);
  END IF;
END $$;

-- Ensure decision_id is not null
ALTER TABLE outcomes ALTER COLUMN decision_id SET NOT NULL;

COMMENT ON CONSTRAINT outcomes_decision_id_unique ON outcomes IS 'Unique constraint for upsert operations on outcomes table';


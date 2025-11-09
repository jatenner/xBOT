-- ============================================================================
-- FIX OUTCOMES TABLE FOR UPSERT
-- ============================================================================
-- Add unique constraint on decision_id so ON CONFLICT works
-- This allows metrics scraper to update existing rows instead of failing
-- ============================================================================

-- Step 1: Remove duplicate rows if any exist (keep most recent)
DELETE FROM outcomes a USING outcomes b
WHERE a.id < b.id 
  AND a.decision_id = b.decision_id;

-- Step 2: Add unique constraint on decision_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'outcomes_decision_id_unique'
  ) THEN
    ALTER TABLE outcomes
      ADD CONSTRAINT outcomes_decision_id_unique UNIQUE (decision_id);
    
    RAISE NOTICE '✅ Added unique constraint: outcomes.decision_id';
  ELSE
    RAISE NOTICE '✓ Unique constraint already exists: outcomes.decision_id';
  END IF;
END $$;

-- Step 3: Ensure all necessary columns exist
DO $$
BEGIN
  -- views column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'views') THEN
    ALTER TABLE outcomes ADD COLUMN views BIGINT;
    RAISE NOTICE '✅ Added column: outcomes.views';
  END IF;

  -- engagement_rate column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'engagement_rate') THEN
    ALTER TABLE outcomes ADD COLUMN engagement_rate NUMERIC(5,4);
    RAISE NOTICE '✅ Added column: outcomes.engagement_rate';
  END IF;

  -- profile_clicks column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'profile_clicks') THEN
    ALTER TABLE outcomes ADD COLUMN profile_clicks INT;
    RAISE NOTICE '✅ Added column: outcomes.profile_clicks';
  END IF;

  -- followers_gained column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'followers_gained') THEN
    ALTER TABLE outcomes ADD COLUMN followers_gained INT;
    RAISE NOTICE '✅ Added column: outcomes.followers_gained';
  END IF;

  -- followers_before column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'followers_before') THEN
    ALTER TABLE outcomes ADD COLUMN followers_before INT;
    RAISE NOTICE '✅ Added column: outcomes.followers_before';
  END IF;

  -- followers_after column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'followers_after') THEN
    ALTER TABLE outcomes ADD COLUMN followers_after INT;
    RAISE NOTICE '✅ Added column: outcomes.followers_after';
  END IF;

  -- collected_pass column (tracks how many times metrics were collected)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'collected_pass') THEN
    ALTER TABLE outcomes ADD COLUMN collected_pass INT DEFAULT 0;
    RAISE NOTICE '✅ Added column: outcomes.collected_pass';
  END IF;

  -- data_source column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outcomes' AND column_name = 'data_source') THEN
    ALTER TABLE outcomes ADD COLUMN data_source TEXT;
    RAISE NOTICE '✅ Added column: outcomes.data_source';
  END IF;
END $$;

-- Add helpful comment
COMMENT ON CONSTRAINT outcomes_decision_id_unique ON outcomes IS 
  'Allows UPSERT operations: ON CONFLICT (decision_id) DO UPDATE';


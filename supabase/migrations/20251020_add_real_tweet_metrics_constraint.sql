-- ✅ FIX #4: Add UNIQUE constraint to real_tweet_metrics table
-- This fixes: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Background:
-- - Code uses: .upsert({...}, { onConflict: 'tweet_id,collection_phase' })
-- - Database was missing this constraint
-- - Result: Every upsert failed
--
-- Solution:
-- - Add UNIQUE constraint on (tweet_id, collection_phase)
-- - Allows proper upsert behavior for metric updates over time
--
-- Created: 2025-10-20

-- Check if constraint already exists, only add if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'real_tweet_metrics_unique_tweet_phase'
  ) THEN
    -- Add the unique constraint
    ALTER TABLE real_tweet_metrics
    ADD CONSTRAINT real_tweet_metrics_unique_tweet_phase
    UNIQUE (tweet_id, collection_phase);
    
    RAISE NOTICE 'Added UNIQUE constraint on (tweet_id, collection_phase)';
  ELSE
    RAISE NOTICE 'Constraint already exists, skipping';
  END IF;
END $$;

-- Verify the constraint was added
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'real_tweet_metrics_unique_tweet_phase'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE '✅ Constraint verified: real_tweet_metrics_unique_tweet_phase exists';
  ELSE
    RAISE EXCEPTION '❌ Constraint verification failed';
  END IF;
END $$;


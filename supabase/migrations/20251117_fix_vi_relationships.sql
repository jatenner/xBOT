-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FIX VI DASHBOARD RELATIONSHIPS
-- Date: November 17, 2025
-- Purpose: Add missing foreign key relationships for dashboard queries
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 1: Add foreign key relationship between vi_content_classification and vi_collected_tweets
-- This enables Supabase dashboard to properly join these tables
-- ════════════════════════════════════════════════════════════════════════════

-- First, ensure the tweet_id column exists and has proper constraints
DO $$
BEGIN
  -- Add foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'vi_content_classification_tweet_id_fkey'
    AND table_name = 'vi_content_classification'
  ) THEN
    ALTER TABLE vi_content_classification
    ADD CONSTRAINT vi_content_classification_tweet_id_fkey
    FOREIGN KEY (tweet_id) 
    REFERENCES vi_collected_tweets(tweet_id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Added foreign key relationship: vi_content_classification.tweet_id -> vi_collected_tweets.tweet_id';
  ELSE
    RAISE NOTICE 'Foreign key relationship already exists';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 2: Add index for faster joins
-- ════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_vi_content_classification_tweet_id_fk 
ON vi_content_classification(tweet_id);

-- ════════════════════════════════════════════════════════════════════════════
-- FIX 3: Ensure vi_visual_formatting also has relationship
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'vi_visual_formatting_tweet_id_fkey'
    AND table_name = 'vi_visual_formatting'
  ) THEN
    ALTER TABLE vi_visual_formatting
    ADD CONSTRAINT vi_visual_formatting_tweet_id_fkey
    FOREIGN KEY (tweet_id) 
    REFERENCES vi_collected_tweets(tweet_id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Added foreign key relationship: vi_visual_formatting.tweet_id -> vi_collected_tweets.tweet_id';
  ELSE
    RAISE NOTICE 'Foreign key relationship already exists for vi_visual_formatting';
  END IF;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- Verify relationships exist:
-- SELECT 
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name IN ('vi_content_classification', 'vi_visual_formatting');


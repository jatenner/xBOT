-- 🚀 TWEETS TABLE FIX - CORRECTED VERSION
-- ========================================
-- This fixes the tweets table to accept string tweet IDs like "composer_reset_*"
-- Run this in your Supabase SQL Editor
-- Date: 2025-07-31

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. FIX TWEETS TABLE tweet_id TYPE (Handle string IDs)
-- ===================================================================
DO $$ 
BEGIN
    -- Change tweet_id to VARCHAR if it's currently integer
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='tweets' AND column_name='tweet_id') = 'integer' THEN
        -- First, backup any existing data
        CREATE TABLE IF NOT EXISTS tweets_backup AS SELECT * FROM tweets;
        
        -- Change the column type
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255) USING tweet_id::VARCHAR;
        
        -- Add comment for clarity
        COMMENT ON COLUMN tweets.tweet_id IS 'Tweet ID - can be numeric or string (e.g., composer_reset_*)';
        
        RAISE NOTICE 'Successfully changed tweets.tweet_id to VARCHAR(255)';
    ELSE
        RAISE NOTICE 'tweets.tweet_id is already VARCHAR type';
    END IF;
END $$;

-- ===================================================================
-- 2. TEST INSERT TO VERIFY FIX
-- ===================================================================
DO $$
DECLARE
    test_tweet_id TEXT := 'test_tweet_fix_' || EXTRACT(EPOCH FROM NOW());
    inserted_id BIGINT;
BEGIN
    RAISE NOTICE 'Testing tweets table with string ID...';
    
    INSERT INTO tweets (tweet_id, content, created_at) 
    VALUES (
        test_tweet_id,
        'Test tweet for string ID verification',
        NOW()
    ) RETURNING id INTO inserted_id;

    RAISE NOTICE 'Test insert successful for tweet_id: %', test_tweet_id;

    -- Clean up the test record
    DELETE FROM tweets WHERE id = inserted_id;
    RAISE NOTICE 'Cleaned up test record. Tweets table is ready!';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Test insert failed: %', SQLERRM;
END $$;

-- ===================================================================
-- 3. REFRESH SUPABASE SCHEMA CACHE
-- ===================================================================
NOTIFY pgrst, 'reload schema';

-- Success messages
DO $$ 
BEGIN
    RAISE NOTICE '🚀 TWEETS TABLE FIX COMPLETE!';
    RAISE NOTICE '✅ String tweet IDs are now supported.';
    RAISE NOTICE '✅ The bot can now store all tweet data properly.';
END $$;
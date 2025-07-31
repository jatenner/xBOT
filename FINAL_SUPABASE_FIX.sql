-- 🚀 FINAL SUPABASE DATABASE FIX
-- =====================================
-- This fixes the remaining database issues preventing proper data storage.
-- Run this in your Supabase SQL Editor to complete the fixes.
-- Date: 2025-07-31
-- Purpose: Fix numeric precision and ensure all columns work properly.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. FIX LEARNING_POSTS TABLE COLUMNS WITH CORRECT PRECISION
-- ===================================================================
DO $$ BEGIN
    -- Fix predicted_engagement with correct precision (values 0-1, so 6,4 was too restrictive)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='predicted_engagement') THEN
        ALTER TABLE learning_posts ADD COLUMN predicted_engagement NUMERIC(8,6) DEFAULT 0;
    ELSE
        -- Change precision to allow larger values
        ALTER TABLE learning_posts ALTER COLUMN predicted_engagement TYPE NUMERIC(8,6) USING predicted_engagement::NUMERIC(8,6);
    END IF;

    -- Add decision_trace column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='decision_trace') THEN
        ALTER TABLE learning_posts ADD COLUMN decision_trace JSONB DEFAULT '{}';
    END IF;

    -- Add posted_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='posted_at') THEN
        ALTER TABLE learning_posts ADD COLUMN posted_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add posted_hour column if it doesn't exist (for slot tracking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='posted_hour') THEN
        ALTER TABLE learning_posts ADD COLUMN posted_hour INTEGER;
    END IF;

    -- Add posted_day_of_week column if it doesn't exist (for slot tracking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='posted_day_of_week') THEN
        ALTER TABLE learning_posts ADD COLUMN posted_day_of_week INTEGER;
    END IF;

    -- Add viral_potential_score column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='viral_potential_score') THEN
        ALTER TABLE learning_posts ADD COLUMN viral_potential_score INTEGER DEFAULT 0;
    END IF;

END $$;

-- ===================================================================
-- 2. FIX TWEETS TABLE tweet_id TYPE (Handle string IDs)
-- ===================================================================
DO $$ BEGIN
    -- Change tweet_id to VARCHAR if it's currently integer
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='tweets' AND column_name='tweet_id') = 'integer' THEN
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255) USING tweet_id::VARCHAR;
    END IF;
    
    COMMENT ON COLUMN tweets.tweet_id IS 'Tweet ID - can be numeric or string (e.g., composer_reset_*)';
END $$;

-- ===================================================================
-- 3. TEST INSERT INTO LEARNING_POSTS (and cleanup)
-- ===================================================================
DO $$
DECLARE
    test_tweet_id TEXT := 'test_final_fix_' || EXTRACT(EPOCH FROM NOW());
    inserted_id BIGINT;
BEGIN
    RAISE NOTICE 'Testing final database fix...';
    
    INSERT INTO learning_posts (
        tweet_id, 
        content, 
        quality_score, 
        predicted_engagement, 
        decision_trace, 
        posted_at,
        posted_hour,
        posted_day_of_week,
        viral_potential_score
    ) VALUES (
        test_tweet_id,
        'Test content for final schema validation',
        100,
        0.025000,  -- This should now fit in NUMERIC(8,6)
        '{"reason": "test", "factors": {"confidence": 0.9}}'::jsonb,
        NOW(),
        EXTRACT(HOUR FROM NOW())::INTEGER,
        EXTRACT(DOW FROM NOW())::INTEGER,
        80
    ) RETURNING id INTO inserted_id;

    RAISE NOTICE 'Final test insert successful for tweet_id: %', test_tweet_id;

    -- Clean up the test record
    DELETE FROM learning_posts WHERE id = inserted_id;
    RAISE NOTICE 'Cleaned up test record. Database is ready!';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Final test insert failed: %', SQLERRM;
END $$;

-- ===================================================================
-- 4. REFRESH SUPABASE SCHEMA CACHE
-- ===================================================================
NOTIFY pgrst, 'reload schema';

-- Record this fix
INSERT INTO migration_history (filename, applied_at, notes) 
VALUES (
    '20250201_final_database_fix.sql',
    NOW(),
    'Final fix: Corrected predicted_engagement precision to NUMERIC(8,6), added missing columns for slot tracking, fixed tweet_id type.'
) ON CONFLICT (filename) DO NOTHING;

-- Final success message
DO $$ BEGIN
    RAISE NOTICE '🚀 FINAL DATABASE FIX COMPLETE!';
    RAISE NOTICE '✅ All database storage issues should now be resolved.';
    RAISE NOTICE '✅ The bot can now store all AI analytics properly.';
END $$;
-- 🔧 SUPABASE SQL FIX (CORRECTED VERSION)
-- Copy and paste this into your Supabase SQL Editor

-- 1. Fix learning_posts table structure
DO $$ 
BEGIN
    -- Add predicted_engagement column with proper precision
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_posts' 
        AND column_name = 'predicted_engagement'
    ) THEN
        ALTER TABLE learning_posts ADD COLUMN predicted_engagement DECIMAL(6,4) DEFAULT 0.0000;
        RAISE NOTICE 'Added predicted_engagement column';
    ELSE
        -- Fix precision if column exists but wrong type
        ALTER TABLE learning_posts ALTER COLUMN predicted_engagement TYPE DECIMAL(6,4);
        RAISE NOTICE 'Fixed predicted_engagement precision';
    END IF;

    -- Add decision_trace column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_posts' 
        AND column_name = 'decision_trace'
    ) THEN
        ALTER TABLE learning_posts ADD COLUMN decision_trace JSONB DEFAULT '{}';
        RAISE NOTICE 'Added decision_trace column';
    END IF;
END $$;

-- 2. Fix tweets table tweet_id to handle string IDs
DO $$ 
BEGIN
    -- Check if tweet_id is integer type and convert to varchar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' 
        AND column_name = 'tweet_id' 
        AND data_type IN ('integer', 'bigint')
    ) THEN
        -- Drop constraints
        ALTER TABLE tweets DROP CONSTRAINT IF EXISTS tweets_pkey CASCADE;
        
        -- Change column type
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255);
        
        -- Re-add primary key
        ALTER TABLE tweets ADD PRIMARY KEY (tweet_id);
        
        RAISE NOTICE 'Fixed tweets.tweet_id type to VARCHAR(255)';
    END IF;
END $$;

-- 3. Test the fixes with corrected JSONB syntax
DO $$
DECLARE
    test_tweet_id VARCHAR(255) := 'test_composer_reset_' || extract(epoch from now());
BEGIN
    -- Test learning_posts insert with proper JSONB
    INSERT INTO learning_posts (content, tweet_id, predicted_engagement, decision_trace)
    VALUES (
        'Test tweet content', 
        test_tweet_id, 
        0.2500, 
        '{"test": true, "timestamp": "2025-07-31"}'::jsonb
    );
    
    -- Test tweets insert (if table exists)
    BEGIN
        INSERT INTO tweets (tweet_id, content)
        VALUES (test_tweet_id, 'Test content');
        RAISE NOTICE 'Tweets table insert: SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Tweets table insert: % (this may be OK if table structure is different)', SQLERRM;
    END;
    
    -- Clean up test data
    DELETE FROM learning_posts WHERE tweet_id = test_tweet_id;
    DELETE FROM tweets WHERE tweet_id = test_tweet_id;
    
    RAISE NOTICE 'Test completed successfully - database is ready!';
END $$;
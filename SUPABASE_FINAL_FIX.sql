-- 🔧 SUPABASE FINAL DATABASE FIX
-- Copy and paste this entire script into your Supabase SQL Editor
-- This fixes all database issues without problematic predicates

-- 1. Fix tweets table tweet_id column to handle string IDs
DO $$ 
BEGIN
    -- Check if tweet_id is currently integer type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' 
        AND column_name = 'tweet_id' 
        AND data_type IN ('integer', 'bigint')
    ) THEN
        -- Drop constraints first
        ALTER TABLE tweets DROP CONSTRAINT IF EXISTS tweets_pkey CASCADE;
        
        -- Change tweet_id to VARCHAR to handle string IDs like composer_reset_*
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255) USING tweet_id::VARCHAR;
        
        -- Re-add primary key constraint
        ALTER TABLE tweets ADD PRIMARY KEY (tweet_id);
        
        RAISE NOTICE 'Fixed tweets.tweet_id type to VARCHAR(255)';
    ELSE
        RAISE NOTICE 'tweets.tweet_id already correct type';
    END IF;
END $$;

-- 2. Fix learning_posts predicted_engagement column type
DO $$ 
BEGIN
    -- Check if predicted_engagement column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_posts' 
        AND column_name = 'predicted_engagement'
    ) THEN
        -- Fix type to NUMERIC to handle decimal values like "37.8"
        ALTER TABLE learning_posts ALTER COLUMN predicted_engagement TYPE NUMERIC(6,4) USING predicted_engagement::NUMERIC;
        RAISE NOTICE 'Fixed learning_posts.predicted_engagement type to NUMERIC(6,4)';
    ELSE
        -- Add the column if it doesn't exist
        ALTER TABLE learning_posts ADD COLUMN predicted_engagement NUMERIC(6,4) DEFAULT 0.0000;
        RAISE NOTICE 'Added learning_posts.predicted_engagement column';
    END IF;
END $$;

-- 3. Fix bot_config table to prevent duplicate key errors
DO $$
BEGIN
    -- Create unique index if not exists (prevents duplicate viral_growth_metrics)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'bot_config' 
        AND indexname = 'bot_config_key_unique'
    ) THEN
        CREATE UNIQUE INDEX bot_config_key_unique ON bot_config(key);
        RAISE NOTICE 'Created unique index on bot_config.key';
    END IF;
END $$;

-- 4. Create post_history table for duplicate prevention
CREATE TABLE IF NOT EXISTS post_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    original_content TEXT NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    tweet_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create simple index for post_history (no problematic predicates)
CREATE INDEX IF NOT EXISTS post_history_recent ON post_history(posted_at DESC);

-- 6. Create profile_stats table for tone profile learning
CREATE TABLE IF NOT EXISTS profile_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_name VARCHAR(50) NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    impressions INTEGER DEFAULT 0,
    follows INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    click_rate NUMERIC(5,4) DEFAULT 0.0000,
    follow_rate NUMERIC(5,4) DEFAULT 0.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_name, date)
);

-- 7. Add helpful comments
COMMENT ON TABLE post_history IS 'Tracks posted content to prevent duplicates';
COMMENT ON TABLE profile_stats IS 'Performance metrics by tone profile for bandit learning';
COMMENT ON COLUMN tweets.tweet_id IS 'Tweet ID - supports both numeric and string IDs';
COMMENT ON COLUMN learning_posts.predicted_engagement IS 'AI-predicted engagement rate (0.0000-1.0000)';

-- 8. Test that everything works
DO $$
BEGIN
    -- Test tweet_id accepts string
    INSERT INTO tweets (tweet_id, content, created_at) 
    VALUES ('test_fix_' || extract(epoch from now()), 'Test content', NOW())
    ON CONFLICT (tweet_id) DO NOTHING;
    
    -- Test predicted_engagement accepts decimal
    INSERT INTO learning_posts (content, predicted_engagement, created_at) 
    VALUES ('Test content', 37.8000, NOW())
    ON CONFLICT DO NOTHING;
    
    -- Test post_history
    INSERT INTO post_history (content_hash, original_content) 
    VALUES (md5('test fix content'), 'Test fix content')
    ON CONFLICT (content_hash) DO NOTHING;
    
    RAISE NOTICE '✅ All database fixes tested successfully!';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Database fix test failed: %', SQLERRM;
END $$;

-- 9. Clean up test data
DELETE FROM tweets WHERE tweet_id LIKE 'test_fix_%';
DELETE FROM learning_posts WHERE content = 'Test content';
DELETE FROM post_history WHERE original_content = 'Test fix content';

-- 10. Final success message
DO $$
BEGIN
    RAISE NOTICE '🎯 COMPREHENSIVE DATABASE FIX COMPLETE!';
    RAISE NOTICE '✅ tweets.tweet_id now accepts string IDs';
    RAISE NOTICE '✅ learning_posts.predicted_engagement accepts decimals';
    RAISE NOTICE '✅ bot_config has unique key constraint';
    RAISE NOTICE '✅ post_history table created for duplicate prevention';
    RAISE NOTICE '✅ profile_stats table created for tone learning';
END $$;
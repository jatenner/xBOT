-- 🔧 WORKING TWEETS TABLE FIX FOR SUPABASE
-- Fix integer tweet_id column to accept string IDs like "composer_reset_*"

DO $$ 
BEGIN
    -- Check if tweet_id is currently integer type
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_name='tweets' AND column_name='tweet_id') = 'integer' THEN
        
        -- Create backup before modification (using simple timestamp)
        EXECUTE 'CREATE TABLE IF NOT EXISTS tweets_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MI') || ' AS SELECT * FROM tweets';
        
        -- Convert tweet_id from integer to VARCHAR
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255) USING tweet_id::VARCHAR;
        
        -- Update any constraints or indexes
        DROP INDEX IF EXISTS tweets_tweet_id_key;
        CREATE UNIQUE INDEX IF NOT EXISTS tweets_tweet_id_unique ON tweets(tweet_id);
        
        -- Add comment
        COMMENT ON COLUMN tweets.tweet_id IS 'Tweet ID - supports both numeric and string formats (e.g., composer_reset_*)';
        
        RAISE NOTICE 'SUCCESS: tweets.tweet_id converted from integer to VARCHAR(255)';
    ELSE
        RAISE NOTICE 'INFO: tweets.tweet_id is already VARCHAR - no changes needed';
    END IF;
END $$;

-- Verify the change
SELECT 
    column_name, 
    data_type, 
    character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'tweets' AND column_name = 'tweet_id';
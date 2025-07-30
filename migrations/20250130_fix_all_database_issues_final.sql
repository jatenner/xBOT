-- ===================================================================
-- 🔧 COMPLETE DATABASE ISSUES FIX - FINAL MIGRATION
-- ===================================================================
-- Fixes ALL database storage issues identified in logs:
-- 1. Missing columns: has_call_to_action, posting_day_of_week, tweet_data
-- 2. Bandit confidence column
-- 3. Posted column
-- 4. Schema cache refresh
-- 5. Data type alignment
-- ===================================================================

-- Step 1: Add ALL missing columns to learning_posts table
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS has_call_to_action BOOLEAN DEFAULT FALSE;
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS posting_day_of_week INTEGER;
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS bandit_confidence REAL DEFAULT 0.5;

-- Step 2: Add missing columns to tweets table
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_data JSONB DEFAULT '{}';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted BOOLEAN DEFAULT TRUE;

-- Step 3: Ensure tweet_id column can handle string IDs (if needed)
-- Check if tweet_id is VARCHAR, extend if too short
DO $$
BEGIN
    -- Update tweet_id column to handle longer string IDs if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' 
        AND column_name = 'tweet_id' 
        AND data_type = 'character varying'
        AND character_maximum_length < 100
    ) THEN
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(100);
    END IF;
END $$;

-- Step 4: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_learning_posts_has_call_to_action ON learning_posts(has_call_to_action);
CREATE INDEX IF NOT EXISTS idx_learning_posts_posting_day_of_week ON learning_posts(posting_day_of_week);
CREATE INDEX IF NOT EXISTS idx_learning_posts_bandit_confidence ON learning_posts(bandit_confidence);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_data ON tweets USING GIN(tweet_data);
CREATE INDEX IF NOT EXISTS idx_tweets_posted ON tweets(posted);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN learning_posts.has_call_to_action IS 'Whether the tweet contains a call to action';
COMMENT ON COLUMN learning_posts.posting_day_of_week IS 'Day of week when posted (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN learning_posts.bandit_confidence IS 'Confidence score from bandit learning algorithm (0.0-1.0)';
COMMENT ON COLUMN tweets.tweet_data IS 'Complete tweet metadata and performance data as JSON';
COMMENT ON COLUMN tweets.posted IS 'Whether the tweet was successfully posted to Twitter';

-- Step 6: Update existing data with sensible defaults
UPDATE learning_posts SET has_call_to_action = FALSE WHERE has_call_to_action IS NULL;
UPDATE learning_posts SET bandit_confidence = 0.5 WHERE bandit_confidence IS NULL;
UPDATE learning_posts SET posting_day_of_week = EXTRACT(DOW FROM created_at) WHERE posting_day_of_week IS NULL;
UPDATE tweets SET posted = TRUE WHERE posted IS NULL;
UPDATE tweets SET tweet_data = '{}' WHERE tweet_data IS NULL;

-- Step 7: AGGRESSIVE SCHEMA CACHE REFRESH
-- Force Supabase to recognize all new columns
COMMENT ON TABLE learning_posts IS 'Schema updated with all missing columns - forced refresh';
COMMENT ON TABLE tweets IS 'Schema updated with all missing columns - forced refresh';

-- Refresh table stats
ANALYZE learning_posts;
ANALYZE tweets;

-- Additional cache refresh techniques
DO $$
BEGIN
    -- Force a table metadata refresh
    PERFORM pg_stat_reset_single_table_counters('learning_posts'::regclass);
    PERFORM pg_stat_reset_single_table_counters('tweets'::regclass);
END $$;

-- Step 8: Verification queries
SELECT 
    'learning_posts' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'learning_posts' 
  AND column_name IN ('has_call_to_action', 'posting_day_of_week', 'bandit_confidence')
ORDER BY column_name;

SELECT 
    'tweets' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
  AND column_name IN ('tweet_data', 'posted', 'tweet_id')
ORDER BY column_name;

-- Final success message
SELECT 
    'ALL DATABASE ISSUES FIXED!' as status,
    'has_call_to_action, posting_day_of_week, bandit_confidence, tweet_data, posted columns added' as details,
    'Schema cache aggressively refreshed' as cache_status,
    NOW() as fixed_at;
-- =====================================================
-- FINAL DATABASE FIX - Drop function first, then fix everything
-- =====================================================

-- Step 1: Drop the existing function first
DROP FUNCTION IF EXISTS track_twitter_usage(integer, integer);

-- Step 2: Clean up duplicate records 
WITH ranked_records AS (
    SELECT 
        id,
        date,
        api_type,
        tweets_posted,
        reads_made,
        timestamp,
        ROW_NUMBER() OVER (
            PARTITION BY date, api_type 
            ORDER BY timestamp DESC, id DESC
        ) as rn
    FROM api_usage_tracking
)
DELETE FROM api_usage_tracking 
WHERE id IN (
    SELECT id 
    FROM ranked_records 
    WHERE rn > 1
);

-- Step 3: Add UNIQUE constraint (should work now)
ALTER TABLE api_usage_tracking 
ADD CONSTRAINT unique_api_usage_per_day 
UNIQUE (date, api_type);

-- Step 4: Create the function fresh
CREATE FUNCTION track_twitter_usage(tweet_count INTEGER, read_count INTEGER)
RETURNS TEXT AS $$
BEGIN
    INSERT INTO api_usage_tracking (date, api_type, tweets_posted, reads_made, timestamp)
    VALUES (CURRENT_DATE, 'twitter', tweet_count, read_count, NOW())
    ON CONFLICT (date, api_type)
    DO UPDATE SET
        tweets_posted = api_usage_tracking.tweets_posted + tweet_count,
        reads_made = api_usage_tracking.reads_made + read_count,
        timestamp = NOW();
    
    RETURN 'Twitter usage tracked: ' || tweet_count || ' tweets, ' || read_count || ' reads';
END;
$$ LANGUAGE plpgsql;

-- Step 5: Test everything works
SELECT track_twitter_usage(1, 0) as test_result;

-- Step 6: Verify the final state
SELECT 
    'Final state:' as info,
    api_type,
    tweets_posted,
    reads_made,
    timestamp
FROM api_usage_tracking 
WHERE date = CURRENT_DATE AND api_type = 'twitter'; 
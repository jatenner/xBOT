-- =====================================================
-- FIX: Remove duplicates then add constraint
-- =====================================================
-- Error: Key (date, api_type)=(2025-06-25, twitter) is duplicated
-- We need to clean up duplicates before adding UNIQUE constraint

-- Step 1: Check current duplicates
SELECT 'Current duplicates:' as info;
SELECT 
    date, 
    api_type, 
    COUNT(*) as duplicate_count,
    array_agg(id) as duplicate_ids
FROM api_usage_tracking 
GROUP BY date, api_type 
HAVING COUNT(*) > 1;

-- Step 2: Keep the most recent record for each (date, api_type) and delete older ones
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

-- Step 3: Verify duplicates are gone
SELECT 'After cleanup - should be no duplicates:' as info;
SELECT 
    date, 
    api_type, 
    COUNT(*) as count
FROM api_usage_tracking 
GROUP BY date, api_type 
HAVING COUNT(*) > 1;

-- Step 4: Now add the UNIQUE constraint
ALTER TABLE api_usage_tracking 
ADD CONSTRAINT unique_api_usage_per_day 
UNIQUE (date, api_type);

-- Step 5: Recreate the function with proper conflict handling
CREATE OR REPLACE FUNCTION track_twitter_usage(tweet_count INTEGER, read_count INTEGER)
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

-- Step 6: Test the function works now
SELECT 'Testing function:' as info;
SELECT track_twitter_usage(1, 0) as test_result;

-- Step 7: Verify final state
SELECT 'Final verification:' as info;
SELECT 
    api_type,
    tweets_posted,
    reads_made,
    timestamp
FROM api_usage_tracking 
WHERE date = CURRENT_DATE AND api_type = 'twitter'; 
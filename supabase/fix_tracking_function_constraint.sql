-- =====================================================
-- FIX: Tracking function constraint error
-- =====================================================
-- Error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Root cause: track_twitter_usage function expects UNIQUE constraint on (date, api_type)

-- First, check if the constraint exists
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'api_usage_tracking' AND constraint_type = 'UNIQUE';

-- Add the missing UNIQUE constraint
ALTER TABLE api_usage_tracking 
ADD CONSTRAINT unique_api_usage_per_day 
UNIQUE (date, api_type);

-- Now recreate the tracking function with proper conflict handling
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

-- Test the fixed function
SELECT track_twitter_usage(1, 0) as test_result;

-- Verify it worked
SELECT 
    api_type,
    tweets_posted,
    reads_made,
    timestamp
FROM api_usage_tracking 
WHERE date = CURRENT_DATE AND api_type = 'twitter'; 
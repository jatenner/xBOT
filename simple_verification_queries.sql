-- ========================================
-- SIMPLE VERIFICATION QUERIES
-- ========================================
-- Run these one by one in Supabase SQL Editor

-- 1. Check if api_usage_tracking table exists and has data
SELECT 'Step 1: Checking api_usage_tracking table' as test;
SELECT COUNT(*) as total_records FROM api_usage_tracking;

-- 2. Show all records in api_usage_tracking
SELECT 'Step 2: All api_usage_tracking records' as test;
SELECT * FROM api_usage_tracking ORDER BY date DESC, api_type;

-- 3. Check today's data specifically  
SELECT 'Step 3: Today''s data' as test;
SELECT 
    api_type,
    tweets_posted,
    reads_made,
    requests_made,
    cost_incurred,
    date
FROM api_usage_tracking 
WHERE date = CURRENT_DATE
ORDER BY api_type;

-- 4. Test the daily_api_stats view
SELECT 'Step 4: Testing daily_api_stats view' as test;
SELECT * FROM daily_api_stats 
WHERE date = CURRENT_DATE;

-- 5. Simulate what Real-Time Limits Intelligence Agent queries
SELECT 'Step 5: Simulating limits intelligence query' as test;
SELECT 
    SUM(tweets_posted) as total_tweets,
    SUM(reads_made) as total_reads
FROM api_usage_tracking 
WHERE date = CURRENT_DATE AND api_type = 'twitter';

-- 6. Check if legacy api_usage table still works
SELECT 'Step 6: Legacy api_usage table' as test;
SELECT * FROM api_usage 
ORDER BY date DESC 
LIMIT 5;

-- 7. Test tracking functions work
SELECT 'Step 7: Testing tracking function' as test;
SELECT track_twitter_usage(1, 0);

-- 8. Verify the tracking function worked
SELECT 'Step 8: Verify tracking function result' as test;
SELECT 
    api_type,
    tweets_posted,
    reads_made,
    timestamp
FROM api_usage_tracking 
WHERE date = CURRENT_DATE AND api_type = 'twitter'; 
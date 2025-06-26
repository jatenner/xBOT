-- Verify the backend fix worked
SELECT 'Checking api_usage_tracking table...' as step;
SELECT COUNT(*) as total_records FROM api_usage_tracking;

SELECT 'Checking today''s data...' as step;
SELECT api_type, tweets_posted, reads_made 
FROM api_usage_tracking 
WHERE date = CURRENT_DATE;

SELECT 'Checking daily_api_stats view...' as step;
SELECT * FROM daily_api_stats 
WHERE date = CURRENT_DATE;

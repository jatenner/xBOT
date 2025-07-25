-- 🚨 EMERGENCY DATABASE SYNC DIAGNOSTIC
-- ==========================================
-- Identify why live tweets aren't saving to database

-- 1. CHECK ALL RECENT DATABASE ACTIVITY
SELECT 'COMPLETE DATABASE ACTIVITY - LAST 4 HOURS:' as diagnostic_section;

-- Check tweets table with ALL columns
SELECT 
    id,
    tweet_id,
    content,
    created_at,
    posted_at,
    success,
    tweet_type,
    content_type,
    engagement_score,
    LENGTH(content) as char_count
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '4 hours'
ORDER BY created_at DESC;

-- 2. CHECK FOR ANY TWEETS WITH TWITTER-LIKE IDS
SELECT 'SEARCHING FOR REAL TWITTER IDS:' as diagnostic_section;

SELECT 
    tweet_id,
    content,
    created_at,
    success
FROM tweets 
WHERE tweet_id ~ '^[0-9]{15,20}$'  -- Real Twitter IDs are 15-20 digit numbers
OR tweet_id NOT LIKE '%test%'
OR tweet_id NOT LIKE '%system%'
ORDER BY created_at DESC;

-- 3. CHECK CONTENT UNIQUENESS TRACKING
SELECT 'CONTENT UNIQUENESS TRACKING:' as diagnostic_section;

SELECT 
    COUNT(*) as total_unique_content,
    MAX(first_used_at) as latest_content_tracked,
    COUNT(CASE WHEN first_used_at >= NOW() - INTERVAL '4 hours' THEN 1 END) as recent_content
FROM content_uniqueness;

-- Show recent content uniqueness entries
SELECT 
    LEFT(original_content, 100) || '...' as content_preview,
    usage_count,
    first_used_at,
    tweet_ids
FROM content_uniqueness 
WHERE first_used_at >= NOW() - INTERVAL '4 hours'
ORDER BY first_used_at DESC;

-- 4. CHECK TWITTER QUOTA TRACKING UPDATES
SELECT 'QUOTA TRACKING RECENT UPDATES:' as diagnostic_section;

SELECT 
    daily_tweets_used,
    daily_tweets_limit,
    daily_remaining,
    quota_reset_time,
    created_at,
    last_updated
FROM twitter_quota_tracking 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. CHECK SYSTEM LOGS FOR ERRORS
SELECT 'RECENT SYSTEM LOGS - ERRORS AND WARNINGS:' as diagnostic_section;

SELECT 
    component,
    level,
    message,
    data,
    created_at AT TIME ZONE 'EST' as timestamp_est
FROM system_logs 
WHERE level IN ('ERROR', 'WARN', 'error', 'warn')
  AND created_at >= NOW() - INTERVAL '4 hours'
ORDER BY created_at DESC 
LIMIT 10;

-- 6. CHECK ALL SYSTEM LOGS FOR TWEET-RELATED ACTIVITY
SELECT 'TWEET-RELATED SYSTEM LOGS:' as diagnostic_section;

SELECT 
    component,
    level,
    message,
    created_at AT TIME ZONE 'EST' as timestamp_est
FROM system_logs 
WHERE (message ILIKE '%tweet%' OR message ILIKE '%post%' OR message ILIKE '%save%')
  AND created_at >= NOW() - INTERVAL '4 hours'
ORDER BY created_at DESC 
LIMIT 15;

-- 7. CHECK FOR DATABASE PERMISSION ISSUES
SELECT 'DATABASE PERMISSIONS CHECK:' as diagnostic_section;

SELECT 
    'tweets' as table_name,
    COUNT(*) as total_records,
    MAX(created_at) as latest_record,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour
FROM tweets

UNION ALL

SELECT 
    'system_logs' as table_name,
    COUNT(*) as total_records,
    MAX(created_at) as latest_record,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour
FROM system_logs;

-- 8. SEARCH FOR HEALTH-RELATED CONTENT IN DATABASE
SELECT 'SEARCHING FOR HEALTH CONTENT IN DATABASE:' as diagnostic_section;

SELECT 
    tweet_id,
    LEFT(content, 80) || '...' as content_preview,
    created_at,
    success
FROM tweets 
WHERE content ILIKE '%health%' 
   OR content ILIKE '%study%'
   OR content ILIKE '%research%'
   OR content ILIKE '%stanford%'
   OR content ILIKE '%metabolic%'
   OR content ILIKE '%industry secret%'
ORDER BY created_at DESC;

-- 9. CHECK FOR FAILED TWEET SAVES
SELECT 'FAILED TWEET SAVES:' as diagnostic_section;

SELECT 
    tweet_id,
    content,
    created_at,
    success,
    tweet_type
FROM tweets 
WHERE success = FALSE
ORDER BY created_at DESC;

-- 10. FINAL SUMMARY
SELECT 'DIAGNOSTIC SUMMARY:' as final_section;

SELECT 
    'Total tweets in DB' as metric,
    COUNT(*)::text as value
FROM tweets

UNION ALL

SELECT 
    'Real tweets (non-test)' as metric,
    COUNT(*)::text as value
FROM tweets 
WHERE tweet_id NOT LIKE '%test%' AND tweet_id NOT LIKE '%system%'

UNION ALL

SELECT 
    'Tweets last 4 hours' as metric,
    COUNT(*)::text as value
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '4 hours'

UNION ALL

SELECT 
    'System logs last 4 hours' as metric,
    COUNT(*)::text as value
FROM system_logs 
WHERE created_at >= NOW() - INTERVAL '4 hours';

SELECT '🚨 EMERGENCY DIAGNOSTIC COMPLETE!' as status; 
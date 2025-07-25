-- 🚨 FIXED DATABASE SYNC DIAGNOSTIC
-- ====================================
-- Corrected for actual database schema

-- 1. CHECK ACTUAL TWEETS TABLE STRUCTURE
SELECT 'ACTUAL TWEETS TABLE COLUMNS:' as diagnostic_section;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'tweets' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. CHECK ALL RECENT DATABASE ACTIVITY (FIXED)
SELECT 'COMPLETE DATABASE ACTIVITY - LAST 4 HOURS:' as diagnostic_section;

-- Check tweets table with ACTUAL columns
SELECT 
    id,
    tweet_id,
    content,
    created_at,
    updated_at,  -- Using updated_at instead of posted_at
    success,
    tweet_type,
    COALESCE(content_type, 'unknown') as content_type,
    COALESCE(engagement_score, 0) as engagement_score,
    LENGTH(content) as char_count
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '4 hours'
ORDER BY created_at DESC;

-- 3. CHECK FOR ANY TWEETS WITH REAL TWITTER IDS
SELECT 'SEARCHING FOR REAL TWITTER IDS:' as diagnostic_section;

SELECT 
    tweet_id,
    LEFT(content, 100) || '...' as content_preview,
    created_at,
    success
FROM tweets 
WHERE tweet_id ~ '^[0-9]{15,20}$'  -- Real Twitter IDs are 15-20 digit numbers
   OR (tweet_id NOT LIKE '%test%' AND tweet_id NOT LIKE '%system%')
ORDER BY created_at DESC;

-- 4. CHECK ALL TWEETS FROM LAST 24 HOURS
SELECT 'ALL TWEETS LAST 24 HOURS:' as diagnostic_section;

SELECT 
    tweet_id,
    LEFT(content, 80) || '...' as content_preview,
    created_at AT TIME ZONE 'EST' as created_est,
    updated_at AT TIME ZONE 'EST' as updated_est,
    success,
    tweet_type
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 5. SEARCH FOR HEALTH CONTENT MATCHING TWITTER
SELECT 'SEARCHING FOR HEALTH CONTENT MATCHING TWITTER:' as diagnostic_section;

SELECT 
    tweet_id,
    LEFT(content, 100) as content_start,
    created_at,
    success
FROM tweets 
WHERE content ILIKE '%industry secret%' 
   OR content ILIKE '%stanford%'
   OR content ILIKE '%metabolic%'
   OR content ILIKE '%statins%'
   OR content ILIKE '%caloric restriction%'
   OR content ILIKE '%anxiety and depression%'
   OR content ILIKE '%14 hours%'
   OR content ILIKE '%protein + fat%'
ORDER BY created_at DESC;

-- 6. CHECK SYSTEM LOGS FOR SAVE ERRORS
SELECT 'RECENT SYSTEM LOGS - ERRORS:' as diagnostic_section;

SELECT 
    component,
    level,
    message,
    created_at AT TIME ZONE 'EST' as timestamp_est
FROM system_logs 
WHERE level IN ('ERROR', 'WARN', 'error', 'warn')
  AND created_at >= NOW() - INTERVAL '6 hours'
ORDER BY created_at DESC 
LIMIT 10;

-- 7. CHECK TWEET-RELATED LOGS
SELECT 'TWEET-RELATED LOGS:' as diagnostic_section;

SELECT 
    component,
    level,
    LEFT(message, 150) as message_preview,
    created_at AT TIME ZONE 'EST' as timestamp_est
FROM system_logs 
WHERE (message ILIKE '%tweet%' OR message ILIKE '%post%' OR message ILIKE '%save%' OR message ILIKE '%database%')
  AND created_at >= NOW() - INTERVAL '6 hours'
ORDER BY created_at DESC 
LIMIT 15;

-- 8. CHECK QUOTA TRACKING
SELECT 'QUOTA TRACKING STATUS:' as diagnostic_section;

SELECT 
    daily_tweets_used,
    daily_tweets_limit,
    daily_remaining,
    quota_reset_time,
    created_at AT TIME ZONE 'EST' as created_est
FROM twitter_quota_tracking 
ORDER BY created_at DESC 
LIMIT 3;

-- 9. CHECK CONTENT UNIQUENESS TRACKING
SELECT 'CONTENT UNIQUENESS TRACKING:' as diagnostic_section;

SELECT 
    COUNT(*) as total_unique_content,
    MAX(first_used_at) as latest_content_tracked,
    COUNT(CASE WHEN first_used_at >= NOW() - INTERVAL '6 hours' THEN 1 END) as recent_content
FROM content_uniqueness;

-- Show any recent content uniqueness entries
SELECT 
    LEFT(original_content, 80) || '...' as content_preview,
    usage_count,
    first_used_at AT TIME ZONE 'EST' as tracked_est
FROM content_uniqueness 
WHERE first_used_at >= NOW() - INTERVAL '24 hours'
ORDER BY first_used_at DESC
LIMIT 5;

-- 10. FINAL DIAGNOSTIC SUMMARY
SELECT 'DIAGNOSTIC SUMMARY:' as final_section;

SELECT 
    'Total tweets in database' as metric,
    COUNT(*)::text as value
FROM tweets

UNION ALL

SELECT 
    'Non-test tweets' as metric,
    COUNT(*)::text as value
FROM tweets 
WHERE tweet_id NOT LIKE '%test%' AND tweet_id NOT LIKE '%system%'

UNION ALL

SELECT 
    'Tweets last 6 hours' as metric,
    COUNT(*)::text as value
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '6 hours'

UNION ALL

SELECT 
    'Successful tweets' as metric,
    COUNT(*)::text as value
FROM tweets 
WHERE success = true

UNION ALL

SELECT 
    'Failed tweets' as metric,
    COUNT(*)::text as value
FROM tweets 
WHERE success = false;

SELECT '✅ FIXED DIAGNOSTIC COMPLETE!' as status; 
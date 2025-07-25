-- 🔍 CHECK LATEST TWEETS IN DATABASE
-- ====================================
-- Verify tweets are saving properly and review recent content

-- 1. Get the most recent 10 tweets with all details
SELECT 
    'LATEST TWEETS FROM DATABASE:' as section,
    COUNT(*) as total_tweets_in_database
FROM tweets;

-- 2. Show detailed view of latest tweets
SELECT 
    tweet_id,
    content,
    created_at,
    engagement_score,
    tweet_type,
    success,
    posted_at,
    LENGTH(content) as char_count
FROM tweets 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check today's tweets specifically (EST timezone)
SELECT 
    'TODAYS TWEETS (EST):' as section,
    COUNT(*) as tweets_today
FROM tweets 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day';

-- 4. Show today's tweets with content preview
SELECT 
    to_char(created_at AT TIME ZONE 'EST', 'HH12:MI AM') as time_est,
    LEFT(content, 100) || '...' as content_preview,
    tweet_type,
    success,
    engagement_score
FROM tweets 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY created_at DESC;

-- 5. Check content uniqueness tracking
SELECT 
    'CONTENT UNIQUENESS TRACKING:' as section,
    COUNT(*) as unique_content_hashes
FROM content_uniqueness;

-- 6. Show recent content uniqueness entries
SELECT 
    LEFT(original_content, 80) || '...' as content_preview,
    usage_count,
    first_used_at
FROM content_uniqueness 
ORDER BY first_used_at DESC 
LIMIT 5;

-- 7. Check tweet storage by hour for today
SELECT 
    EXTRACT(hour FROM created_at AT TIME ZONE 'EST') as hour_est,
    COUNT(*) as tweets_count,
    STRING_AGG(LEFT(content, 50), '; ') as content_samples
FROM tweets 
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY EXTRACT(hour FROM created_at AT TIME ZONE 'EST')
ORDER BY hour_est DESC;

-- 8. Verify database integrity
SELECT 
    'DATABASE INTEGRITY CHECK:' as section,
    (SELECT COUNT(*) FROM tweets WHERE content IS NOT NULL) as tweets_with_content,
    (SELECT COUNT(*) FROM tweets WHERE tweet_id IS NOT NULL) as tweets_with_id,
    (SELECT COUNT(*) FROM tweets WHERE created_at IS NOT NULL) as tweets_with_timestamp;

-- 9. Check for any errors or issues
SELECT 
    'POTENTIAL ISSUES:' as section,
    (SELECT COUNT(*) FROM tweets WHERE content = '') as empty_content_tweets,
    (SELECT COUNT(*) FROM tweets WHERE success = false) as failed_tweets,
    (SELECT COUNT(*) FROM tweets WHERE LENGTH(content) > 280) as overlong_tweets;

-- 10. Show system performance summary
SELECT 
    'SYSTEM PERFORMANCE SUMMARY:' as final_section,
    COUNT(*) as total_tweets,
    COUNT(CASE WHEN success = true THEN 1 END) as successful_tweets,
    ROUND(
        (COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*)), 2
    ) as success_rate_percent,
    MAX(created_at) as last_tweet_timestamp,
    MIN(created_at) as first_tweet_timestamp
FROM tweets;

SELECT '✅ LATEST TWEETS CHECK COMPLETE!' as status; 
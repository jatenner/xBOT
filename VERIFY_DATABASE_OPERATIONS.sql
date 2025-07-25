-- 🔍 COMPREHENSIVE DATABASE VERIFICATION
-- ======================================
-- Check all tables and recent activity to ensure system is working

-- 1. TABLE EXISTENCE CHECK
SELECT 'DATABASE TABLES STATUS:' as section;

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_name IN (
        'tweets', 'bot_config', 'twitter_quota_tracking', 
        'engagement_history', 'content_uniqueness', 'daily_budget_status',
        'expert_learning_data', 'budget_transactions', 'system_logs'
    )
ORDER BY table_name;

-- 2. RECENT ACTIVITY ACROSS ALL TABLES
SELECT 'RECENT ACTIVITY SUMMARY:' as section;

-- Check tweets table
SELECT 
    'tweets' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_1h,
    MAX(created_at) as latest_record
FROM tweets

UNION ALL

-- Check twitter_quota_tracking
SELECT 
    'twitter_quota_tracking' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_1h,
    MAX(created_at) as latest_record
FROM twitter_quota_tracking

UNION ALL

-- Check engagement_history
SELECT 
    'engagement_history' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_1h,
    MAX(created_at) as latest_record
FROM engagement_history

UNION ALL

-- Check system_logs
SELECT 
    'system_logs' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as last_1h,
    MAX(created_at) as latest_record
FROM system_logs

ORDER BY table_name;

-- 3. LATEST TWEET CONTENT ANALYSIS
SELECT 'LATEST TWEET CONTENT:' as section;

SELECT 
    tweet_id,
    content,
    created_at AT TIME ZONE 'EST' as created_at_est,
    success,
    tweet_type,
    engagement_score
FROM tweets 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. BOT CONFIGURATION STATUS
SELECT 'BOT CONFIGURATION:' as section;

SELECT 
    config_key,
    config_value,
    updated_at
FROM bot_config 
ORDER BY updated_at DESC;

-- 5. QUOTA TRACKING STATUS
SELECT 'QUOTA TRACKING STATUS:' as section;

SELECT 
    daily_tweets_used,
    daily_tweets_limit,
    quota_reset_time,
    created_at AT TIME ZONE 'EST' as updated_est
FROM twitter_quota_tracking 
ORDER BY created_at DESC 
LIMIT 3;

-- 6. CONTENT UNIQUENESS VERIFICATION
SELECT 'CONTENT UNIQUENESS STATUS:' as section;

SELECT 
    COUNT(*) as total_unique_hashes,
    COUNT(CASE WHEN usage_count > 1 THEN 1 END) as repeated_content,
    MAX(first_used_at) as latest_content_tracked
FROM content_uniqueness;

-- 7. RECENT SYSTEM LOGS
SELECT 'RECENT SYSTEM LOGS:' as section;

SELECT 
    component,
    level,
    message,
    created_at AT TIME ZONE 'EST' as timestamp_est
FROM system_logs 
ORDER BY created_at DESC 
LIMIT 8;

-- 8. DATABASE HEALTH CHECK
SELECT 'DATABASE HEALTH STATUS:' as section;

SELECT 
    'Database Status' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM tweets) > 0 THEN 'HEALTHY - Tweets saving'
        ELSE 'WARNING - No tweets found'
    END as status,
    NOW() AT TIME ZONE 'EST' as check_time;

SELECT '✅ DATABASE VERIFICATION COMPLETE!' as final_status; 
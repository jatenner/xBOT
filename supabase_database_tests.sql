-- ============================================================================
-- 🔍 SUPABASE DATABASE COMPREHENSIVE TEST SUITE
-- ============================================================================
-- Run these queries directly in Supabase SQL Editor to test functionality
-- Copy and paste each section individually for best results

-- ============================================================================
-- 📊 QUERY #1: System Status Check
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
'Twitter Master System Health' as dashboard,
(SELECT config_value as status FROM twitter_master_config WHERE config_key = 'system_enabled') as system_enabled,
(SELECT COUNT(*) FROM system_health_status WHERE status = 'optimal') as optimal_components,
(SELECT COUNT(*) FROM system_health_status) as total_components,
(SELECT COUNT(*) FROM twitter_master_decisions WHERE created_at >= CURRENT_DATE) as decisions_today,
(SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE) as tweets_today,
(SELECT COUNT(*) FROM twitter_master_config) as total_configs;

-- ============================================================================
-- 📊 QUERY #2: System Health Overview  
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    component_name,
    status,
    readiness_score,
    last_check
FROM system_health_status 
ORDER BY readiness_score DESC;

-- ============================================================================
-- 📊 QUERY #3: Recent Tweet Data (Last 24 Hours)
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    tweet_id,
    content,
    tweet_type,
    engagement_score,
    created_at
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================================================
-- 📊 QUERY #4: AI Decisions Analysis (Last 24 Hours)
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    decision_type,
    confidence_score,
    reasoning,
    created_at
FROM twitter_master_decisions 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================================================
-- 📊 QUERY #5: API Usage Tracking Today
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    api_type,
    count,
    date,
    last_updated
FROM api_usage_tracking 
WHERE date = CURRENT_DATE
ORDER BY api_type;

-- ============================================================================
-- 📊 QUERY #6: Bot Activity Tracking Today
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    hour,
    action,
    count,
    date
FROM bot_usage_tracking 
WHERE date = CURRENT_DATE
ORDER BY hour DESC;

-- ============================================================================
-- 📊 QUERY #7: Daily Dashboard Summary
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
'Twitter Master System Dashboard' as title,
(SELECT COUNT(*) FROM tweets WHERE DATE(created_at) = CURRENT_DATE) as tweets_today,
(SELECT COUNT(*) FROM twitter_master_decisions WHERE DATE(created_at) = CURRENT_DATE AND decision_type = 'post_content') as ai_decisions,
(SELECT SUM(count) FROM api_usage_tracking WHERE date = CURRENT_DATE AND api_type = 'twitter') as twitter_api_calls,
(SELECT COUNT(*) FROM system_health_status WHERE status = 'optimal') as healthy_components,
NOW() as report_time;

-- ============================================================================
-- 📊 QUERY #8: Data Integrity Checks
-- ============================================================================
-- Copy this entire query and run in Supabase:

-- Check for duplicate tweet IDs
SELECT 
    'Duplicate Tweet IDs' as test_name,
    COUNT(*) as duplicate_count
FROM (
    SELECT tweet_id, COUNT(*) 
    FROM tweets 
    GROUP BY tweet_id 
    HAVING COUNT(*) > 1
) duplicates

UNION ALL

-- Check for empty content
SELECT 
    'Empty Tweet Content' as test_name,
    COUNT(*) as empty_count
FROM tweets 
WHERE content IS NULL OR content = ''

UNION ALL

-- Check for future timestamps
SELECT 
    'Future Timestamps' as test_name,
    COUNT(*) as future_count
FROM tweets 
WHERE created_at > NOW()

UNION ALL

-- Check for missing tweet IDs
SELECT 
    'Missing Tweet IDs' as test_name,
    COUNT(*) as missing_count
FROM tweets 
WHERE tweet_id IS NULL;

-- ============================================================================
-- 📊 QUERY #9: Performance Analysis
-- ============================================================================
-- Copy this entire query and run in Supabase:

-- Tweet frequency analysis
SELECT 
    DATE(created_at) as date,
    COUNT(*) as tweet_count,
    AVG(engagement_score) as avg_engagement,
    MIN(created_at) as first_tweet,
    MAX(created_at) as last_tweet
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- 📊 QUERY #10: AI Decision vs Tweet Correlation
-- ============================================================================
-- Copy this entire query and run in Supabase:

WITH decision_counts AS (
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as decisions
    FROM twitter_master_decisions 
    WHERE decision_type = 'post_content'
    AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
),
tweet_counts AS (
    SELECT 
        DATE(created_at) as date,
        COUNT(*) as tweets
    FROM tweets 
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
)
SELECT 
    COALESCE(d.date, t.date) as date,
    COALESCE(d.decisions, 0) as ai_decisions,
    COALESCE(t.tweets, 0) as actual_tweets,
    COALESCE(t.tweets, 0) - COALESCE(d.decisions, 0) as gap
FROM decision_counts d
FULL OUTER JOIN tweet_counts t ON d.date = t.date
ORDER BY date DESC;

-- ============================================================================
-- 📊 QUERY #11: Latest Activity Check
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    'Latest Tweet' as activity_type,
    content as description,
    created_at as timestamp
FROM tweets 
ORDER BY created_at DESC 
LIMIT 1

UNION ALL

SELECT 
    'Latest AI Decision' as activity_type,
    CONCAT(decision_type, ': ', reasoning) as description,
    created_at as timestamp
FROM twitter_master_decisions 
ORDER BY created_at DESC 
LIMIT 1

UNION ALL

SELECT 
    'Latest API Call' as activity_type,
    CONCAT(api_type, ': ', count, ' calls') as description,
    last_updated as timestamp
FROM api_usage_tracking 
ORDER BY last_updated DESC 
LIMIT 1;

-- ============================================================================
-- 📊 QUERY #12: Real-Time Sync Test
-- ============================================================================
-- Copy this entire query and run in Supabase:

-- Check if data is being inserted in real-time (last 10 minutes)
SELECT 
    'Recent Tweets (10 min)' as test_type,
    COUNT(*) as count,
    MAX(created_at) as latest_time
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '10 minutes'

UNION ALL

SELECT 
    'Recent Decisions (10 min)' as test_type,
    COUNT(*) as count,
    MAX(created_at) as latest_time
FROM twitter_master_decisions 
WHERE created_at >= NOW() - INTERVAL '10 minutes'

UNION ALL

SELECT 
    'Recent API Calls (10 min)' as test_type,
    COALESCE(SUM(count), 0) as count,
    MAX(last_updated) as latest_time
FROM api_usage_tracking 
WHERE last_updated >= NOW() - INTERVAL '10 minutes';

-- ============================================================================
-- 📊 QUERY #13: Content Quality Analysis
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    LENGTH(content) as content_length,
    engagement_score,
    tweet_type,
    created_at
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY engagement_score DESC;

-- ============================================================================
-- 📊 QUERY #14: System Configuration Check
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    config_key,
    config_value as status,
    updated_at
FROM twitter_master_config 
WHERE config_key = 'system_enabled';

-- ============================================================================
-- 📊 QUERY #15: Database Schema Verification
-- ============================================================================
-- Copy this entire query and run in Supabase:

SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('tweets', 'twitter_master_decisions', 'api_usage_tracking', 'bot_usage_tracking', 'system_health_status')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 🎯 COMPREHENSIVE STATUS REPORT
-- ============================================================================
-- Run this final query for a complete system overview:

WITH system_stats AS (
    SELECT 
        (SELECT COUNT(*) FROM tweets WHERE DATE(created_at) = CURRENT_DATE) as tweets_today,
        (SELECT COUNT(*) FROM twitter_master_decisions WHERE DATE(created_at) = CURRENT_DATE) as decisions_today,
        (SELECT COUNT(*) FROM system_health_status WHERE status = 'optimal') as optimal_components,
        (SELECT COUNT(*) FROM system_health_status) as total_components,
        (SELECT config_value FROM twitter_master_config WHERE config_key = 'system_enabled') as system_enabled,
        (SELECT MAX(created_at) FROM tweets) as latest_tweet_time,
        (SELECT COUNT(*) FROM tweets WHERE created_at >= NOW() - INTERVAL '1 hour') as tweets_last_hour
)
SELECT 
    '🎯 TWITTER MASTER SYSTEM STATUS REPORT' as report_title,
    CURRENT_TIMESTAMP as report_time,
    tweets_today as "📝 Tweets Today",
    decisions_today as "🧠 AI Decisions Today", 
    optimal_components || '/' || total_components as "🏥 System Health",
    system_enabled as "🔗 System Status",
    latest_tweet_time as "⏰ Latest Tweet",
    tweets_last_hour as "📊 Tweets Last Hour",
    CASE 
        WHEN tweets_last_hour > 0 THEN '🟢 ACTIVE'
        WHEN tweets_today > 0 THEN '🟡 SLOW'
        ELSE '🔴 INACTIVE'
    END as "📊 Bot Status"
FROM system_stats;

-- ============================================================================
-- 🔧 QUICK DIAGNOSTIC COMMANDS
-- ============================================================================

-- To test if bot is currently active (run this to see if new data appears):
-- SELECT COUNT(*) FROM tweets WHERE created_at >= NOW() - INTERVAL '5 minutes';

-- To check system health:
-- SELECT * FROM system_health_status WHERE status != 'optimal';

-- To verify API usage tracking:
-- SELECT * FROM api_usage_tracking WHERE date = CURRENT_DATE;

-- To see latest AI decisions:
-- SELECT * FROM twitter_master_decisions ORDER BY created_at DESC LIMIT 5;

-- ============================================================================
-- ✅ TESTING INSTRUCTIONS:
-- ============================================================================
-- 1. Copy each query section individually
-- 2. Paste into Supabase SQL Editor  
-- 3. Click "Run" to execute
-- 4. Review results for any issues
-- 5. The final comprehensive report gives overall status
-- 
-- 🚨 If any query returns errors or unexpected results, 
-- that indicates a database issue that needs attention!
-- ============================================================================ 
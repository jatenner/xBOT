-- 🔍 SIMPLE DIAGNOSTIC - NO CHANGES, JUST LOOK
-- =============================================
-- Let's see exactly what we have before doing anything

SELECT '=== EXISTING TABLES ===' as info;

SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT '=== BOT_CONFIG STRUCTURE ===' as info;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'bot_config'
ORDER BY ordinal_position;

SELECT '=== BOT_CONFIG DATA ===' as info;

SELECT * FROM bot_config LIMIT 10;

SELECT '=== TWEETS STRUCTURE ===' as info;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'tweets'
ORDER BY ordinal_position;

SELECT '=== TWEETS COUNT ===' as info;

SELECT COUNT(*) as tweet_count FROM tweets;

SELECT '=== ALL TABLE COUNTS ===' as info;

SELECT 
    'bot_config' as table_name,
    COUNT(*) as record_count
FROM bot_config
UNION ALL
SELECT 
    'tweets' as table_name,
    COUNT(*) as record_count
FROM tweets
UNION ALL
SELECT 
    'twitter_quota_tracking' as table_name,
    COUNT(*) as record_count
FROM twitter_quota_tracking
UNION ALL
SELECT 
    'api_usage' as table_name,
    COUNT(*) as record_count
FROM api_usage
UNION ALL
SELECT 
    'system_logs' as table_name,
    COUNT(*) as record_count
FROM system_logs; 
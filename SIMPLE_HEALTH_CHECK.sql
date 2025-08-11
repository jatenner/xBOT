-- CORRECTED HEALTH CHECK: Only check existing tables

-- First, see what tables actually exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
  AND table_schema = 'public'
ORDER BY table_name;

-- Then count rows in each existing table
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_config' AND table_schema = 'public') 
        THEN (SELECT 'bot_config: ' || count(*) || ' rows' FROM bot_config)
        ELSE 'bot_config: not created'
    END as bot_config_status
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tweets' AND table_schema = 'public') 
        THEN (SELECT 'tweets: ' || count(*) || ' rows' FROM tweets)
        ELSE 'tweets: not created'
    END
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_health' AND table_schema = 'public') 
        THEN (SELECT 'system_health: ' || count(*) || ' rows' FROM system_health)
        ELSE 'system_health: not created'
    END
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_summaries' AND table_schema = 'public') 
        THEN (SELECT 'daily_summaries: ' || count(*) || ' rows' FROM daily_summaries)
        ELSE 'daily_summaries: not created'
    END
UNION ALL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log' AND table_schema = 'public') 
        THEN (SELECT 'audit_log: ' || count(*) || ' rows' FROM audit_log)
        ELSE 'audit_log: not created'
    END;

-- Check the seeded config (this should show 4 rows)
SELECT config_key, environment, 
       CASE 
         WHEN config_key = 'schema_version' THEN config_value::text
         ELSE config_value->>'enabled' 
       END as value
FROM bot_config 
WHERE config_key IN ('schema_version', 'redis_config', 'rate_limits', 'feature_flags')
ORDER BY config_key;
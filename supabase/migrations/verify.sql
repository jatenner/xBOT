-- VERIFICATION SCRIPT: Post-migration validation
-- Validates schema state and seeded configuration

-- Check 1: Verify all 5 core tables exist
SELECT 
    'TABLE_CHECK' as check_type,
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
  AND table_schema = 'public'
ORDER BY table_name;

-- Check 2: Verify bot_config structure and constraint
SELECT 
    'CONSTRAINT_CHECK' as check_type,
    conname as constraint_name,
    'EXISTS' as status
FROM pg_constraint 
WHERE conrelid = 'bot_config'::regclass 
  AND conname = 'bot_config_env_key_unique';

-- Check 3: Verify essential columns exist
WITH expected_columns AS (
    SELECT 'tweets' as table_name, unnest(ARRAY['id', 'tweet_id', 'content', 'posted_at', 'platform', 'metadata', 'analytics']) as column_name
    UNION ALL
    SELECT 'bot_config', unnest(ARRAY['id', 'environment', 'config_key', 'config_value', 'metadata', 'updated_at'])
    UNION ALL  
    SELECT 'daily_summaries', unnest(ARRAY['day', 'summary_type', 'environment', 'metrics', 'metadata'])
    UNION ALL
    SELECT 'audit_log', unnest(ARRAY['id', 'ts', 'event_type', 'component', 'event_data', 'context'])
    UNION ALL
    SELECT 'system_health', unnest(ARRAY['id', 'ts', 'component', 'status', 'metrics', 'details'])
),
actual_columns AS (
    SELECT table_name, column_name
    FROM information_schema.columns 
    WHERE table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
      AND table_schema = 'public'
)
SELECT 
    'COLUMN_CHECK' as check_type,
    e.table_name,
    e.column_name,
    CASE WHEN a.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM expected_columns e
LEFT JOIN actual_columns a ON e.table_name = a.table_name AND e.column_name = a.column_name
ORDER BY e.table_name, e.column_name;

-- Check 4: Verify seeded configuration
SELECT 
    'CONFIG_CHECK' as check_type,
    environment,
    config_key,
    CASE 
        WHEN config_key = 'schema_version' THEN config_value::TEXT
        WHEN config_key IN ('redis_config', 'rate_limits', 'feature_flags') THEN 'SEEDED'
        ELSE 'UNKNOWN'
    END as status
FROM bot_config 
WHERE config_key IN ('schema_version', 'redis_config', 'rate_limits', 'feature_flags')
ORDER BY environment, config_key;

-- Check 5: Count rows in each table
SELECT 
    'ROW_COUNT' as check_type,
    'tweets' as table_name,
    count(*) as row_count
FROM tweets
UNION ALL
SELECT 'ROW_COUNT', 'bot_config', count(*) FROM bot_config
UNION ALL
SELECT 'ROW_COUNT', 'daily_summaries', count(*) FROM daily_summaries
UNION ALL
SELECT 'ROW_COUNT', 'audit_log', count(*) FROM audit_log
UNION ALL
SELECT 'ROW_COUNT', 'system_health', count(*) FROM system_health
ORDER BY table_name;

-- Check 6: Verify indexes exist
SELECT 
    'INDEX_CHECK' as check_type,
    indexname as index_name,
    tablename as table_name,
    'EXISTS' as status
FROM pg_indexes 
WHERE tablename IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
  AND schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
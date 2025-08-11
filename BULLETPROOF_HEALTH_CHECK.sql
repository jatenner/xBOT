-- BULLETPROOF HEALTH CHECK: Works regardless of which tables exist

-- Step 1: See exactly what tables we have
SELECT 'TABLE EXISTS: ' || table_name as status
FROM information_schema.tables 
WHERE table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
  AND table_schema = 'public'
ORDER BY table_name;

-- Step 2: Check bot_config (this should always exist after BASELINE)
SELECT 'bot_config rows: ' || count(*) as status FROM bot_config;

-- Step 3: Show the seeded configuration
SELECT 'CONFIG: ' || config_key || ' = ' || 
       CASE 
         WHEN config_key = 'schema_version' THEN config_value::text
         ELSE config_value->>'enabled' 
       END as configuration
FROM bot_config 
WHERE config_key IN ('schema_version', 'redis_config', 'rate_limits', 'feature_flags')
ORDER BY config_key;

-- Step 4: Check constraint exists
SELECT 'CONSTRAINT: ' || conname as constraint_status
FROM pg_constraint 
WHERE conrelid = 'bot_config'::regclass 
  AND conname = 'bot_config_env_key_unique';
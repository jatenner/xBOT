-- DEAD SIMPLE CHECK: No JSONB operators, just basic queries

-- Step 1: List existing tables
SELECT table_name
FROM information_schema.tables 
WHERE table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
  AND table_schema = 'public'
ORDER BY table_name;

-- Step 2: Count bot_config rows
SELECT count(*) as bot_config_rows FROM bot_config;

-- Step 3: Show raw config data (no JSONB operators)
SELECT config_key, config_value
FROM bot_config 
WHERE config_key IN ('schema_version', 'redis_config', 'rate_limits', 'feature_flags')
ORDER BY config_key;

-- Step 4: Check constraint
SELECT conname
FROM pg_constraint 
WHERE conrelid = 'bot_config'::regclass;
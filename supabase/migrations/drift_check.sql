-- DRIFT CHECK: Detect schema differences from expected baseline
-- Reports missing/extra columns and tables

-- Check 1: Table-level drift (missing or extra tables)
WITH expected_tables AS (
    SELECT unnest(ARRAY['tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health']) as table_name
),
actual_tables AS (
    SELECT table_name
    FROM information_schema.tables 
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
)
SELECT 
    'TABLE_DRIFT' as drift_type,
    COALESCE(e.table_name, a.table_name) as table_name,
    CASE 
        WHEN e.table_name IS NULL THEN 'EXTRA_TABLE'
        WHEN a.table_name IS NULL THEN 'MISSING_TABLE'
        ELSE 'OK'
    END as drift_status
FROM expected_tables e 
FULL OUTER JOIN actual_tables a ON e.table_name = a.table_name
WHERE e.table_name IS NULL OR a.table_name IS NULL
ORDER BY table_name;

-- Check 2: Column-level drift for core tables
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
    'COLUMN_DRIFT' as drift_type,
    COALESCE(e.table_name, a.table_name) as table_name,
    COALESCE(e.column_name, a.column_name) as column_name,
    CASE 
        WHEN e.column_name IS NULL THEN 'EXTRA_COLUMN'
        WHEN a.column_name IS NULL THEN 'MISSING_COLUMN'
        ELSE 'OK'
    END as drift_status
FROM expected_columns e 
FULL OUTER JOIN actual_columns a ON e.table_name = a.table_name AND e.column_name = a.column_name
WHERE e.column_name IS NULL OR a.column_name IS NULL
ORDER BY table_name, column_name;

-- Check 3: Constraint drift
WITH expected_constraints AS (
    SELECT 'bot_config' as table_name, 'bot_config_env_key_unique' as constraint_name, 'UNIQUE' as constraint_type
),
actual_constraints AS (
    SELECT 
        t.relname as table_name,
        c.conname as constraint_name,
        CASE c.contype 
            WHEN 'u' THEN 'UNIQUE'
            WHEN 'p' THEN 'PRIMARY KEY'
            WHEN 'f' THEN 'FOREIGN KEY'
            WHEN 'c' THEN 'CHECK'
            ELSE 'OTHER'
        END as constraint_type
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health')
      AND c.conname NOT LIKE '%_pkey'  -- Exclude auto-generated primary keys
)
SELECT 
    'CONSTRAINT_DRIFT' as drift_type,
    COALESCE(e.table_name, a.table_name) as table_name,
    COALESCE(e.constraint_name, a.constraint_name) as constraint_name,
    CASE 
        WHEN e.constraint_name IS NULL THEN 'EXTRA_CONSTRAINT'
        WHEN a.constraint_name IS NULL THEN 'MISSING_CONSTRAINT'
        ELSE 'OK'
    END as drift_status
FROM expected_constraints e 
FULL OUTER JOIN actual_constraints a ON e.table_name = a.table_name AND e.constraint_name = a.constraint_name
WHERE e.constraint_name IS NULL OR a.constraint_name IS NULL
ORDER BY table_name, constraint_name;

-- Check 4: Configuration drift (missing essential config keys)
WITH expected_config AS (
    SELECT 'production' as environment, unnest(ARRAY['schema_version', 'redis_config', 'rate_limits', 'feature_flags']) as config_key
    UNION ALL
    SELECT 'staging', unnest(ARRAY['schema_version', 'redis_config', 'rate_limits', 'feature_flags'])
),
actual_config AS (
    SELECT environment, config_key
    FROM bot_config
    WHERE environment IN ('production', 'staging')
)
SELECT 
    'CONFIG_DRIFT' as drift_type,
    COALESCE(e.environment, a.environment) as environment,
    COALESCE(e.config_key, a.config_key) as config_key,
    CASE 
        WHEN e.config_key IS NULL THEN 'EXTRA_CONFIG'
        WHEN a.config_key IS NULL THEN 'MISSING_CONFIG'
        ELSE 'OK'
    END as drift_status
FROM expected_config e 
FULL OUTER JOIN actual_config a ON e.environment = a.environment AND e.config_key = a.config_key
WHERE e.config_key IS NULL OR a.config_key IS NULL
ORDER BY environment, config_key;

-- Summary: Overall drift status
SELECT 
    'DRIFT_SUMMARY' as summary_type,
    COUNT(*) as total_issues,
    'Check above for details' as recommendation
FROM (
    -- Count all drift issues from above queries
    WITH expected_tables AS (
        SELECT unnest(ARRAY['tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health']) as table_name
    ),
    actual_tables AS (
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ),
    expected_columns AS (
        SELECT 'tweets' as table_name, unnest(ARRAY['id', 'tweet_id', 'content', 'posted_at', 'platform', 'metadata', 'analytics']) as column_name
        UNION ALL SELECT 'bot_config', unnest(ARRAY['id', 'environment', 'config_key', 'config_value', 'metadata', 'updated_at'])
        UNION ALL SELECT 'daily_summaries', unnest(ARRAY['day', 'summary_type', 'environment', 'metrics', 'metadata'])
        UNION ALL SELECT 'audit_log', unnest(ARRAY['id', 'ts', 'event_type', 'component', 'event_data', 'context'])
        UNION ALL SELECT 'system_health', unnest(ARRAY['id', 'ts', 'component', 'status', 'metrics', 'details'])
    ),
    actual_columns AS (
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_name IN ('tweets', 'bot_config', 'daily_summaries', 'audit_log', 'system_health') AND table_schema = 'public'
    )
    SELECT 1 as issue FROM expected_tables e FULL OUTER JOIN actual_tables a ON e.table_name = a.table_name WHERE e.table_name IS NULL OR a.table_name IS NULL
    UNION ALL
    SELECT 1 FROM expected_columns e FULL OUTER JOIN actual_columns a ON e.table_name = a.table_name AND e.column_name = a.column_name WHERE e.column_name IS NULL OR a.column_name IS NULL
) drift_issues;
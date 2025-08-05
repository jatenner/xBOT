-- 🗺️ COMPREHENSIVE DATABASE AUDIT & MAPPING
-- This will map our entire database structure perfectly
-- Date: 2025-08-05

-- ==================================================================
-- 1. COMPLETE TABLE INVENTORY
-- ==================================================================

SELECT 
    '=== TABLE INVENTORY ===' as section,
    '' as table_name,
    '' as table_type,
    '' as row_count,
    '' as size_mb;

SELECT 
    'TABLE' as section,
    t.table_name,
    t.table_type,
    COALESCE(
        (SELECT reltuples::bigint 
         FROM pg_class c 
         JOIN pg_namespace n ON n.oid = c.relnamespace 
         WHERE c.relname = t.table_name AND n.nspname = 'public'
        ), 0
    )::text as row_count,
    COALESCE(
        (SELECT pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)))
         FROM information_schema.tables 
         WHERE table_name = t.table_name AND table_schema = 'public'
        ), 'Unknown'
    ) as size_mb
FROM information_schema.tables t
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- ==================================================================
-- 2. COMPLETE COLUMN MAPPING FOR ALL TABLES
-- ==================================================================

SELECT 
    '=== COLUMN MAPPING ===' as section,
    '' as table_name,
    '' as column_name,
    '' as data_type,
    '' as max_length,
    '' as nullable,
    '' as default_value,
    0 as position;

SELECT 
    'COLUMN' as section,
    c.table_name,
    c.column_name,
    c.data_type || 
    CASE 
        WHEN c.character_maximum_length IS NOT NULL 
        THEN '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL
        THEN '(' || c.numeric_precision || 
             CASE WHEN c.numeric_scale IS NOT NULL 
                  THEN ',' || c.numeric_scale 
                  ELSE '' END || ')'
        ELSE ''
    END as data_type,
    COALESCE(c.character_maximum_length::text, 'N/A') as max_length,
    c.is_nullable,
    COALESCE(c.column_default, 'NULL') as default_value,
    c.ordinal_position as position
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  )
ORDER BY c.table_name, c.ordinal_position;

-- ==================================================================
-- 3. INDEX MAPPING
-- ==================================================================

SELECT 
    '=== INDEX MAPPING ===' as section,
    '' as table_name,
    '' as index_name,
    '' as columns,
    '' as is_unique,
    '' as is_primary;

SELECT 
    'INDEX' as section,
    t.relname as table_name,
    i.relname as index_name,
    array_to_string(array_agg(a.attname ORDER BY a.attnum), ', ') as columns,
    ix.indisunique::text as is_unique,
    ix.indisprimary::text as is_primary
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relkind = 'r'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY t.relname, i.relname, ix.indisunique, ix.indisprimary
ORDER BY t.relname, i.relname;

-- ==================================================================
-- 4. FOREIGN KEY RELATIONSHIPS
-- ==================================================================

SELECT 
    '=== FOREIGN KEY MAPPING ===' as section,
    '' as table_name,
    '' as column_name,
    '' as foreign_table,
    '' as foreign_column,
    '' as constraint_name;

SELECT 
    'FK' as section,
    tc.table_name,
    kcu.column_name,
    ccu.table_name as foreign_table,
    ccu.column_name as foreign_column,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ==================================================================
-- 5. MISSING ESSENTIAL TABLES CHECK
-- ==================================================================

SELECT 
    '=== MISSING TABLES CHECK ===' as section,
    '' as required_table,
    '' as exists_status,
    '' as action_needed;

WITH required_tables AS (
    SELECT unnest(ARRAY[
        'tweets',
        'tweet_analytics', 
        'engagement_history',
        'system_health_monitoring',
        'emergency_posting_log',
        'follower_tracking',
        'follower_attribution',
        'tweet_impressions',
        'bot_config',
        'scheduler_jobs'
    ]) as table_name
)
SELECT 
    'REQUIRED' as section,
    rt.table_name as required_table,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = rt.table_name AND table_schema = 'public'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as exists_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = rt.table_name AND table_schema = 'public'
        ) THEN 'None'
        ELSE 'CREATE TABLE'
    END as action_needed
FROM required_tables rt
ORDER BY rt.table_name;

-- ==================================================================
-- 6. CRITICAL COLUMNS CHECK FOR TWEETS TABLE
-- ==================================================================

SELECT 
    '=== TWEETS TABLE CRITICAL COLUMNS ===' as section,
    '' as required_column,
    '' as exists_status,
    '' as current_type,
    '' as action_needed;

WITH required_columns AS (
    SELECT unnest(ARRAY[
        'tweet_id',
        'content', 
        'confirmed',
        'method_used',
        'resource_usage',
        'likes',
        'retweets', 
        'replies',
        'impressions',
        'posted_at',
        'created_at',
        'updated_at'
    ]) as column_name,
    unnest(ARRAY[
        'VARCHAR(255)',
        'TEXT',
        'BOOLEAN',
        'VARCHAR(50)',
        'JSONB',
        'INTEGER',
        'INTEGER',
        'INTEGER', 
        'INTEGER',
        'TIMESTAMPTZ',
        'TIMESTAMPTZ',
        'TIMESTAMPTZ'
    ]) as expected_type
)
SELECT 
    'TWEETS_COL' as section,
    rc.column_name as required_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tweets' 
              AND column_name = rc.column_name 
              AND table_schema = 'public'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as exists_status,
    COALESCE(
        (SELECT data_type FROM information_schema.columns 
         WHERE table_name = 'tweets' 
           AND column_name = rc.column_name 
           AND table_schema = 'public'),
        'N/A'
    ) as current_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tweets' 
              AND column_name = rc.column_name 
              AND table_schema = 'public'
        ) THEN 'None'
        ELSE 'ADD COLUMN ' || rc.column_name || ' ' || rc.expected_type
    END as action_needed
FROM required_columns rc
ORDER BY rc.column_name;

-- ==================================================================
-- 7. SUMMARY STATISTICS
-- ==================================================================

SELECT 
    '=== DATABASE SUMMARY ===' as section,
    '' as metric,
    '' as value;

SELECT 
    'SUMMARY' as section,
    'Total Tables' as metric,
    COUNT(*)::text as value
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
    'SUMMARY' as section,
    'Total Columns' as metric,
    COUNT(*)::text as value
FROM information_schema.columns 
WHERE table_schema = 'public'

UNION ALL

SELECT 
    'SUMMARY' as section,
    'Total Indexes' as metric,
    COUNT(*)::text as value
FROM pg_indexes 
WHERE schemaname = 'public'

UNION ALL

SELECT 
    'SUMMARY' as section,
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value;
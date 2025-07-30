-- Refresh Supabase schema cache to recognize new columns
-- Run this in Supabase SQL Editor to force schema cache refresh

-- Method 1: Force schema cache refresh by making a trivial schema change
COMMENT ON TABLE tweets IS 'Updated to refresh schema cache - tweets table';
COMMENT ON TABLE learning_posts IS 'Updated to refresh schema cache - learning_posts table';

-- Method 2: Check that our columns are properly registered
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    typname as data_type,
    attnotnull as not_null,
    atthasdef as has_default
FROM pg_attribute a
JOIN pg_class c ON a.attrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_type t ON a.atttypid = t.oid
WHERE n.nspname = 'public' 
  AND c.relname IN ('tweets', 'learning_posts')
  AND a.attname IN ('posted', 'bandit_confidence')
  AND a.attnum > 0
ORDER BY c.relname, a.attname;

-- Method 3: Verify the columns with explicit casting
SELECT 
    'tweets' as table_name,
    'posted' as column_name,
    CASE WHEN posted IS NULL THEN 'NULL' ELSE posted::text END as sample_value
FROM tweets LIMIT 1

UNION ALL

SELECT 
    'learning_posts' as table_name,
    'bandit_confidence' as column_name,
    CASE WHEN bandit_confidence IS NULL THEN 'NULL' ELSE bandit_confidence::text END as sample_value
FROM learning_posts LIMIT 1;
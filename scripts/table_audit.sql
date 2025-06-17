-- =====================================================
-- TABLE AUDIT SCRIPT - Database Inventory & Health Check
-- =====================================================
-- This script provides comprehensive table analysis including:
-- - Row counts, disk usage, and last activity
-- - Identifies tables that may be candidates for cleanup
-- - Helps understand database usage patterns

WITH table_stats AS (
  SELECT 
    schemaname,
    relname as table_name,
    n_live_tup as row_count,
    pg_size_pretty(pg_relation_size(relid)) as table_size,
    pg_relation_size(relid) as size_bytes,
    COALESCE(last_autovacuum, last_vacuum) as last_vacuum,
    COALESCE(last_autoanalyze, last_analyze) as last_analyze,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
  FROM pg_stat_user_tables
),
column_timestamps AS (
  SELECT 
    t.table_name,
    CASE 
      WHEN c.column_name = 'created_at' THEN 'created_at'
      WHEN c.column_name = 'updated_at' THEN 'updated_at'
      WHEN c.column_name = 'last_updated' THEN 'last_updated'
      WHEN c.column_name = 'timestamp' THEN 'timestamp'
      ELSE NULL
    END as timestamp_column
  FROM information_schema.tables t
  LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
  WHERE t.table_schema = 'public' 
    AND c.column_name IN ('created_at', 'updated_at', 'last_updated', 'timestamp')
),
recent_activity AS (
  SELECT 
    ts.table_name,
    GREATEST(
      COALESCE(ts.last_vacuum, '1970-01-01'::timestamp),
      COALESCE(ts.last_analyze, '1970-01-01'::timestamp)
    ) as last_maintenance,
    CASE 
      WHEN ts.inserts + ts.updates + ts.deletes > 0 THEN 'ACTIVE'
      WHEN ts.row_count = 0 THEN 'EMPTY'
      ELSE 'STALE'
    END as activity_status,
    ts.inserts + ts.updates + ts.deletes as total_operations
  FROM table_stats ts
)

SELECT 
  ts.table_name,
  ts.row_count,
  ts.table_size,
  ts.size_bytes,
  to_char(ts.last_vacuum, 'YYYY-MM-DD HH24:MI') as last_vacuum,
  to_char(ts.last_analyze, 'YYYY-MM-DD HH24:MI') as last_analyze,
  ra.activity_status,
  ra.total_operations,
  ts.inserts,
  ts.updates,
  ts.deletes,
  -- Risk assessment for cleanup
  CASE 
    WHEN ts.row_count = 0 AND ra.total_operations = 0 THEN 'HIGH_CLEANUP_CANDIDATE'
    WHEN ts.row_count < 10 AND ra.total_operations < 5 THEN 'MEDIUM_CLEANUP_CANDIDATE'
    WHEN ra.activity_status = 'STALE' AND ts.row_count < 100 THEN 'LOW_CLEANUP_CANDIDATE'
    ELSE 'KEEP_ACTIVE'
  END as cleanup_recommendation,
  -- Age since last maintenance
  CASE 
    WHEN ra.last_maintenance > NOW() - INTERVAL '7 days' THEN 'RECENT'
    WHEN ra.last_maintenance > NOW() - INTERVAL '30 days' THEN 'MODERATE'
    WHEN ra.last_maintenance > NOW() - INTERVAL '90 days' THEN 'OLD'
    ELSE 'VERY_OLD'
  END as maintenance_age
FROM table_stats ts
LEFT JOIN recent_activity ra ON ts.table_name = ra.table_name
WHERE ts.schemaname = 'public'
ORDER BY 
  ts.size_bytes DESC,
  ts.row_count DESC;

-- Additional analysis: Find tables with no foreign key references
SELECT 
  t.table_name,
  'No incoming FKs' as note
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints tc ON t.table_name = tc.table_name
  AND tc.constraint_type = 'FOREIGN KEY'
WHERE t.table_schema = 'public' 
  AND tc.table_name IS NULL
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name; 
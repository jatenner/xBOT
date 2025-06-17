-- =====================================================
-- SOFT DELETE MIGRATION - Unused Tables Cleanup
-- =====================================================
-- Generated: 2024-12-18
-- 
-- ⚠️  IMPORTANT: BACKUP YOUR DATABASE BEFORE RUNNING THIS!
-- 
-- This migration soft-deletes tables by renaming them with zzz_ prefix.
-- This is safer than DROP TABLE as data can be recovered if needed.
-- 
-- To apply this migration:
-- 1. Review each table rename carefully
-- 2. Ensure no application code references these tables
-- 3. Create a database backup
-- 4. Run the migration
-- 
-- To restore a table:
-- ALTER TABLE zzz_tablename_unused_20241218 RENAME TO tablename;

-- Example soft deletions (commented out for safety)
-- Uncomment and modify based on actual audit results

-- Example: Rename empty or unused tables
-- ALTER TABLE unused_table_example RENAME TO zzz_unused_table_example_unused_20241218;

-- Example: Table with zero references in codebase and no recent activity
-- ALTER TABLE old_analytics RENAME TO zzz_old_analytics_unused_20241218;

-- Example: Experimental feature table that's no longer used
-- ALTER TABLE experimental_features RENAME TO zzz_experimental_features_unused_20241218;

-- Create audit log of what was renamed
CREATE TABLE IF NOT EXISTS cleanup_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    new_name TEXT NOT NULL,
    reason TEXT,
    rows_before_rename INTEGER,
    cleanup_date TIMESTAMPTZ DEFAULT NOW(),
    can_restore BOOLEAN DEFAULT true
);

-- Example audit log entries (uncomment and modify when actually renaming tables)
-- INSERT INTO cleanup_audit_log (table_name, new_name, reason, rows_before_rename) VALUES
-- ('unused_table_example', 'zzz_unused_table_example_unused_20241218', 'Zero code references, empty table', 0);

-- Drop unused indexes that might remain
-- DROP INDEX IF EXISTS idx_unused_table_example_column;

-- Add comments to track cleanup
COMMENT ON TABLE cleanup_audit_log IS 'Tracks tables that have been soft-deleted for potential cleanup';

-- =====================================================
-- POST-CLEANUP VERIFICATION QUERIES
-- =====================================================
-- Run these queries after the migration to verify cleanup:

-- 1. Check for zzz_ prefixed tables
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name LIKE 'zzz_%';

-- 2. Verify cleanup audit log
-- SELECT * FROM cleanup_audit_log ORDER BY cleanup_date DESC;

-- 3. Check remaining table sizes
-- SELECT 
--     schemaname,
--     relname as table_name,
--     n_live_tup as row_count,
--     pg_size_pretty(pg_relation_size(relid)) as table_size
-- FROM pg_stat_user_tables 
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(relid) DESC;

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================
-- If you need to rollback any table rename:
-- 
-- 1. Find the original name in cleanup_audit_log:
--    SELECT * FROM cleanup_audit_log WHERE new_name = 'zzz_tablename_unused_20241218';
-- 
-- 2. Rename back:
--    ALTER TABLE zzz_tablename_unused_20241218 RENAME TO original_tablename;
-- 
-- 3. Update audit log:
--    UPDATE cleanup_audit_log 
--    SET can_restore = false 
--    WHERE new_name = 'zzz_tablename_unused_20241218';

-- =====================================================
-- PERMANENT DELETION (Use with extreme caution!)
-- =====================================================
-- After 30+ days, if you're confident tables are not needed:
-- 
-- 1. Verify table is still unused
-- 2. Create final backup
-- 3. DROP TABLE zzz_tablename_unused_20241218;
-- 4. Update audit log to mark as permanently deleted

COMMIT; 
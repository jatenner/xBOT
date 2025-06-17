-- =====================================================
-- SOFT CLEANUP MIGRATION - December 18, 2024
-- =====================================================
-- 
-- ⚠️  IMPORTANT: BACKUP YOUR DATABASE BEFORE RUNNING THIS!
-- 
-- This migration:
-- 1. Creates missing database objects (api_usage table, functions, pgvector)
-- 2. Soft-deletes empty unused tables by renaming them
-- 3. Adds required columns to existing tables
-- 
-- To restore a table:
-- ALTER TABLE zzz_tablename_unused RENAME TO tablename;

-- =====================================================
-- 1. CREATE MISSING OBJECTS
-- =====================================================

-- Enable pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Create api_usage table if not exists
CREATE TABLE IF NOT EXISTS api_usage (
    date DATE PRIMARY KEY,
    writes INTEGER DEFAULT 0,
    reads INTEGER DEFAULT 0
);

-- Insert today's entry if not exists
INSERT INTO api_usage (date, writes, reads) 
VALUES (CURRENT_DATE, 0, 0)
ON CONFLICT (date) DO NOTHING;

-- Create incr_write function
CREATE OR REPLACE FUNCTION incr_write()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO api_usage (date, writes, reads)
    VALUES (CURRENT_DATE, 1, 0)
    ON CONFLICT (date) 
    DO UPDATE SET writes = api_usage.writes + 1;
END;
$$;

-- Create incr_read function
CREATE OR REPLACE FUNCTION incr_read()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO api_usage (date, writes, reads)
    VALUES (CURRENT_DATE, 0, 1)
    ON CONFLICT (date) 
    DO UPDATE SET reads = api_usage.reads + 1;
END;
$$;

-- Add embedding column to tweets table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' 
        AND column_name = 'embedding' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE tweets ADD COLUMN embedding vector(384);
    END IF;
END $$;

-- =====================================================
-- 2. SOFT DELETE UNUSED TABLES
-- =====================================================

-- Rename empty tables with no code references
-- Based on audit results: 0 rows, no recent activity

-- Rename replies table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'replies' AND table_schema = 'public') THEN
        ALTER TABLE replies RENAME TO zzz_replies_unused;
    END IF;
END $$;

-- Rename target_tweets table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'target_tweets' AND table_schema = 'public') THEN
        ALTER TABLE target_tweets RENAME TO zzz_target_tweets_unused;
    END IF;
END $$;

-- Rename engagement_analytics table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'engagement_analytics' AND table_schema = 'public') THEN
        ALTER TABLE engagement_analytics RENAME TO zzz_engagement_analytics_unused;
    END IF;
END $$;

-- Rename content_recycling table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_recycling' AND table_schema = 'public') THEN
        ALTER TABLE content_recycling RENAME TO zzz_content_recycling_unused;
    END IF;
END $$;

-- Rename media_history table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_history' AND table_schema = 'public') THEN
        ALTER TABLE media_history RENAME TO zzz_media_history_unused;
    END IF;
END $$;

-- Rename news_cache table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'news_cache' AND table_schema = 'public') THEN
        ALTER TABLE news_cache RENAME TO zzz_news_cache_unused;
    END IF;
END $$;

-- =====================================================
-- 3. CREATE CLEANUP AUDIT LOG
-- =====================================================

-- Create audit log of what was renamed
CREATE TABLE IF NOT EXISTS cleanup_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    new_name TEXT NOT NULL,
    reason TEXT,
    rows_before_rename INTEGER DEFAULT 0,
    cleanup_date TIMESTAMPTZ DEFAULT NOW(),
    can_restore BOOLEAN DEFAULT true
);

-- Log the cleanup actions
INSERT INTO cleanup_audit_log (table_name, new_name, reason, rows_before_rename) VALUES
('replies', 'zzz_replies_unused', 'Empty table, no code references', 0),
('target_tweets', 'zzz_target_tweets_unused', 'Empty table, no code references', 0),
('engagement_analytics', 'zzz_engagement_analytics_unused', 'Empty table, no code references', 0),
('content_recycling', 'zzz_content_recycling_unused', 'Empty table, no code references', 0),
('media_history', 'zzz_media_history_unused', 'Empty table, no code references', 0),
('news_cache', 'zzz_news_cache_unused', 'Empty table, no code references', 0);

-- Add comment to track cleanup
COMMENT ON TABLE cleanup_audit_log IS 'Tracks tables that have been soft-deleted for potential cleanup';

-- =====================================================
-- 4. VERIFICATION QUERIES
-- =====================================================

-- Verify pgvector extension
SELECT 'pgvector extension' as object_type, 
       CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') 
            THEN '✅ Installed' 
            ELSE '❌ Missing' 
       END as status;

-- Verify api_usage table
SELECT 'api_usage table' as object_type,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage' AND table_schema = 'public')
            THEN '✅ Created'
            ELSE '❌ Missing'
       END as status;

-- Verify functions
SELECT 'incr_write function' as object_type,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'incr_write' AND routine_schema = 'public')
            THEN '✅ Created'
            ELSE '❌ Missing'
       END as status;

SELECT 'incr_read function' as object_type,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'incr_read' AND routine_schema = 'public')
            THEN '✅ Created'
            ELSE '❌ Missing'
       END as status;

-- Verify embedding column
SELECT 'tweets.embedding column' as object_type,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'embedding' AND table_schema = 'public')
            THEN '✅ Added'
            ELSE '❌ Missing'
       END as status;

-- Show renamed tables
SELECT table_name, 'Renamed to zzz_* prefix' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'zzz_%_unused'
ORDER BY table_name;

-- =====================================================
-- 5. ROLLBACK INSTRUCTIONS
-- =====================================================

-- To restore any renamed table:
-- 
-- SELECT table_name, new_name FROM cleanup_audit_log WHERE can_restore = true;
-- ALTER TABLE zzz_tablename_unused RENAME TO tablename;
-- UPDATE cleanup_audit_log SET can_restore = false WHERE new_name = 'zzz_tablename_unused';

COMMIT;

-- =====================================================
-- Migration completed successfully!
-- ===================================================== 
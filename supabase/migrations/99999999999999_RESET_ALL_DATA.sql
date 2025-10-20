-- =====================================================================================
-- 🗑️ COMPLETE DATABASE RESET - WIPES ALL DATA, KEEPS STRUCTURE
-- =====================================================================================
-- WARNING: This will DELETE ALL DATA from all tables
-- Tables and columns will remain intact, only data is removed
-- Created: 2025-10-20
-- Purpose: Fresh start with clean database
-- =====================================================================================

BEGIN;

-- Disable triggers temporarily for faster deletion
SET session_replication_role = 'replica';

-- =====================================================================================
-- TRUNCATE ALL TABLES (keeps structure, removes data)
-- =====================================================================================

-- Core posting and content tables
TRUNCATE TABLE IF EXISTS content_metadata CASCADE;
TRUNCATE TABLE IF EXISTS posted_decisions CASCADE;
TRUNCATE TABLE IF EXISTS outcomes CASCADE;
TRUNCATE TABLE IF EXISTS real_tweet_metrics CASCADE;

-- Learning system tables
TRUNCATE TABLE IF EXISTS learning_posts CASCADE;
TRUNCATE TABLE IF EXISTS learning_insights CASCADE;
TRUNCATE TABLE IF EXISTS tweet_metrics CASCADE;
TRUNCATE TABLE IF EXISTS monitored_posts CASCADE;
TRUNCATE TABLE IF EXISTS metrics_by_phase CASCADE;
TRUNCATE TABLE IF EXISTS performance_patterns CASCADE;

-- Reply and engagement tables
TRUNCATE TABLE IF EXISTS reply_opportunities CASCADE;
TRUNCATE TABLE IF EXISTS engagement_tracking CASCADE;
TRUNCATE TABLE IF EXISTS strategic_replies CASCADE;
TRUNCATE TABLE IF EXISTS viral_reply_history CASCADE;

-- AI and intelligence tables
TRUNCATE TABLE IF EXISTS ai_posting_decisions CASCADE;
TRUNCATE TABLE IF EXISTS ai_learning_insights CASCADE;
TRUNCATE TABLE IF EXISTS generator_performance CASCADE;
TRUNCATE TABLE IF EXISTS content_quality_metrics CASCADE;
TRUNCATE TABLE IF EXISTS topic_performance CASCADE;

-- Timing and optimization tables
TRUNCATE TABLE IF EXISTS timing_predictions CASCADE;
TRUNCATE TABLE IF EXISTS optimal_posting_windows CASCADE;
TRUNCATE TABLE IF EXISTS engagement_windows CASCADE;

-- News and intelligence tables
TRUNCATE TABLE IF EXISTS news_articles CASCADE;
TRUNCATE TABLE IF EXISTS trending_topics CASCADE;
TRUNCATE TABLE IF EXISTS influencer_tracking CASCADE;
TRUNCATE TABLE IF EXISTS peer_content CASCADE;

-- System and tracking tables
TRUNCATE TABLE IF EXISTS openai_usage_log CASCADE;
TRUNCATE TABLE IF EXISTS api_usage CASCADE;
TRUNCATE TABLE IF EXISTS budget_tracking CASCADE;
TRUNCATE TABLE IF EXISTS cost_tracking CASCADE;

-- Follower and growth tables
TRUNCATE TABLE IF EXISTS follower_tracking CASCADE;
TRUNCATE TABLE IF EXISTS growth_metrics CASCADE;
TRUNCATE TABLE IF EXISTS follower_snapshots CASCADE;

-- Content violations and quality
TRUNCATE TABLE IF EXISTS content_violations CASCADE;
TRUNCATE TABLE IF EXISTS quality_scores CASCADE;

-- Unified and consolidated tables (from various migrations)
TRUNCATE TABLE IF EXISTS unified_posts CASCADE;
TRUNCATE TABLE IF EXISTS posts CASCADE;
TRUNCATE TABLE IF EXISTS tweets CASCADE;
TRUNCATE TABLE IF EXISTS learn_metrics CASCADE;

-- Thread and conversation tables
TRUNCATE TABLE IF EXISTS thread_metadata CASCADE;
TRUNCATE TABLE IF EXISTS conversation_threads CASCADE;

-- Bandit and experimentation tables
TRUNCATE TABLE IF EXISTS bandit_arms CASCADE;
TRUNCATE TABLE IF EXISTS experiment_results CASCADE;

-- Session and browser tables
TRUNCATE TABLE IF EXISTS browser_cookies CASCADE;
TRUNCATE TABLE IF EXISTS twitter_sessions CASCADE;

-- Backup tables (if they exist)
TRUNCATE TABLE IF EXISTS data_backup_tweets CASCADE;
TRUNCATE TABLE IF EXISTS data_backup_learning_posts CASCADE;
TRUNCATE TABLE IF EXISTS data_backup_tweet_metrics CASCADE;

-- Any other system tables
TRUNCATE TABLE IF EXISTS system_health CASCADE;
TRUNCATE TABLE IF EXISTS audit_log CASCADE;
TRUNCATE TABLE IF EXISTS query_performance_log CASCADE;
TRUNCATE TABLE IF EXISTS daily_summaries CASCADE;
TRUNCATE TABLE IF EXISTS engagement_snapshots CASCADE;

-- Re-enable triggers
SET session_replication_role = 'default';

-- =====================================================================================
-- RESET SEQUENCES (so new IDs start from 1)
-- =====================================================================================

DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN 
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE ' || seq_record.sequence_name || ' RESTART WITH 1';
    END LOOP;
END $$;

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================

-- Show row counts to verify everything is empty
DO $$
DECLARE
    tbl_record RECORD;
    row_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔍 DATABASE RESET VERIFICATION';
    RAISE NOTICE '========================================';
    
    FOR tbl_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        EXECUTE 'SELECT COUNT(*) FROM ' || tbl_record.tablename INTO row_count;
        IF row_count > 0 THEN
            RAISE NOTICE '❌ % still has % rows', tbl_record.tablename, row_count;
        ELSE
            RAISE NOTICE '✅ % is empty', tbl_record.tablename;
        END IF;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ DATABASE RESET COMPLETE';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- =====================================================================================
-- SUMMARY
-- =====================================================================================
-- ✅ All data deleted from all tables
-- ✅ Table structures preserved
-- ✅ Indexes preserved
-- ✅ Constraints preserved
-- ✅ Sequences reset to 1
-- ✅ Ready for fresh data
-- =====================================================================================


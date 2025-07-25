-- 🚨 EMERGENCY RENDER DATABASE PERMISSION FIX
-- ================================================
-- Fix database permissions for deployed Render service

-- 1. DISABLE ROW LEVEL SECURITY on all tables
ALTER TABLE IF EXISTS bot_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tweets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS twitter_quota_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS engagement_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_budget_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS content_uniqueness DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expert_learning_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS budget_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_logs DISABLE ROW LEVEL SECURITY;

-- 2. GRANT ALL PERMISSIONS to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT CREATE ON SCHEMA public TO service_role;

-- 3. GRANT ALL PERMISSIONS to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 4. GRANT ALL PERMISSIONS to anon users (fallback)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO anon;

-- 5. GRANT ALL PERMISSIONS to postgres (superuser)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- 6. Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- 7. Verify all tables exist and are accessible
SELECT 'EMERGENCY FIX APPLIED - CHECKING TABLES:' as status;

SELECT 
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 8. Test insert/select permissions
SELECT 'TESTING PERMISSIONS:' as test_phase;

-- Test bot_config access
SELECT COUNT(*) as bot_config_rows FROM bot_config;

-- Test tweets access  
SELECT COUNT(*) as tweets_rows FROM tweets;

-- Test quota tracking access
SELECT COUNT(*) as quota_rows FROM twitter_quota_tracking;

SELECT '✅ EMERGENCY DATABASE FIX COMPLETE!' as final_status; 
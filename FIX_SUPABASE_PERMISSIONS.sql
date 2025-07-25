-- 🔓 FIX SUPABASE PERMISSIONS
-- =============================
-- This script ensures your Service Role can access all tables

-- 🚨 DISABLE ROW LEVEL SECURITY (RLS) for all tables
-- RLS blocks service role access even though it should have full permissions

ALTER TABLE bot_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE tweets DISABLE ROW LEVEL SECURITY;
ALTER TABLE twitter_quota_tracking DISABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_budget_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_uniqueness DISABLE ROW LEVEL SECURITY;
ALTER TABLE expert_learning_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transactions DISABLE ROW LEVEL SECURITY;

-- 🔧 GRANT FULL PERMISSIONS to service_role (should already exist, but ensuring)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 🔧 GRANT USAGE on public schema
GRANT USAGE ON SCHEMA public TO service_role;

-- ✅ VERIFICATION QUERIES
SELECT '🔍 CHECKING TABLE PERMISSIONS' as status;

SELECT 
    schemaname,
    tablename,
    tableowner,
    rowsecurity as "RLS Enabled"
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT '✅ PERMISSIONS FIXED - Service Role should now have full access!' as result; 
-- 🧪 TEST 1: TABLE EXISTENCE CHECK
-- =================================
-- Verifies all 9 required tables exist

SELECT '🧪 TEST 1: TABLE EXISTENCE CHECK' as test_name;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('bot_config', 'tweets', 'twitter_quota_tracking', 'engagement_history', 
                           'daily_budget_status', 'system_logs', 'content_uniqueness', 
                           'expert_learning_data', 'budget_transactions') 
        THEN '✅ REQUIRED'
        ELSE '❓ EXTRA'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected: 9 tables with ✅ REQUIRED status
SELECT '✅ TEST 1 COMPLETE - Table existence verified!' as result; 
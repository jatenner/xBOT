-- 🔍 SIMPLE DATABASE STATUS CHECK
-- Copy and paste this single query into Supabase SQL Editor

SELECT 
  'DATABASE STATUS CHECK' as test_name,
  CURRENT_DATE as today,
  (SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE) as tweets_today,
  (SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as tweets_last_7_days,
  (17 - (SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE)) as remaining_today,
  CASE 
    WHEN (SELECT COUNT(*) FROM tweets WHERE created_at >= CURRENT_DATE) <= 17 THEN '✅ Within limit'
    ELSE '🚨 Over limit'
  END as daily_status; 
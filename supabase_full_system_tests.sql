-- 🧪 COMPREHENSIVE SUPABASE DATABASE TESTS
-- Test our robust tweet storage system functionality
-- Run these in Supabase SQL Editor to verify everything works

-- ==========================================
-- 1. SYSTEM STATUS & HEALTH CHECK
-- ==========================================

-- Test 1: Database Connection & Tables
SELECT 
  'DATABASE HEALTH CHECK' as test_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tweets') THEN '✅ tweets table exists'
    ELSE '❌ tweets table missing'
  END as tweets_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage_tracking') THEN '✅ api_usage_tracking exists'
    ELSE '❌ api_usage_tracking missing'
  END as api_tracking_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_uniqueness') THEN '✅ content_uniqueness exists'
    ELSE '❌ content_uniqueness missing'
  END as content_table;

-- ==========================================
-- 2. DAILY TWEET COUNTING TESTS
-- ==========================================

-- Test 2: Today's Tweet Count (Core Functionality)
SELECT 
  'DAILY TWEET COUNT TEST' as test_name,
  CURRENT_DATE as test_date,
  COUNT(*) as tweets_today,
  CASE 
    WHEN COUNT(*) <= 17 THEN '✅ Within daily limit'
    WHEN COUNT(*) > 17 THEN '⚠️ Over daily limit'
    ELSE '❓ Unknown status'
  END as limit_status,
  (17 - COUNT(*)) as remaining_today
FROM tweets 
WHERE created_at >= CURRENT_DATE::timestamp 
  AND created_at < (CURRENT_DATE + INTERVAL '1 day')::timestamp;

-- Test 3: Daily Limit Logic Verification
WITH daily_counts AS (
  SELECT 
    DATE(created_at) as tweet_date,
    COUNT(*) as tweet_count,
    CASE 
      WHEN COUNT(*) < 17 THEN 'Can post more'
      WHEN COUNT(*) = 17 THEN 'Limit reached'
      WHEN COUNT(*) > 17 THEN 'OVER LIMIT!'
      ELSE 'Unknown'
    END as status
  FROM tweets 
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY DATE(created_at)
  ORDER BY tweet_date DESC
)
SELECT 
  'DAILY LIMIT VERIFICATION' as test_name,
  tweet_date,
  tweet_count,
  status,
  CASE 
    WHEN tweet_count > 17 THEN '🚨 VIOLATION DETECTED'
    ELSE '✅ Compliant'
  END as compliance_check
FROM daily_counts;

-- ==========================================
-- 3. DATABASE SYNC & INTEGRITY TESTS
-- ==========================================

-- Test 4: API Usage vs Database Sync Check
WITH api_summary AS (
  SELECT 
    date,
    SUM(count) as total_api_calls
  FROM api_usage_tracking 
  WHERE api_type = 'twitter' 
    AND date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY date
),
tweet_summary AS (
  SELECT 
    DATE(created_at) as tweet_date,
    COUNT(*) as tweets_in_db
  FROM tweets 
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY DATE(created_at)
)
SELECT 
  'DATABASE SYNC INTEGRITY TEST' as test_name,
  COALESCE(a.date, t.tweet_date) as check_date,
  COALESCE(a.total_api_calls, 0) as api_calls,
  COALESCE(t.tweets_in_db, 0) as tweets_saved,
  (COALESCE(a.total_api_calls, 0) - COALESCE(t.tweets_in_db, 0)) as missing_tweets,
  CASE 
    WHEN (COALESCE(a.total_api_calls, 0) - COALESCE(t.tweets_in_db, 0)) = 0 THEN '✅ Perfect sync'
    WHEN (COALESCE(a.total_api_calls, 0) - COALESCE(t.tweets_in_db, 0)) > 0 THEN '🚨 Missing tweets in DB'
    WHEN (COALESCE(a.total_api_calls, 0) - COALESCE(t.tweets_in_db, 0)) < 0 THEN '⚠️ More tweets than API calls'
    ELSE '❓ Unknown status'
  END as sync_status
FROM api_summary a
FULL OUTER JOIN tweet_summary t ON a.date = t.tweet_date
ORDER BY check_date DESC;

-- ==========================================
-- 4. TWEET STORAGE VALIDATION TESTS
-- ==========================================

-- Test 5: Tweet Data Quality Check
SELECT 
  'TWEET DATA QUALITY TEST' as test_name,
  COUNT(*) as total_tweets,
  COUNT(CASE WHEN tweet_id IS NOT NULL AND LENGTH(tweet_id) = 19 THEN 1 END) as valid_tweet_ids,
  COUNT(CASE WHEN content IS NOT NULL AND LENGTH(content) > 0 THEN 1 END) as valid_content,
  COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as valid_timestamps,
  COUNT(CASE WHEN viral_score BETWEEN 1 AND 10 THEN 1 END) as valid_viral_scores,
  CASE 
    WHEN COUNT(*) = COUNT(CASE WHEN tweet_id IS NOT NULL AND LENGTH(tweet_id) = 19 THEN 1 END) THEN '✅ All tweet IDs valid'
    ELSE '❌ Some invalid tweet IDs'
  END as id_validation,
  CASE 
    WHEN COUNT(*) = COUNT(CASE WHEN content IS NOT NULL AND LENGTH(content) > 0 THEN 1 END) THEN '✅ All content valid'
    ELSE '❌ Some missing content'
  END as content_validation
FROM tweets 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Test 6: Duplicate Tweet Detection
SELECT 
  'DUPLICATE DETECTION TEST' as test_name,
  COUNT(*) as total_tweets,
  COUNT(DISTINCT tweet_id) as unique_tweet_ids,
  COUNT(DISTINCT content) as unique_content,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT tweet_id) THEN '✅ No duplicate tweet IDs'
    ELSE '❌ Duplicate tweet IDs found'
  END as id_duplicates,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT content) THEN '✅ No duplicate content'
    ELSE '⚠️ Some content repeated'
  END as content_duplicates
FROM tweets 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- ==========================================
-- 5. RATE LIMIT COMPLIANCE TESTS
-- ==========================================

-- Test 7: 17 Tweet Daily Limit Compliance
WITH hourly_posting AS (
  SELECT 
    DATE(created_at) as post_date,
    EXTRACT(hour FROM created_at) as post_hour,
    COUNT(*) as tweets_per_hour
  FROM tweets 
  WHERE created_at >= CURRENT_DATE - INTERVAL '3 days'
  GROUP BY DATE(created_at), EXTRACT(hour FROM created_at)
  ORDER BY post_date DESC, post_hour
)
SELECT 
  'RATE LIMIT COMPLIANCE TEST' as test_name,
  post_date,
  MAX(tweets_per_hour) as max_tweets_per_hour,
  SUM(tweets_per_hour) as total_tweets_that_day,
  CASE 
    WHEN SUM(tweets_per_hour) <= 17 THEN '✅ Within daily limit'
    WHEN SUM(tweets_per_hour) > 17 THEN '🚨 DAILY LIMIT EXCEEDED'
    ELSE '❓ Unknown'
  END as daily_compliance,
  CASE 
    WHEN MAX(tweets_per_hour) <= 5 THEN '✅ Reasonable hourly rate'
    WHEN MAX(tweets_per_hour) > 10 THEN '⚠️ Very high hourly rate'
    ELSE '✅ Normal hourly rate'
  END as hourly_assessment
FROM hourly_posting
GROUP BY post_date
ORDER BY post_date DESC;

-- ==========================================
-- 6. CONTENT UNIQUENESS TESTS
-- ==========================================

-- Test 8: Content Uniqueness System Check
SELECT 
  'CONTENT UNIQUENESS TEST' as test_name,
  COUNT(*) as total_entries,
  COUNT(DISTINCT content_hash) as unique_hashes,
  COUNT(CASE WHEN content_keywords IS NOT NULL THEN 1 END) as entries_with_keywords,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT content_hash) THEN '✅ All content unique'
    ELSE '⚠️ Some content repeated'
  END as uniqueness_status
FROM content_uniqueness 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- ==========================================
-- 7. SYSTEM PERFORMANCE TESTS
-- ==========================================

-- Test 9: Recent Activity Timeline
SELECT 
  'RECENT ACTIVITY TIMELINE' as test_name,
  DATE(created_at) as activity_date,
  COUNT(*) as tweets_posted,
  MIN(created_at) as first_tweet,
  MAX(created_at) as last_tweet,
  EXTRACT(epoch FROM (MAX(created_at) - MIN(created_at)))/3600 as hours_between_first_last,
  CASE 
    WHEN COUNT(*) > 0 AND COUNT(*) <= 17 THEN '✅ Normal activity'
    WHEN COUNT(*) > 17 THEN '🚨 Excessive activity'
    ELSE '❓ No activity'
  END as activity_assessment
FROM tweets 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY activity_date DESC;

-- ==========================================
-- 8. FINAL SYSTEM HEALTH SUMMARY
-- ==========================================

-- Test 10: Overall System Health Summary
WITH health_metrics AS (
  SELECT 
    COUNT(*) as total_tweets_7_days,
    COUNT(DISTINCT DATE(created_at)) as active_days,
    AVG(CASE WHEN viral_score BETWEEN 1 AND 10 THEN viral_score END) as avg_viral_score,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as tweets_today,
    MAX(CASE WHEN DATE(created_at) = CURRENT_DATE THEN created_at END) as last_tweet_today
  FROM tweets 
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  'SYSTEM HEALTH SUMMARY' as test_name,
  total_tweets_7_days,
  active_days,
  ROUND(avg_viral_score, 2) as avg_viral_score,
  tweets_today,
  (17 - tweets_today) as remaining_today,
  CASE 
    WHEN tweets_today <= 17 THEN '✅ Within daily limit'
    ELSE '🚨 Over daily limit'
  END as daily_status,
  CASE 
    WHEN active_days >= 3 THEN '✅ Regular activity'
    WHEN active_days >= 1 THEN '⚠️ Some activity'
    ELSE '❌ No recent activity'
  END as activity_status,
  CASE 
    WHEN last_tweet_today IS NOT NULL THEN '✅ Posted today'
    ELSE '⚠️ No posts today yet'
  END as today_status
FROM health_metrics;

-- ==========================================
-- 9. TESTING OUR ROBUST STORAGE LOGIC
-- ==========================================

-- Test 11: Simulate Daily Limit Check (Core Logic Test)
WITH simulated_daily_check AS (
  SELECT 
    CURRENT_DATE as check_date,
    COUNT(*) as current_count,
    17 as daily_limit,
    (17 - COUNT(*)) as remaining,
    CASE 
      WHEN COUNT(*) < 17 THEN true
      ELSE false
    END as can_post
  FROM tweets 
  WHERE created_at >= CURRENT_DATE::timestamp 
    AND created_at < (CURRENT_DATE + INTERVAL '1 day')::timestamp
)
SELECT 
  'ROBUST STORAGE LOGIC TEST' as test_name,
  check_date,
  current_count,
  daily_limit,
  remaining,
  can_post,
  CASE 
    WHEN can_post = true AND remaining > 0 THEN '✅ Can post more tweets'
    WHEN can_post = false AND remaining <= 0 THEN '🚫 Daily limit reached'
    ELSE '❓ Logic error detected'
  END as logic_validation
FROM simulated_daily_check;

-- ==========================================
-- FINAL TEST SUMMARY
-- ==========================================

SELECT 
  '🎯 TEST SUITE COMPLETE' as status,
  'Run all tests above to verify database functionality' as instructions,
  'Look for ❌ or 🚨 indicators for issues' as what_to_check,
  'All ✅ results mean system is working properly' as success_criteria; 
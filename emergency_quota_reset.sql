-- 🚨 EMERGENCY QUOTA RESET
-- Fix quota tracking confusion between Twitter API headers and database reality

-- 1. Check actual tweet count from database (the real source of truth)
SELECT 
  'REAL TWEET COUNT TODAY' as check_type,
  COUNT(*) as actual_tweets_today,
  17 - COUNT(*) as remaining_quota
FROM tweets 
WHERE created_at >= CURRENT_DATE 
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
  AND success = true;

-- 2. Reset any incorrect quota tracking tables
DELETE FROM api_usage WHERE date = CURRENT_DATE;

-- 3. Insert correct quota tracking based on actual database tweets
INSERT INTO api_usage (date, writes, reads, daily_tweets_posted)
SELECT 
  CURRENT_DATE,
  COUNT(*) as writes,  -- tweets posted = writes made
  0 as reads,
  COUNT(*) as daily_tweets_posted
FROM tweets 
WHERE created_at >= CURRENT_DATE 
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
  AND success = true
ON CONFLICT (date) DO UPDATE SET
  writes = EXCLUDED.writes,
  daily_tweets_posted = EXCLUDED.daily_tweets_posted;

-- 4. Clear any cached quota data in bot_config
DELETE FROM bot_config WHERE key LIKE '%quota%';
DELETE FROM bot_config WHERE key LIKE '%writes_%';
DELETE FROM bot_config WHERE key LIKE '%reads_%';

-- 5. Set correct current quota status
INSERT INTO bot_config (key, value) 
SELECT 'current_daily_tweets', COUNT(*)::text 
FROM tweets 
WHERE created_at >= CURRENT_DATE 
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
  AND success = true
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. Verify the fix
SELECT 
  'QUOTA RESET VERIFICATION' as status,
  COUNT(*) as database_tweets_today,
  17 - COUNT(*) as quota_remaining,
  CASE 
    WHEN COUNT(*) >= 17 THEN 'QUOTA_EXHAUSTED'
    ELSE 'CAN_POST'
  END as bot_status
FROM tweets 
WHERE created_at >= CURRENT_DATE 
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
  AND success = true;

SELECT 'QUOTA RESET COMPLETE - Database is now the source of truth!' as result; 
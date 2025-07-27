-- 🔍 CHECK IMPRESSIONS DATA IN DATABASE
-- This will show us if the continuous monitoring is actually saving metrics

-- Check recent tweets and their engagement metrics
SELECT 
  tweet_id,
  content,
  created_at,
  likes_count,
  retweets_count,
  replies_count,
  quotes_count,
  impressions_count,
  engagement_score,
  viral_velocity,
  updated_at,
  CASE 
    WHEN impressions_count IS NOT NULL AND impressions_count > 0 THEN '✅ HAS IMPRESSIONS'
    WHEN likes_count IS NOT NULL OR retweets_count IS NOT NULL THEN '⚠️ PARTIAL METRICS'
    ELSE '❌ NO METRICS'
  END as metrics_status
FROM tweets 
ORDER BY created_at DESC 
LIMIT 10;

-- Summary of metrics coverage
SELECT 
  COUNT(*) as total_tweets,
  COUNT(CASE WHEN impressions_count IS NOT NULL AND impressions_count > 0 THEN 1 END) as tweets_with_impressions,
  COUNT(CASE WHEN likes_count IS NOT NULL OR retweets_count IS NOT NULL THEN 1 END) as tweets_with_metrics,
  ROUND(
    COUNT(CASE WHEN impressions_count IS NOT NULL AND impressions_count > 0 THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as impression_coverage_percent
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Check tweet_metrics table
SELECT 
  tweet_id,
  like_count,
  impression_count,
  engagement_rate,
  viral_velocity,
  captured_at
FROM tweet_metrics 
ORDER BY captured_at DESC 
LIMIT 5;

-- Check if continuous monitoring columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tweets' 
AND column_name IN ('likes_count', 'impressions_count', 'viral_velocity', 'updated_at')
ORDER BY column_name; 
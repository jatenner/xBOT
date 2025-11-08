-- ═══════════════════════════════════════════════════════════════════
-- POSTING SYSTEM DIAGNOSTIC QUERIES
-- Run these against your Supabase database to gather evidence
-- Date: November 8, 2025
-- ═══════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 1: Current Queue State                                    │
-- │ Purpose: See what's waiting to be posted RIGHT NOW              │
-- │ Expected: Small queue (<5 items), nothing severely overdue      │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  decision_id,
  decision_type,
  status,
  TO_CHAR(scheduled_at, 'YYYY-MM-DD HH24:MI:SS') as scheduled_time,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time,
  TO_CHAR(posted_at, 'YYYY-MM-DD HH24:MI:SS') as posted_time,
  tweet_id IS NULL as missing_tweet_id,
  ROUND(EXTRACT(EPOCH FROM (NOW() - scheduled_at))/60, 1) as minutes_overdue,
  SUBSTRING(content, 1, 60) || '...' as content_preview
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'queued'
ORDER BY scheduled_at ASC
LIMIT 20;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 2: Posting Rate Last 24 Hours                            │
-- │ Purpose: Check if system is achieving 2 posts/hour             │
-- │ Expected: Consistent ~2 posts per hour                         │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  TO_CHAR(DATE_TRUNC('hour', posted_at), 'YYYY-MM-DD HH24:00') as hour,
  COUNT(*) as total_posts,
  COUNT(*) FILTER (WHERE decision_type = 'single') as singles,
  COUNT(*) FILTER (WHERE decision_type = 'thread') as threads,
  COUNT(*) FILTER (WHERE tweet_id IS NULL) as missing_tweet_ids,
  ROUND(AVG(EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60), 1) as avg_delay_minutes
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', posted_at)
ORDER BY hour DESC;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 3: NULL Tweet IDs (CRITICAL)                             │
-- │ Purpose: Find posts blocking the system                        │
-- │ Expected: Zero or very few, all older than 10 minutes          │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  decision_id,
  decision_type,
  TO_CHAR(posted_at, 'YYYY-MM-DD HH24:MI:SS') as posted_time,
  status,
  ROUND(EXTRACT(EPOCH FROM (NOW() - posted_at))/60, 1) as minutes_since_post,
  SUBSTRING(content, 1, 80) || '...' as content_preview,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - posted_at))/60 < 10 THEN '🔴 BLOCKING SYSTEM'
    WHEN EXTRACT(EPOCH FROM (NOW() - posted_at))/60 < 30 THEN '🟡 Needs recovery'
    ELSE '⚪ Old issue'
  END as severity
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND tweet_id IS NULL
  AND posted_at >= NOW() - INTERVAL '24 hours'
ORDER BY posted_at DESC;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 4: Failed Posts Analysis                                 │
-- │ Purpose: See what's failing and why                            │
-- │ Expected: Low failure rate (<5%)                               │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  decision_type,
  COUNT(*) as failed_count,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600), 1) as avg_hours_old,
  COUNT(DISTINCT error_message) as unique_errors,
  STRING_AGG(DISTINCT SUBSTRING(error_message, 1, 100), ' | ') as error_samples
FROM content_metadata
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY decision_type;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 5: Content Generation Rate                               │
-- │ Purpose: Verify plan job is generating 2 posts/hour            │
-- │ Expected: Consistent 2 posts per hour generated                │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  TO_CHAR(DATE_TRUNC('hour', created_at), 'YYYY-MM-DD HH24:00') as hour,
  COUNT(*) as posts_generated,
  COUNT(*) FILTER (WHERE decision_type = 'single') as singles,
  COUNT(*) FILTER (WHERE decision_type = 'thread') as threads,
  COUNT(DISTINCT topic_cluster) as unique_topics,
  ROUND(AVG(quality_score), 3) as avg_quality,
  ROUND(AVG(predicted_er), 3) as avg_predicted_er
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 6: Rate Limit Check (Simulates Code Logic)              │
-- │ Purpose: See what rate limiter sees RIGHT NOW                  │
-- │ Expected: Should match actual posting in last hour             │
-- └─────────────────────────────────────────────────────────────────┘

-- This shows what the CURRENT code sees (using created_at)
SELECT 
  'Using created_at (CURRENT CODE)' as method,
  COUNT(*) as posts_counted,
  2 - COUNT(*) as slots_available,
  CASE 
    WHEN COUNT(*) >= 2 THEN '🔴 BLOCKED'
    ELSE '🟢 CAN POST'
  END as status
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status IN ('posted', 'failed')
  AND created_at >= NOW() - INTERVAL '1 hour'

UNION ALL

-- This shows what it SHOULD see (using posted_at)
SELECT 
  'Using posted_at (CORRECT)' as method,
  COUNT(*) as posts_counted,
  2 - COUNT(*) as slots_available,
  CASE 
    WHEN COUNT(*) >= 2 THEN '🔴 BLOCKED'
    ELSE '🟢 CAN POST'
  END as status
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at >= NOW() - INTERVAL '1 hour';

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 7: Thread Success Rate                                   │
-- │ Purpose: See if threads are posting successfully               │
-- │ Expected: >80% success rate for threads                        │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage,
  COUNT(*) FILTER (WHERE tweet_id IS NULL) as missing_tweet_ids,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(posted_at, NOW()) - created_at))/60), 1) as avg_time_to_post_minutes
FROM content_metadata
WHERE decision_type = 'thread'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 8: Scheduling Accuracy                                   │
-- │ Purpose: Check if posts are publishing on schedule             │
-- │ Expected: Most posts within 5 minutes of scheduled time        │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  CASE 
    WHEN EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60 < 0 THEN '🟢 Early (< 0min)'
    WHEN EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60 <= 5 THEN '🟢 On time (0-5min)'
    WHEN EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60 <= 15 THEN '🟡 Slightly late (5-15min)'
    WHEN EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60 <= 60 THEN '🟠 Late (15-60min)'
    ELSE '🔴 Very late (>60min)'
  END as timing_category,
  COUNT(*) as post_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage,
  ROUND(MIN(EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60), 1) as min_delay,
  ROUND(MAX(EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60), 1) as max_delay,
  ROUND(AVG(EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60), 1) as avg_delay
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at IS NOT NULL
  AND scheduled_at IS NOT NULL
  AND posted_at >= NOW() - INTERVAL '24 hours'
GROUP BY timing_category
ORDER BY min_delay;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 9: Overall System Health Summary                         │
-- │ Purpose: Single-query overview of posting system health        │
-- │ Expected: Green across the board                               │
-- └─────────────────────────────────────────────────────────────────┘

WITH recent_posts AS (
  SELECT * FROM content_metadata
  WHERE decision_type IN ('single', 'thread')
    AND created_at >= NOW() - INTERVAL '24 hours'
),
hourly_stats AS (
  SELECT 
    DATE_TRUNC('hour', posted_at) as hour,
    COUNT(*) as posts
  FROM recent_posts
  WHERE status = 'posted'
  GROUP BY DATE_TRUNC('hour', posted_at)
)
SELECT 
  '24 Hour System Health' as metric,
  COUNT(*) FILTER (WHERE status = 'posted') as posts_published,
  COUNT(*) FILTER (WHERE status = 'queued') as currently_queued,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_posts,
  COUNT(*) FILTER (WHERE status = 'posted' AND tweet_id IS NULL) as missing_tweet_ids,
  ROUND(AVG(posts.posts), 1) as avg_posts_per_hour,
  CASE 
    WHEN AVG(posts.posts) >= 1.8 AND AVG(posts.posts) <= 2.2 THEN '🟢 HEALTHY'
    WHEN AVG(posts.posts) >= 1.0 THEN '🟡 UNDERPERFORMING'
    ELSE '🔴 CRITICAL'
  END as health_status
FROM recent_posts
CROSS JOIN (SELECT AVG(posts) as posts FROM hourly_stats) as posts;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │ QUERY 10: Recent Posts with Full Details (Last 20)            │
-- │ Purpose: Manual review of most recent posting activity         │
-- │ Expected: Recent posts with proper tweet_ids, no errors        │
-- └─────────────────────────────────────────────────────────────────┘

SELECT 
  decision_id,
  decision_type,
  status,
  TO_CHAR(scheduled_at, 'MM-DD HH24:MI') as scheduled,
  TO_CHAR(posted_at, 'MM-DD HH24:MI') as posted,
  ROUND(EXTRACT(EPOCH FROM (posted_at - scheduled_at))/60, 1) as delay_min,
  tweet_id IS NOT NULL as has_tweet_id,
  SUBSTRING(content, 1, 50) || '...' as content_preview,
  topic_cluster,
  ROUND(quality_score, 2) as quality,
  error_message
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════
-- HOW TO RUN THESE QUERIES
-- ═══════════════════════════════════════════════════════════════════
--
-- Option 1: Supabase Dashboard
-- 1. Go to https://app.supabase.com
-- 2. Select your project
-- 3. Click "SQL Editor" in left sidebar
-- 4. Paste query and click "Run"
--
-- Option 2: psql Command Line
-- psql "postgresql://postgres.qtgjmaelglghnlahqpbl:Christophernolanfan123!!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
-- Then paste query and press Enter
--
-- Option 3: Node.js Script (create query-runner.ts)
-- import { getSupabaseClient } from './src/db/index';
-- const { data, error } = await getSupabaseClient().rpc('your_query_here');
--
-- ═══════════════════════════════════════════════════════════════════
-- RECOMMENDED ORDER
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. Run Query 9 (System Health Summary) - Get overall picture
-- 2. Run Query 2 (Posting Rate) - Check if achieving 2/hour
-- 3. Run Query 3 (NULL Tweet IDs) - Check for blocking issues
-- 4. Run Query 1 (Current Queue) - See what's waiting right now
-- 5. Run Query 6 (Rate Limit Check) - Verify rate limiter behavior
-- 6. Run remaining queries as needed based on findings
--
-- ═══════════════════════════════════════════════════════════════════


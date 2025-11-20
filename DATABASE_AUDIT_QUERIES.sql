-- =====================================================================================
-- 🔍 COMPREHENSIVE DATABASE AUDIT
-- Run these queries in Supabase SQL Editor to check data integrity
-- =====================================================================================

-- =====================================================================================
-- 1. COUNT BY DECISION_TYPE AND STATUS
-- =====================================================================================
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE posted_at IS NOT NULL) as with_posted_at,
  COUNT(*) FILTER (WHERE posted_at IS NULL) as without_posted_at,
  COUNT(*) FILTER (WHERE created_at IS NOT NULL) as with_created_at,
  COUNT(*) FILTER (WHERE created_at IS NULL) as without_created_at
FROM content_metadata
GROUP BY decision_type, status
ORDER BY decision_type, status;

-- =====================================================================================
-- 2. CHECK FOR DATA CORRUPTION
-- =====================================================================================

-- Invalid decision_type values
SELECT 
  decision_id,
  decision_type,
  status,
  created_at
FROM content_metadata
WHERE decision_type IS NULL 
   OR decision_type NOT IN ('single', 'thread', 'reply')
ORDER BY created_at DESC
LIMIT 20;

-- Replies without target_tweet_id (should have one)
SELECT 
  decision_id,
  decision_type,
  status,
  target_tweet_id,
  target_username,
  created_at
FROM content_metadata
WHERE decision_type = 'reply' 
  AND (target_tweet_id IS NULL OR target_tweet_id = '')
ORDER BY created_at DESC
LIMIT 20;

-- Singles/threads with target_tweet_id (shouldn't have one)
SELECT 
  decision_id,
  decision_type,
  status,
  target_tweet_id,
  created_at
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND target_tweet_id IS NOT NULL
  AND target_tweet_id != ''
ORDER BY created_at DESC
LIMIT 20;

-- Empty content
SELECT 
  decision_id,
  decision_type,
  status,
  LENGTH(content) as content_length,
  created_at
FROM content_metadata
WHERE content IS NULL 
   OR TRIM(content) = ''
ORDER BY created_at DESC
LIMIT 20;

-- =====================================================================================
-- 3. DATE FIELD AUDIT
-- =====================================================================================

-- Posted items without posted_at timestamp
SELECT 
  decision_id,
  decision_type,
  status,
  created_at,
  posted_at,
  scheduled_at,
  tweet_id
FROM content_metadata
WHERE status = 'posted'
  AND posted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- Posted items without tweet_id (CRITICAL!)
SELECT 
  decision_id,
  decision_type,
  status,
  created_at,
  posted_at,
  tweet_id
FROM content_metadata
WHERE status = 'posted'
  AND (tweet_id IS NULL OR tweet_id = '')
ORDER BY created_at DESC
LIMIT 50;

-- Items with posted_at but status != 'posted' (inconsistency)
SELECT 
  decision_id,
  decision_type,
  status,
  created_at,
  posted_at,
  tweet_id
FROM content_metadata
WHERE posted_at IS NOT NULL
  AND status != 'posted'
ORDER BY created_at DESC
LIMIT 50;

-- =====================================================================================
-- 4. DASHBOARD QUERY SIMULATION
-- =====================================================================================

-- What the dashboard SHOULD show (last 50 posted items)
SELECT 
  decision_type,
  status,
  posted_at,
  created_at,
  tweet_id,
  target_username,
  LEFT(content, 50) as content_preview,
  actual_impressions,
  actual_likes,
  actual_retweets,
  actual_engagement_rate
FROM content_metadata
WHERE status = 'posted'
  AND decision_type IN ('single', 'thread', 'reply')
ORDER BY 
  COALESCE(posted_at, created_at) DESC
LIMIT 50;

-- Count by type in dashboard view
SELECT 
  decision_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE posted_at IS NOT NULL) as with_date,
  COUNT(*) FILTER (WHERE posted_at IS NULL) as without_date,
  COUNT(*) FILTER (WHERE tweet_id IS NOT NULL) as with_tweet_id,
  COUNT(*) FILTER (WHERE tweet_id IS NULL) as without_tweet_id
FROM content_metadata
WHERE status = 'posted'
  AND decision_type IN ('single', 'thread', 'reply')
GROUP BY decision_type
ORDER BY decision_type;

-- =====================================================================================
-- 5. RECENT ACTIVITY BREAKDOWN
-- =====================================================================================

-- Last 24 hours by type
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM content_metadata
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY decision_type, status
ORDER BY decision_type, status;

-- Last 7 days posted items
SELECT 
  decision_type,
  COUNT(*) as posted_count,
  COUNT(*) FILTER (WHERE posted_at IS NOT NULL) as with_posted_at,
  COUNT(*) FILTER (WHERE tweet_id IS NOT NULL) as with_tweet_id,
  COUNT(*) FILTER (WHERE actual_impressions > 0) as with_metrics
FROM content_metadata
WHERE status = 'posted'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY decision_type
ORDER BY decision_type;

-- =====================================================================================
-- 6. CHECK HOW markDecisionPosted IS SAVING DATA
-- =====================================================================================

-- Posted items with all fields (should have tweet_id, posted_at, status='posted')
SELECT 
  decision_id,
  decision_type,
  status,
  tweet_id,
  posted_at,
  created_at,
  target_tweet_id,
  target_username
FROM content_metadata
WHERE status = 'posted'
ORDER BY posted_at DESC NULLS LAST
LIMIT 50;

-- Check if decision_type is being preserved correctly
SELECT 
  decision_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'posted') as posted,
  COUNT(*) FILTER (WHERE status = 'queued') as queued,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM content_metadata
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY decision_type
ORDER BY decision_type;

-- =====================================================================================
-- 7. SPECIFIC ISSUE: Are replies showing where posts should be?
-- =====================================================================================

-- Check if dashboard query would show all replies
SELECT 
  'Dashboard would show' as query_type,
  decision_type,
  COUNT(*) as count
FROM content_metadata
WHERE status = 'posted'
  AND decision_type IN ('single', 'thread', 'reply')
  AND posted_at IS NOT NULL
GROUP BY decision_type
ORDER BY decision_type;

-- Check if there are any singles/threads that should be showing
SELECT 
  decision_id,
  decision_type,
  status,
  posted_at,
  created_at,
  tweet_id,
  LEFT(content, 80) as preview
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
ORDER BY COALESCE(posted_at, created_at) DESC
LIMIT 20;

-- =====================================================================================
-- 8. METRICS DATA CHECK
-- =====================================================================================

-- Posted items with zero metrics (might not be scraped yet)
SELECT 
  decision_id,
  decision_type,
  status,
  posted_at,
  tweet_id,
  actual_impressions,
  actual_likes,
  actual_retweets,
  actual_engagement_rate
FROM content_metadata
WHERE status = 'posted'
  AND posted_at IS NOT NULL
  AND (actual_impressions IS NULL OR actual_impressions = 0)
ORDER BY posted_at DESC
LIMIT 50;


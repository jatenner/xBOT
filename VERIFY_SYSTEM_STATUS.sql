-- 🔍 COMPREHENSIVE SYSTEM STATUS VERIFICATION QUERIES
-- Run these in Supabase SQL Editor or via psql

-- ============================================================
-- 1. RECENT POSTING ACTIVITY (Last 24 Hours)
-- ============================================================
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MAX(posted_at) as last_post,
  COUNT(CASE WHEN tweet_id IS NULL THEN 1 END) as null_tweet_ids
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '24 hours'
  AND decision_type IN ('single', 'thread', 'reply')
GROUP BY decision_type, status
ORDER BY decision_type, status;

-- ============================================================
-- 2. POSTING ACTIVITY BY HOUR (Last 24 Hours)
-- ============================================================
SELECT 
  DATE_TRUNC('hour', posted_at) as hour,
  decision_type,
  COUNT(*) as posts_count
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '24 hours'
  AND status = 'posted'
  AND decision_type IN ('single', 'thread', 'reply')
GROUP BY DATE_TRUNC('hour', posted_at), decision_type
ORDER BY hour DESC, decision_type;

-- ============================================================
-- 3. QUEUE STATUS
-- ============================================================
SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MIN(scheduled_at) as earliest_scheduled,
  MAX(scheduled_at) as latest_scheduled,
  COUNT(CASE WHEN scheduled_at <= NOW() THEN 1 END) as ready_to_post
FROM content_metadata
WHERE status IN ('queued', 'posting')
  AND decision_type IN ('single', 'thread', 'reply')
GROUP BY decision_type, status
ORDER BY decision_type, status;

-- ============================================================
-- 4. STUCK POSTS (Status='posting' >15 minutes)
-- ============================================================
SELECT 
  decision_id,
  decision_type,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
FROM content_metadata
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '15 minutes'
ORDER BY created_at ASC;

-- ============================================================
-- 5. NULL TWEET IDS (Posted but ID not saved)
-- ============================================================
SELECT 
  decision_id,
  decision_type,
  status,
  posted_at,
  EXTRACT(EPOCH FROM (NOW() - posted_at))/60 as minutes_ago
FROM content_metadata
WHERE status = 'posted'
  AND tweet_id IS NULL
  AND posted_at >= NOW() - INTERVAL '24 hours'
ORDER BY posted_at DESC;

-- ============================================================
-- 6. RATE LIMIT CHECK (Last Hour)
-- ============================================================
SELECT 
  decision_type,
  COUNT(*) as posts_last_hour,
  CASE 
    WHEN decision_type IN ('single', 'thread') THEN 2  -- MAX_POSTS_PER_HOUR
    WHEN decision_type = 'reply' THEN 4                 -- REPLIES_PER_HOUR
  END as rate_limit,
  CASE 
    WHEN decision_type IN ('single', 'thread') AND COUNT(*) >= 2 THEN 'LIMIT REACHED'
    WHEN decision_type = 'reply' AND COUNT(*) >= 4 THEN 'LIMIT REACHED'
    ELSE 'OK'
  END as status
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '1 hour'
  AND status = 'posted'
  AND decision_type IN ('single', 'thread', 'reply')
GROUP BY decision_type;

-- ============================================================
-- 7. CONTENT GENERATION STATUS (Last 24 Hours)
-- ============================================================
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  decision_type,
  status,
  COUNT(*) as count
FROM content_metadata
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND decision_type IN ('single', 'thread')
GROUP BY DATE_TRUNC('hour', created_at), decision_type, status
ORDER BY hour DESC, decision_type, status;

-- ============================================================
-- 8. REPLY GENERATION STATUS (Last 24 Hours)
-- ============================================================
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  status,
  COUNT(*) as count
FROM content_metadata
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND decision_type = 'reply'
GROUP BY DATE_TRUNC('hour', created_at), status
ORDER BY hour DESC, status;

-- ============================================================
-- 9. SYSTEM HEALTH SUMMARY
-- ============================================================
SELECT 
  'Content Posts (24h)' as metric,
  COUNT(*) as value
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '24 hours'
  AND decision_type IN ('single', 'thread')
  AND status = 'posted'

UNION ALL

SELECT 
  'Replies (24h)' as metric,
  COUNT(*) as value
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '24 hours'
  AND decision_type = 'reply'
  AND status = 'posted'

UNION ALL

SELECT 
  'Queued Content' as metric,
  COUNT(*) as value
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')

UNION ALL

SELECT 
  'Queued Replies' as metric,
  COUNT(*) as value
FROM content_metadata
WHERE status = 'queued'
  AND decision_type = 'reply'

UNION ALL

SELECT 
  'Stuck Posts' as metric,
  COUNT(*) as value
FROM content_metadata
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '15 minutes'

UNION ALL

SELECT 
  'NULL Tweet IDs' as metric,
  COUNT(*) as value
FROM content_metadata
WHERE status = 'posted'
  AND tweet_id IS NULL
  AND posted_at >= NOW() - INTERVAL '24 hours';



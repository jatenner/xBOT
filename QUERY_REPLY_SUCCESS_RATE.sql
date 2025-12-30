-- Query to check actual reply posting success rate
-- Run this in Supabase SQL editor to get current metrics

-- 1. Overall reply success rate
SELECT 
  COUNT(*) FILTER (WHERE status = 'posted') as posted_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
  COUNT(*) FILTER (WHERE status = 'posting') as posting_count,
  COUNT(*) as total_replies,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'posted')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as success_rate_percent
FROM content_metadata
WHERE decision_type = 'reply'
  AND created_at >= NOW() - INTERVAL '7 days';

-- 2. Success rate by day (last 7 days)
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE status = 'posted') as posted,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) as total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'posted')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as success_rate_percent
FROM content_metadata
WHERE decision_type = 'reply'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 3. Recent reply activity (last 24 hours)
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM content_metadata
WHERE decision_type = 'reply'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- 4. Reply opportunities vs actual replies
SELECT 
  (SELECT COUNT(*) FROM reply_opportunities WHERE status = 'pending') as pending_opportunities,
  (SELECT COUNT(*) FROM reply_opportunities WHERE status = 'replied') as replied_opportunities,
  (SELECT COUNT(*) FROM content_metadata 
   WHERE decision_type = 'reply' 
   AND status = 'posted' 
   AND posted_at >= NOW() - INTERVAL '24 hours') as replies_posted_24h,
  (SELECT COUNT(*) FROM content_metadata 
   WHERE decision_type = 'reply' 
   AND status = 'queued') as replies_queued;




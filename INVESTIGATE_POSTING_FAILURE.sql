-- 🔍 COMPREHENSIVE POSTING FAILURE INVESTIGATION SQL QUERIES
-- Run these queries to diagnose why posting stopped

-- 1. CHECK RECENT POSTS (last 12 hours)
SELECT 
  decision_id,
  status,
  decision_type,
  created_at,
  posted_at,
  LEFT(content, 50) as content_preview,
  CASE 
    WHEN status = 'posting' THEN EXTRACT(EPOCH FROM (NOW() - created_at)) / 60
    ELSE NULL
  END as stuck_minutes
FROM content_metadata
WHERE created_at >= NOW() - INTERVAL '12 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 2. POST STATUS SUMMARY
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as latest_created,
  MAX(posted_at) as latest_posted
FROM content_metadata
WHERE created_at >= NOW() - INTERVAL '12 hours'
GROUP BY status;

-- 3. CHECK JOB HEARTBEATS
SELECT 
  job_name,
  last_success,
  last_failure,
  consecutive_failures,
  last_error,
  updated_at,
  CASE 
    WHEN last_success IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - last_success::timestamp)) / 3600
    ELSE NULL
  END as hours_since_success,
  CASE 
    WHEN last_failure IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - last_failure::timestamp)) / 3600
    ELSE NULL
  END as hours_since_failure
FROM job_heartbeats
WHERE job_name IN ('posting', 'plan', 'reply_posting')
ORDER BY updated_at DESC;

-- 4. CHECK RECENT ERRORS
SELECT 
  event_type,
  severity,
  created_at,
  event_data,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
FROM system_events
WHERE created_at >= NOW() - INTERVAL '12 hours'
  AND severity IN ('error', 'critical')
ORDER BY created_at DESC
LIMIT 20;

-- 5. CHECK QUEUED CONTENT
SELECT 
  decision_id,
  decision_type,
  created_at,
  scheduled_at,
  LEFT(content, 50) as content_preview,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as age_minutes,
  CASE 
    WHEN scheduled_at IS NOT NULL THEN EXTRACT(EPOCH FROM (NOW() - scheduled_at::timestamp)) / 60
    ELSE NULL
  END as scheduled_minutes_ago
FROM content_metadata
WHERE status = 'queued'
ORDER BY created_at DESC
LIMIT 10;

-- 6. CHECK STUCK POSTS (status='posting' >15min)
SELECT 
  decision_id,
  decision_type,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as stuck_minutes,
  LEFT(content, 50) as content_preview
FROM content_metadata
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '15 minutes'
ORDER BY created_at ASC;

-- 7. CHECK RATE LIMITS (posts in last hour)
SELECT 
  decision_type,
  COUNT(*) as count,
  MAX(posted_at) as latest_post
FROM content_metadata
WHERE status = 'posted'
  AND posted_at >= NOW() - INTERVAL '1 hour'
GROUP BY decision_type;

-- 8. CHECK IF PLAN JOB GENERATED CONTENT RECENTLY
SELECT 
  COUNT(*) as content_generated,
  MAX(created_at) as latest_content,
  EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 3600 as hours_since_generation
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND created_at >= NOW() - INTERVAL '12 hours';

-- 9. CHECK POSTING JOB EXECUTION HISTORY
SELECT 
  job_name,
  last_success,
  last_failure,
  consecutive_failures,
  last_error,
  updated_at
FROM job_heartbeats
WHERE job_name = 'posting';

-- 10. SUMMARY QUERY - ALL KEY METRICS
SELECT 
  'Recent Posts (12h)' as metric,
  COUNT(*)::text as value,
  MAX(posted_at)::text as detail
FROM content_metadata
WHERE status = 'posted' AND posted_at >= NOW() - INTERVAL '12 hours'

UNION ALL

SELECT 
  'Queued Content' as metric,
  COUNT(*)::text as value,
  MAX(created_at)::text as detail
FROM content_metadata
WHERE status = 'queued'

UNION ALL

SELECT 
  'Stuck Posts' as metric,
  COUNT(*)::text as value,
  MAX(created_at)::text as detail
FROM content_metadata
WHERE status = 'posting' AND created_at < NOW() - INTERVAL '15 minutes'

UNION ALL

SELECT 
  'Posting Job Last Success' as metric,
  COALESCE(last_success::text, 'NEVER') as value,
  COALESCE(consecutive_failures::text, '0') as detail
FROM job_heartbeats
WHERE job_name = 'posting'

UNION ALL

SELECT 
  'Plan Job Last Success' as metric,
  COALESCE(last_success::text, 'NEVER') as value,
  COALESCE(consecutive_failures::text, '0') as detail
FROM job_heartbeats
WHERE job_name = 'plan'

UNION ALL

SELECT 
  'Critical Errors (12h)' as metric,
  COUNT(*)::text as value,
  MAX(created_at)::text as detail
FROM system_events
WHERE severity = 'critical' AND created_at >= NOW() - INTERVAL '12 hours';




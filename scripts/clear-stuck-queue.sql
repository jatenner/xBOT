-- Clear stuck queued decisions that are preventing posting
-- Run this directly on Railway or via psql

BEGIN;

-- 1. Show current stuck decisions (scheduled > 1 hour ago, still queued)
SELECT 
  decision_id,
  scheduled_at,
  created_at,
  LEFT(content, 60) as content_preview,
  (NOW() - scheduled_at) as time_overdue
FROM content_metadata
WHERE status = 'queued'
  AND scheduled_at < (NOW() - INTERVAL '1 hour')
ORDER BY scheduled_at ASC;

-- 2. Mark stuck decisions as 'failed' (only if not already posted)
UPDATE content_metadata
SET status = 'failed'
WHERE status = 'queued'
  AND scheduled_at < (NOW() - INTERVAL '1 hour')
  AND decision_id NOT IN (
    SELECT decision_id FROM posted_decisions
  );

-- 3. Show remaining queued decisions
SELECT 
  decision_id,
  scheduled_at,
  (scheduled_at - NOW()) as time_until,
  LEFT(content, 60) as content_preview
FROM content_metadata
WHERE status = 'queued'
ORDER BY scheduled_at ASC
LIMIT 10;

COMMIT;


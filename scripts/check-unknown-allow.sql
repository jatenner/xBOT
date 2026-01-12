-- Check for NEW rows (since deploy) with method='unknown' AND decision='ALLOW'
-- Deploy time: 2026-01-12 15:20 UTC (approximately)
SELECT 
  COUNT(*) as total_unknown_allow,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM reply_decisions
WHERE method = 'unknown'
  AND decision = 'ALLOW'
  AND created_at >= '2026-01-12 15:20:00'::timestamptz;

-- Also show breakdown by status
SELECT 
  status,
  COUNT(*) as count
FROM reply_decisions
WHERE method = 'unknown'
  AND decision = 'ALLOW'
  AND created_at >= '2026-01-12 15:20:00'::timestamptz
GROUP BY status;

-- ═══════════════════════════════════════════════════════════════
-- TRUTH GAP VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════
-- Use these queries to manually verify system health and truth integrity
-- Run against your Supabase database

-- ───────────────────────────────────────────────────────────────
-- CHECK 1: Phantom Posts (posted but no tweet_id)
-- ───────────────────────────────────────────────────────────────
-- These should be ZERO. If found, indicates receipt write failures.

SELECT 
  decision_id,
  decision_type,
  status,
  posted_at,
  tweet_id
FROM content_metadata
WHERE status = 'posted'
  AND tweet_id IS NULL
  AND posted_at >= NOW() - INTERVAL '24 hours'
ORDER BY posted_at DESC;

-- Expected: 0 rows
-- If found: Check postingQueue receipt writing logic


-- ───────────────────────────────────────────────────────────────
-- CHECK 2: Orphan Receipts (receipts without metadata)
-- ───────────────────────────────────────────────────────────────
-- These should reconcile automatically within 10 minutes via Tier-1 recovery

SELECT 
  pr.decision_id,
  pr.root_tweet_id,
  pr.posted_at,
  cm.status,
  cm.tweet_id
FROM post_receipts pr
LEFT JOIN content_metadata cm ON pr.decision_id = cm.decision_id
WHERE pr.posted_at < NOW() - INTERVAL '30 minutes'
  AND (cm.decision_id IS NULL 
       OR cm.status != 'posted' 
       OR cm.tweet_id != pr.root_tweet_id)
ORDER BY pr.posted_at DESC
LIMIT 20;

-- Expected: 0 rows (or very few recent ones)
-- If found: Tier-1 postingRecoveryJob will reconcile within 10 minutes


-- ───────────────────────────────────────────────────────────────
-- CHECK 3: Discovered Tweets (backfilled via Tier-2 profile recovery)
-- ───────────────────────────────────────────────────────────────
-- These indicate tweets that posted but had NO receipt (crash between post and receipt write)

SELECT 
  decision_id,
  tweet_id,
  status,
  posted_at,
  discovered_via_profile
FROM content_metadata
WHERE discovered_via_profile = true
ORDER BY posted_at DESC
LIMIT 20;

-- Expected: Ideally 0, but any found here were successfully recovered by Tier-2
-- If found: System is working correctly - caught tweets with missing receipts


-- ───────────────────────────────────────────────────────────────
-- CHECK 4: Recent Posting Health (last 24 hours)
-- ───────────────────────────────────────────────────────────────
-- Quick overview of posting health

SELECT 
  status,
  decision_type,
  COUNT(*) as count,
  COUNT(CASE WHEN tweet_id IS NOT NULL THEN 1 END) as with_tweet_id,
  COUNT(CASE WHEN discovered_via_profile = true THEN 1 END) as discovered_via_profile
FROM content_metadata
WHERE posted_at >= NOW() - INTERVAL '24 hours'
GROUP BY status, decision_type
ORDER BY count DESC;

-- Expected:
-- - Most rows should be status='posted' with tweet_id present
-- - discovered_via_profile should be 0 or very low
-- - No 'posted' rows without tweet_id


-- ───────────────────────────────────────────────────────────────
-- CHECK 5: Recovery System Status
-- ───────────────────────────────────────────────────────────────
-- Count how many tweets each recovery tier has saved

SELECT 
  'Tier-1 Reconciled' as recovery_tier,
  COUNT(*) as recovered_count
FROM content_metadata
WHERE status = 'posted'
  AND tweet_id IS NOT NULL
  AND decision_id NOT LIKE 'discovered_%'
  AND posted_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'Tier-2 Backfilled' as recovery_tier,
  COUNT(*) as recovered_count
FROM content_metadata
WHERE discovered_via_profile = true
  AND posted_at >= NOW() - INTERVAL '7 days';

-- Expected:
-- - Tier-1 should be majority (normal operation)
-- - Tier-2 should be 0 or very low (only catches crashes)


-- ───────────────────────────────────────────────────────────────
-- CHECK 6: Tweet ID Coverage (all posted tweets should have IDs)
-- ───────────────────────────────────────────────────────────────

SELECT 
  COUNT(*) as total_posted,
  COUNT(tweet_id) as with_tweet_id,
  COUNT(*) - COUNT(tweet_id) as missing_tweet_id,
  ROUND(100.0 * COUNT(tweet_id) / NULLIF(COUNT(*), 0), 2) as coverage_percent
FROM content_metadata
WHERE status = 'posted'
  AND posted_at >= NOW() - INTERVAL '24 hours';

-- Expected: coverage_percent >= 99.5%
-- If lower: Investigation required


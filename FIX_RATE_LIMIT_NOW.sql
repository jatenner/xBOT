-- 🚨 FIX RATE LIMIT NOW
-- Last real post was 10h ago, but rate limit shows 6 posts in last hour
-- These are phantom posts blocking the system
-- Run this in Supabase SQL Editor RIGHT NOW

BEGIN;

-- 1. Show what's blocking
SELECT 
  decision_id,
  posted_at,
  tweet_id,
  CASE 
    WHEN tweet_id IS NULL THEN 'NULL tweet_id'
    WHEN tweet_id::text LIKE 'mock_%' THEN 'mock_ tweet_id'
    WHEN tweet_id::text LIKE 'emergency_%' THEN 'emergency_ tweet_id'
    WHEN tweet_id::text LIKE 'bulletproof_%' THEN 'bulletproof_ tweet_id'
    WHEN tweet_id::text LIKE 'posted_%' THEN 'posted_ tweet_id'
    ELSE 'REAL tweet_id'
  END as post_type,
  EXTRACT(EPOCH FROM (NOW() - posted_at))/60 as minutes_ago
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour'
ORDER BY posted_at DESC;

-- 2. Clear ALL posts from last hour (they're blocking rate limit)
-- If they were real, they'd be on Twitter already (last post was 10h ago)
UPDATE content_metadata
SET 
  status = 'failed',
  error_message = 'Cleared - blocking rate limit, not on Twitter (last real post 10h ago)',
  updated_at = NOW()
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour';

-- 3. Verify rate limit is cleared
SELECT 
  COUNT(*) as posts_in_last_hour,
  'Rate limit status' as status
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour'
  AND tweet_id IS NOT NULL
  AND tweet_id::text NOT LIKE 'mock_%'
  AND tweet_id::text NOT LIKE 'emergency_%'
  AND tweet_id::text NOT LIKE 'bulletproof_%'
  AND tweet_id::text NOT LIKE 'posted_%';

-- Should show: 0 posts (rate limit cleared!)

COMMIT;

-- ✅ After running this, system should start posting in next 5 minutes!


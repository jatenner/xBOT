-- 🔧 FIX RATE LIMIT BLOCKER
-- Clears phantom posts that are blocking the rate limit
-- Run this on Railway or via Supabase SQL editor

BEGIN;

-- 1. Show current rate limit status
SELECT 
  COUNT(*) as posts_in_last_hour,
  COUNT(*) FILTER (WHERE tweet_id IS NOT NULL 
    AND tweet_id NOT LIKE 'mock_%' 
    AND tweet_id NOT LIKE 'emergency_%' 
    AND tweet_id NOT LIKE 'bulletproof_%'
    AND tweet_id NOT LIKE 'posted_%') as real_posts
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour';

-- 2. Mark phantom posts as failed (they're blocking the rate limit)
UPDATE content_metadata
SET 
  status = 'failed',
  error_message = 'Phantom post cleared - no real tweet_id',
  updated_at = NOW()
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour'
  AND (
    tweet_id IS NULL
    OR tweet_id LIKE 'mock_%'
    OR tweet_id LIKE 'emergency_%'
    OR tweet_id LIKE 'bulletproof_%'
    OR tweet_id LIKE 'posted_%'
  );

-- 3. Show remaining real posts
SELECT 
  COUNT(*) as real_posts_remaining,
  decision_id,
  tweet_id,
  posted_at
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
  AND posted_at > NOW() - INTERVAL '1 hour'
  AND tweet_id IS NOT NULL
  AND tweet_id NOT LIKE 'mock_%'
  AND tweet_id NOT LIKE 'emergency_%'
  AND tweet_id NOT LIKE 'bulletproof_%'
  AND tweet_id NOT LIKE 'posted_%'
GROUP BY decision_id, tweet_id, posted_at
ORDER BY posted_at DESC;

-- 4. Reset any stuck posts back to queued
UPDATE content_metadata
SET 
  status = 'queued',
  updated_at = NOW()
WHERE status = 'posting'
  AND created_at < NOW() - INTERVAL '15 minutes';

COMMIT;


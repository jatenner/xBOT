-- =====================================================================================
-- 🔍 FIND LATEST 2 POSTS (SINGLES/THREADS) - NOT REPLIES
-- Run this in Supabase SQL Editor
-- =====================================================================================

-- Latest 2 POSTS (singles/threads)
SELECT 
  decision_id,
  decision_type,
  status,
  LEFT(content, 100) as content_preview,
  posted_at,
  created_at,
  tweet_id,
  actual_impressions,
  actual_likes,
  target_tweet_id,
  target_username
FROM content_metadata
WHERE decision_type IN ('single', 'thread')
  AND status = 'posted'
ORDER BY COALESCE(posted_at, created_at) DESC
LIMIT 2;

-- =====================================================================================
-- 📊 COUNT BY TYPE (to see if all are replies)
-- =====================================================================================

SELECT 
  decision_type,
  status,
  COUNT(*) as count,
  MAX(COALESCE(posted_at, created_at)) as latest_post
FROM content_metadata
WHERE status = 'posted'
GROUP BY decision_type, status
ORDER BY decision_type, status;

-- =====================================================================================
-- 🔍 LATEST 10 ITEMS OVERALL (to see what's actually in DB)
-- =====================================================================================

SELECT 
  decision_id,
  decision_type,
  status,
  LEFT(content, 80) as content_preview,
  posted_at,
  created_at,
  tweet_id,
  target_tweet_id,
  target_username
FROM content_metadata
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================================================
-- 🚨 CHECK FOR DATA CORRUPTION
-- =====================================================================================

-- Singles/threads with target_tweet_id (shouldn't have)
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
LIMIT 10;

-- Replies without target_tweet_id (should have)
SELECT 
  decision_id,
  decision_type,
  status,
  target_tweet_id,
  created_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND (target_tweet_id IS NULL OR target_tweet_id = '')
ORDER BY created_at DESC
LIMIT 10;




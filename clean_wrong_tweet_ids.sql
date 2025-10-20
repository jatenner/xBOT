-- 🧹 CLEAN WRONG TWEET IDS
-- Remove tweet IDs that were incorrectly captured from other accounts

-- This tweet ID is from @Maga_Trigger (political account), NOT from @Signal_Synapse
-- It was incorrectly captured because the old system grabbed the first article without verification

-- STEP 1: Check what data exists for this wrong ID
SELECT 
  'content_metadata' as table_name,
  id,
  tweet_id,
  created_at,
  status
FROM content_metadata
WHERE tweet_id = '1979987035063771345'
UNION ALL
SELECT 
  'outcomes' as table_name,
  decision_id::text as id,
  tweet_id,
  collected_at as created_at,
  likes::text as status
FROM outcomes
WHERE tweet_id = '1979987035063771345'
UNION ALL
SELECT 
  'learning_posts' as table_name,
  id::text,
  tweet_id,
  created_at,
  likes_count::text as status
FROM learning_posts
WHERE tweet_id = '1979987035063771345'
UNION ALL
SELECT 
  'tweet_metrics' as table_name,
  id::text,
  tweet_id,
  created_at,
  likes_count::text as status
FROM tweet_metrics
WHERE tweet_id = '1979987035063771345';

-- STEP 2: Delete from all tables (ONLY if verified this is NOT your tweet!)
-- Uncomment these lines to actually delete:

-- DELETE FROM outcomes WHERE tweet_id = '1979987035063771345';
-- DELETE FROM learning_posts WHERE tweet_id = '1979987035063771345';
-- DELETE FROM tweet_metrics WHERE tweet_id = '1979987035063771345';

-- For content_metadata, set tweet_id to NULL instead of deleting (preserve the decision)
-- UPDATE content_metadata 
-- SET tweet_id = NULL, 
--     status = 'posted_failed_id_capture',
--     updated_at = NOW()
-- WHERE tweet_id = '1979987035063771345';

-- STEP 3: Find any other tweets with suspiciously high engagement (likely wrong IDs)
SELECT 
  cm.id,
  cm.tweet_id,
  cm.created_at,
  o.likes,
  o.retweets,
  o.replies,
  o.views
FROM content_metadata cm
LEFT JOIN outcomes o ON cm.id = o.decision_id
WHERE cm.status = 'posted'
  AND cm.tweet_id IS NOT NULL
  AND (
    o.likes > 100 OR    -- You don't have tweets with 100+ likes yet
    o.retweets > 50 OR  -- You don't have tweets with 50+ retweets yet
    o.views > 10000     -- You don't have tweets with 10k+ views yet
  )
ORDER BY o.likes DESC, o.retweets DESC;

-- Expected result: Should show the Maga_Trigger tweet and any other wrong IDs


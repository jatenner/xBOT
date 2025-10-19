-- Clean database of tweets from wrong accounts
-- Run this in Supabase SQL Editor

-- First, check what tweets we have
SELECT 
  id,
  tweet_id,
  status,
  created_at
FROM content_metadata
WHERE status = 'posted'
  AND tweet_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- If any tweet IDs don't belong to YOUR account, delete them:
-- DELETE FROM content_metadata WHERE tweet_id IN ('1979325294977626115', '1979333054637252995');

-- Also clean from other tables:
-- DELETE FROM outcomes WHERE tweet_id IN ('1979325294977626115', '1979333054637252995');
-- DELETE FROM learning_posts WHERE tweet_id IN ('1979325294977626115', '1979333054637252995');
-- DELETE FROM tweet_metrics WHERE tweet_id IN ('1979325294977626115', '1979333054637252995');
-- DELETE FROM real_tweet_metrics WHERE tweet_id IN ('1979325294977626115', '1979333054637252995');
-- DELETE FROM post_velocity_tracking WHERE tweet_id IN ('1979325294977626115', '1979333054637252995');


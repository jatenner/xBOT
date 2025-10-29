-- =====================================================================================
-- CLEAN UP BAD REPLY METRICS
-- Problem: Replies have tweet_id = target_tweet_id (parent ID stored instead of reply ID)
-- Result: Metrics show parent tweet's engagement, not reply's actual performance
-- =====================================================================================

BEGIN;

-- Show affected replies
SELECT 
  decision_id,
  target_username,
  content,
  tweet_id,
  target_tweet_id,
  actual_likes,
  actual_impressions,
  posted_at
FROM content_metadata
WHERE decision_type = 'reply'
  AND tweet_id = target_tweet_id
  AND tweet_id IS NOT NULL
ORDER BY actual_likes DESC
LIMIT 10;

-- Clear metrics for replies where tweet_id = target_tweet_id (BUG!)
UPDATE content_metadata
SET 
  actual_likes = NULL,
  actual_impressions = NULL,
  actual_retweets = NULL,
  actual_replies = NULL,
  actual_engagement_rate = NULL
WHERE decision_type = 'reply'
  AND tweet_id = target_tweet_id
  AND tweet_id IS NOT NULL;

-- Report
SELECT 
  COUNT(*) as replies_cleaned,
  'Metrics cleared - will be re-scraped with correct IDs' as status
FROM content_metadata
WHERE decision_type = 'reply'
  AND tweet_id = target_tweet_id
  AND tweet_id IS NOT NULL;

COMMIT;

-- =====================================================================================
-- VERIFICATION
-- =====================================================================================

-- Check no more replies have tweet_id = target_tweet_id with metrics
SELECT COUNT(*) as should_be_zero
FROM content_metadata
WHERE decision_type = 'reply'
  AND tweet_id = target_tweet_id
  AND actual_likes IS NOT NULL;

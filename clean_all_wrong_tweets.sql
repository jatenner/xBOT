-- 🧹 CLEAN ALL WRONG TWEET IDs
-- This removes all tweets with wrong IDs (from @BestInDogs etc.)
-- Keeps the schema intact, just deletes the data

-- Delete from all tweet-related tables
DELETE FROM real_tweet_metrics WHERE tweet_id IS NOT NULL;
DELETE FROM content_decisions WHERE id IS NOT NULL;
DELETE FROM tweets WHERE id IS NOT NULL;
DELETE FROM engagement_history WHERE id IS NOT NULL;
DELETE FROM velocity_tracking WHERE id IS NOT NULL;

-- Verification queries
SELECT 'tweets' as table_name, COUNT(*) as remaining_records FROM tweets
UNION ALL
SELECT 'real_tweet_metrics', COUNT(*) FROM real_tweet_metrics
UNION ALL
SELECT 'content_decisions', COUNT(*) FROM content_decisions
UNION ALL
SELECT 'engagement_history', COUNT(*) FROM engagement_history
UNION ALL
SELECT 'velocity_tracking', COUNT(*) FROM velocity_tracking;


-- Cleanup fake test tweet IDs from reply_candidate_queue
-- Run via: railway run -s xBOT -- psql $DATABASE_URL -f sql/cleanup_fake_candidates.sql

-- Delete fake test IDs (pattern: 2000000000000* or specific test ID)
DELETE FROM reply_candidate_queue
WHERE candidate_tweet_id::text LIKE '2000000000000%'
   OR candidate_tweet_id::text = '2000000000000000003';

-- Show count of remaining candidates
SELECT COUNT(*) as remaining_candidates
FROM reply_candidate_queue
WHERE created_at >= NOW() - INTERVAL '24 hours';

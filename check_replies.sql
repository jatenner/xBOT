-- Check queued replies waiting to post
SELECT 
  decision_id,
  content,
  target_username,
  target_tweet_id,
  status,
  scheduled_at,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - scheduled_at::timestamp))/60 as minutes_overdue
FROM content_metadata
WHERE decision_type = 'reply'
  AND status IN ('queued', 'posted', 'failed')
ORDER BY created_at DESC
LIMIT 10;

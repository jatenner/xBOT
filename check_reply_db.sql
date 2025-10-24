-- Check reply opportunities
SELECT COUNT(*) as opportunity_count, status 
FROM reply_opportunities 
GROUP BY status;

-- Check recent reply content in queue
SELECT decision_id, content, target_username, status, created_at, scheduled_at
FROM content_metadata
WHERE decision_type = 'reply'
ORDER BY created_at DESC
LIMIT 10;

-- Check if any replies were posted
SELECT COUNT(*) as posted_replies
FROM content_metadata
WHERE decision_type = 'reply' AND posted_at IS NOT NULL;

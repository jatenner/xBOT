SELECT decision_id, decision_type, status, scheduled_at, created_at 
FROM content_metadata 
WHERE status = 'queued' 
AND decision_type IN ('single', 'thread') 
ORDER BY scheduled_at ASC 
LIMIT 10;

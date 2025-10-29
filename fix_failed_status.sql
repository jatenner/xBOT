-- Fix posts that are marked as 'failed' but actually posted successfully
-- These have status='failed' but have a posted_at timestamp

UPDATE content_metadata
SET 
  status = 'posted',
  updated_at = NOW()
WHERE 
  status = 'failed'
  AND posted_at IS NOT NULL
  AND tweet_id IS NOT NULL;

-- Show results
SELECT 
  content,
  status,
  posted_at,
  created_at
FROM content_metadata
WHERE 
  posted_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;


-- Clear all old fallback content from database
-- This content has "Most people think X, but research shows Y" in it

DELETE FROM content_metadata 
WHERE content LIKE '%Most people think X, but research shows Y%'
  AND status IN ('queued', 'scheduled');

-- Show how many were deleted
SELECT 'Deleted old fallback content' AS message;


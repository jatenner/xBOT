-- Add unique constraint to tweet_id column to prevent duplicate tweet IDs
-- This ensures one tweet_id can only appear once in content_metadata

-- First, verify no duplicates exist (should be clean after cleanup script)
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO dup_count
  FROM (
    SELECT tweet_id, COUNT(*) as cnt
    FROM content_metadata
    WHERE tweet_id IS NOT NULL
    GROUP BY tweet_id
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot add unique constraint: % duplicate tweet_ids still exist. Run cleanup first!', dup_count;
  END IF;
END $$;

-- Add unique constraint
ALTER TABLE content_metadata
ADD CONSTRAINT content_metadata_tweet_id_unique UNIQUE (tweet_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT content_metadata_tweet_id_unique ON content_metadata IS 
'Ensures each tweet_id is unique - prevents corruption where same tweet is saved as both post and reply';


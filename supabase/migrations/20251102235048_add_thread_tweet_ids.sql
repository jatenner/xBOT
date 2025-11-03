-- Add column to store all tweet IDs for threads
-- This enables tracking individual tweet metrics within a thread

ALTER TABLE content_metadata
ADD COLUMN IF NOT EXISTS thread_tweet_ids TEXT;

COMMENT ON COLUMN content_metadata.thread_tweet_ids IS 'JSON array of all tweet IDs in a thread (null for single tweets)';

-- Create index for querying threads with tweet IDs
CREATE INDEX IF NOT EXISTS idx_content_metadata_thread_tweet_ids 
ON content_metadata(thread_tweet_ids) 
WHERE thread_tweet_ids IS NOT NULL;

-- Add thread_tweets column for proper thread storage
-- This allows us to store individual tweets in a thread as separate items

ALTER TABLE content_metadata 
ADD COLUMN IF NOT EXISTS thread_tweets JSONB DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN content_metadata.thread_tweets IS 'Array of individual tweet strings for threads (e.g. ["tweet1", "tweet2", "tweet3"])';

-- Add index for thread queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_thread_tweets ON content_metadata((thread_tweets IS NOT NULL));


-- Add performance tracking columns to tweets table
-- Run this in your Supabase SQL editor

-- Add performance_log column for storing historical metrics
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS performance_log JSONB DEFAULT '[]';

-- Add last_performance_update timestamp
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS last_performance_update TIMESTAMP WITH TIME ZONE;

-- Add index for performance queries
CREATE INDEX IF NOT EXISTS idx_tweets_last_performance_update 
ON tweets(last_performance_update);

-- Add index for created_at queries
CREATE INDEX IF NOT EXISTS idx_tweets_created_at_success 
ON tweets(created_at, success);

-- Comment on new columns
COMMENT ON COLUMN tweets.performance_log IS 'Array of performance metrics over time: [{"t": timestamp, "likes": number, "retweets": number, "replies": number}]';
COMMENT ON COLUMN tweets.last_performance_update IS 'Timestamp of last performance metrics update';

-- Example performance_log structure:
-- [
--   {"t": 1706380800000, "likes": 5, "retweets": 2, "replies": 1},
--   {"t": 1706384400000, "likes": 8, "retweets": 3, "replies": 2},
--   {"t": 1706388000000, "likes": 12, "retweets": 5, "replies": 3}
-- ]

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
AND column_name IN ('performance_log', 'last_performance_update'); 
-- Check what tables and columns actually exist
-- Run this first to see the current schema

-- Check tweet_analytics table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tweet_analytics'
ORDER BY ordinal_position;
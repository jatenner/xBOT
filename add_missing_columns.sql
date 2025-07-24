-- Fix missing columns in database
-- Run this in Supabase SQL Editor

-- Fix content_uniqueness table
ALTER TABLE content_uniqueness ADD COLUMN IF NOT EXISTS content_keywords TEXT[] DEFAULT '{}';
ALTER TABLE content_uniqueness ADD COLUMN IF NOT EXISTS content_topic TEXT DEFAULT '';

-- Fix tweet_ids column type issue  
ALTER TABLE content_uniqueness ALTER COLUMN tweet_ids TYPE BIGINT[] USING tweet_ids::BIGINT[];

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_uniqueness' 
AND column_name IN ('content_keywords', 'tweet_ids', 'content_topic');

SELECT 'All missing columns added successfully!' as status; 
-- 🔍 CHECK CURRENT DATABASE STRUCTURE AND DATA
-- This will work with whatever columns actually exist

-- First, check what columns exist in the tweets table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position;

-- Check recent tweets with existing columns
SELECT 
  tweet_id,
  content,
  created_at,
  CASE 
    WHEN LENGTH(content) > 50 THEN SUBSTRING(content, 1, 50) || '...'
    ELSE content
  END as short_content
FROM tweets 
ORDER BY created_at DESC 
LIMIT 10;

-- Check if tweet_metrics table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'tweet_metrics'
) as tweet_metrics_exists;

-- If tweet_metrics exists, show its structure
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'tweet_metrics' 
ORDER BY ordinal_position; 
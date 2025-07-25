-- COMPREHENSIVE DATABASE SCHEMA ANALYSIS

-- 1. Check tweets table structure in detail
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'tweets' 
ORDER BY ordinal_position;

-- 2. Check content_uniqueness table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'content_uniqueness' 
ORDER BY ordinal_position;

-- 3. Check table constraints
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('tweets', 'content_uniqueness')
ORDER BY tc.table_name, tc.constraint_type;

-- 4. Check current data in tweets table
SELECT 
  COUNT(*) as total_tweets,
  MIN(created_at) as oldest_tweet,
  MAX(created_at) as newest_tweet
FROM tweets;

-- 5. Sample a few tweets to see structure
SELECT 
  tweet_id,
  LENGTH(content) as content_length,
  tweet_type,
  content_type,
  viral_score,
  ai_optimized,
  created_at
FROM tweets 
ORDER BY created_at DESC 
LIMIT 3;

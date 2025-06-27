-- VERIFICATION QUERIES - Run after SIMPLE_FIX.sql
-- Copy and paste this into Supabase SQL Editor to verify tables were created

-- Step 1: Check if all tables exist and have data
SELECT 'tweet_topics' as table_name, COUNT(*) as row_count FROM tweet_topics
UNION ALL
SELECT 'tweet_images' as table_name, COUNT(*) as row_count FROM tweet_images  
UNION ALL
SELECT 'bot_config' as table_name, COUNT(*) as row_count FROM bot_config;

-- Step 2: Show sample data from each table
SELECT 'Sample tweet_topics:' as info;
SELECT topic_name, category, priority_score FROM tweet_topics LIMIT 3;

SELECT 'Sample bot_config:' as info;
SELECT key, value FROM bot_config LIMIT 3;

-- Step 3: Test that structure is correct
SELECT 'tweet_topics structure test:' as info;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'tweet_topics' 
ORDER BY ordinal_position;

-- If you see results above, all tables are working correctly! 
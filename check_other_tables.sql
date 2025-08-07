-- Check other important tables for missing columns
-- Run these queries one by one in Supabase

-- 1. Check post_history table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'post_history'
ORDER BY ordinal_position;

-- 2. Check tweets table structure  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tweets'
ORDER BY ordinal_position;

-- 3. Check bot_config table structure (we already know this one)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'bot_config'
ORDER BY ordinal_position;

-- 4. List all tables to see what else exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
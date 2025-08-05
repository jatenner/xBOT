-- Diagnose the tweets table structure issue
-- Run this first to see what we're working with

-- 1. Check if tweets table exists at all
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tweets') 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as tweets_table_status;

-- 2. If tweets table exists, show its structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Show all existing tables so we know what we have
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 4. Check for any tweet-related tables with different names
SELECT 
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%tweet%'
ORDER BY table_name;
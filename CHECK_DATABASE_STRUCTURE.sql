-- Quick database structure check
-- Run this in Supabase to see what tables exist and their structure

-- 1. List all tables
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Check tweets table structure specifically
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets'
ORDER BY ordinal_position;

-- 3. Check if other core tables exist
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t.table_name) 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status
FROM (
    VALUES 
        ('tweets'),
        ('tweet_analytics'), 
        ('follower_tracking'),
        ('engagement_history'),
        ('system_health_monitoring'),
        ('emergency_posting_log')
) AS t(table_name);
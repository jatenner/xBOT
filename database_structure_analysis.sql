-- ===================================================================
-- 📊 COMPLETE DATABASE STRUCTURE ANALYSIS
-- ===================================================================
-- Let's understand EXACTLY what we have before making any changes
-- ===================================================================

-- 1. Check what tables exist
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. Get COMPLETE structure of learning_posts table
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'learning_posts'
ORDER BY ordinal_position;

-- 3. Get COMPLETE structure of tweets table  
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets'
ORDER BY ordinal_position;

-- 4. Check what indexes exist
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('learning_posts', 'tweets')
ORDER BY tablename, indexname;

-- 5. Check table constraints
SELECT 
    table_name,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name IN ('learning_posts', 'tweets')
ORDER BY table_name, constraint_name;

-- 6. Sample data from learning_posts (last 3 rows)
SELECT * FROM learning_posts 
ORDER BY created_at DESC 
LIMIT 3;

-- 7. Sample data from tweets (last 3 rows)
SELECT * FROM tweets 
ORDER BY created_at DESC 
LIMIT 3;
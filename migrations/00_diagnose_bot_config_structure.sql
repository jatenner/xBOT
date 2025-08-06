-- DIAGNOSTIC: Analyze current bot_config table structure
-- This will show us exactly what we're working with before making changes

-- Check if bot_config table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_config') 
        THEN 'TABLE EXISTS' 
        ELSE 'TABLE DOES NOT EXIST' 
    END as table_status;

-- If table exists, show its complete structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default,
    CASE 
        WHEN is_nullable = 'NO' THEN 'NOT NULL'
        ELSE 'NULLABLE'
    END as null_constraint
FROM information_schema.columns 
WHERE table_name = 'bot_config'
ORDER BY ordinal_position;

-- Show any constraints on the table
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'bot_config';

-- Show current data in the table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_config') THEN
        RAISE NOTICE 'bot_config table contents:';
        -- Note: We can't dynamically execute SELECT in a DO block easily
        -- So this will just confirm the table exists
        RAISE NOTICE 'Table exists - check manually with: SELECT * FROM bot_config;';
    ELSE
        RAISE NOTICE 'bot_config table does not exist';
    END IF;
END $$;
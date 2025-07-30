-- 🎯 FOCUSED CONSTRAINT CHECK
-- Get the essential info we need to fix the SQL

-- 1. Check what columns are NOT NULL in contextual_bandit_arms
SELECT 
    'contextual_bandit_arms NOT NULL columns:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'contextual_bandit_arms'
ORDER BY ordinal_position;

-- 2. Check for any check constraints on contextual_bandit_arms
SELECT 
    'contextual_bandit_arms check constraints:' as info,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name IN (
    SELECT constraint_name 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'contextual_bandit_arms'
);

-- 3. Try a simple test insert to see what exactly fails
DELETE FROM contextual_bandit_arms WHERE arm_name = 'test_insert';
INSERT INTO contextual_bandit_arms (arm_name, arm_type) VALUES ('test_insert', 'test_type');

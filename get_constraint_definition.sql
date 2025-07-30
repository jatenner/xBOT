-- 🔍 GET EXACT CHECK CONSTRAINT DEFINITION
-- Simple query to see what values are allowed

-- Get the check constraint definition
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%contextual_bandit_arms%';

-- Also check what values currently exist in the table
SELECT DISTINCT arm_type FROM contextual_bandit_arms;

-- Get all constraint info for this table
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'contextual_bandit_arms';

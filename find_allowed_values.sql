-- 🔍 FIND ALLOWED VALUES FOR arm_type
-- Let's see what the check constraint actually allows

-- 1. Get the exact check constraint definition
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'contextual_bandit_arms_arm_type_check';

-- 2. See if arm_type uses a custom ENUM type
SELECT 
    column_name,
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'contextual_bandit_arms' 
  AND column_name = 'arm_type';

-- 3. If it's an ENUM, get the allowed values
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as allowed_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname = (
    SELECT udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'contextual_bandit_arms' 
      AND column_name = 'arm_type'
)
GROUP BY t.typname;

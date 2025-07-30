-- 🔍 CHECK ALL CONSTRAINTS
-- Find out exactly what constraints are causing the failures

-- Check constraints on contextual_bandit_arms
SELECT 
    'contextual_bandit_arms constraints:' as info,
    constraint_name,
    constraint_type,
    check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.constraint_column_usage ccu 
    ON cc.constraint_name = ccu.constraint_name
WHERE ccu.table_name = 'contextual_bandit_arms';

-- Check NOT NULL constraints
SELECT 
    'contextual_bandit_arms NOT NULL columns:' as info,
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'contextual_bandit_arms'
  AND is_nullable = 'NO';

-- Check enhanced_timing_stats NOT NULL columns  
SELECT 
    'enhanced_timing_stats NOT NULL columns:' as info,
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'enhanced_timing_stats'
  AND is_nullable = 'NO';

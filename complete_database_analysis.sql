-- 🔍 COMPLETE DATABASE ANALYSIS
-- Get EVERYTHING we need to understand why SQL keeps failing

-- 1. Get ALL constraints on contextual_bandit_arms
SELECT 
    'CONSTRAINT DETAILS:' as section,
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'contextual_bandit_arms'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 2. Get ALL column details for contextual_bandit_arms
SELECT 
    'COLUMN DETAILS:' as section,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    ordinal_position
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'contextual_bandit_arms'
ORDER BY ordinal_position;

-- 3. Check if there are any existing rows that might give us clues
SELECT 'EXISTING DATA SAMPLE:' as section;
SELECT COUNT(*) as row_count FROM contextual_bandit_arms;

-- 4. Try to see what's in the table (if anything)
SELECT * FROM contextual_bandit_arms LIMIT 3;

-- 5. Get the same info for enhanced_timing_stats
SELECT 
    'TIMING STATS CONSTRAINTS:' as section,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'enhanced_timing_stats'
ORDER BY tc.constraint_type;

-- 6. Check for any ENUM types or custom types
SELECT 
    'CUSTOM TYPES:' as section,
    t.typname,
    t.typtype,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
LEFT JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typtype = 'e'
GROUP BY t.typname, t.typtype;

-- 7. Check if there are triggers that might be interfering
SELECT 
    'TRIGGERS:' as section,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('contextual_bandit_arms', 'enhanced_timing_stats');

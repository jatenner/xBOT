-- 🔍 GET EXACT COLUMN NAMES
-- Get the specific column names for contextual_bandit_arms and enhanced_timing_stats

-- contextual_bandit_arms columns (12 columns)
SELECT 
    'contextual_bandit_arms' as table_name,
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'contextual_bandit_arms'
ORDER BY ordinal_position;

-- enhanced_timing_stats columns (15 columns)  
SELECT 
    'enhanced_timing_stats' as table_name,
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'enhanced_timing_stats'
ORDER BY ordinal_position;

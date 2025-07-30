-- ===================================================================
-- 🔧 SURGICAL FIX - learning_posts table missing columns only
-- ===================================================================
-- Based on your exact database structure analysis
-- Only fixes the specific columns causing errors in logs
-- ===================================================================

-- Step 1: Add missing columns to learning_posts table (from log errors)
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS has_call_to_action BOOLEAN DEFAULT FALSE;
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS posting_day_of_week INTEGER;
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS bandit_confidence REAL DEFAULT 0.5;

-- Step 2: Simple schema cache refresh
COMMENT ON TABLE learning_posts IS 'Updated: added has_call_to_action, posting_day_of_week, bandit_confidence';

-- Step 3: Verify the new columns exist
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'learning_posts' 
  AND column_name IN ('has_call_to_action', 'posting_day_of_week', 'bandit_confidence')
ORDER BY column_name;

-- Success message
SELECT 
    'learning_posts missing columns fixed!' as status,
    'has_call_to_action, posting_day_of_week, bandit_confidence added' as details,
    NOW() as fixed_at;
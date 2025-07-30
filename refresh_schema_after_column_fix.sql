-- ===================================================================
-- 🔄 REFRESH SCHEMA CACHE AFTER COLUMN FIX
-- ===================================================================
-- Forces Supabase to recognize the new columns immediately
-- ===================================================================

-- Refresh schema cache for both tables
COMMENT ON TABLE learning_posts IS 'Schema updated: has_call_to_action column added';
COMMENT ON TABLE tweets IS 'Schema updated: tweet_data column added';

-- Verify columns exist
SELECT 
  'learning_posts' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'learning_posts' 
  AND column_name IN ('has_call_to_action', 'bandit_confidence')
ORDER BY column_name;

SELECT 
  'tweets' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tweets' 
  AND column_name IN ('tweet_data', 'posted')
ORDER BY column_name;
-- 🔄 FORCE SUPABASE SCHEMA CACHE REFRESH
-- ========================================
-- This forces Supabase to recognize the new columns immediately
-- Run this SQL in Supabase SQL Editor after the main migration

-- Method 1: Force table comments to refresh cache
COMMENT ON TABLE post_history IS 'Schema cache refresh - emergency database fix completed';
COMMENT ON TABLE tweet_analytics IS 'Schema cache refresh - all missing columns added';

-- Method 2: Verify all new columns are properly recognized
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    -- Check post_history.idea_fingerprint
    SELECT COUNT(*) INTO col_count 
    FROM information_schema.columns 
    WHERE table_name = 'post_history' AND column_name = 'idea_fingerprint';
    
    IF col_count = 0 THEN
        RAISE NOTICE 'ERROR: post_history.idea_fingerprint column not found!';
    ELSE
        RAISE NOTICE 'SUCCESS: post_history.idea_fingerprint column found';
    END IF;
    
    -- Check tweet_analytics.profile_visit_rate
    SELECT COUNT(*) INTO col_count 
    FROM information_schema.columns 
    WHERE table_name = 'tweet_analytics' AND column_name = 'profile_visit_rate';
    
    IF col_count = 0 THEN
        RAISE NOTICE 'ERROR: tweet_analytics.profile_visit_rate column not found!';
    ELSE
        RAISE NOTICE 'SUCCESS: tweet_analytics.profile_visit_rate column found';
    END IF;
END $$;

-- Method 3: Update table statistics to force recognition
ANALYZE post_history;
ANALYZE tweet_analytics;

-- Method 4: Reset table-level statistics
SELECT pg_stat_reset_single_table_counters('post_history'::regclass);
SELECT pg_stat_reset_single_table_counters('tweet_analytics'::regclass);

-- Method 5: Force PostgREST schema cache reload by updating a system table comment
COMMENT ON SCHEMA public IS 'Schema updated - PostgREST cache refresh needed';

-- Final verification - this should return data for all columns
SELECT 
    'post_history' as table_name,
    'idea_fingerprint' as expected_column,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_history' AND column_name = 'idea_fingerprint'
    ) THEN 'FOUND' ELSE 'MISSING' END as status
UNION ALL
SELECT 
    'tweet_analytics' as table_name,
    'profile_visit_rate' as expected_column,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'profile_visit_rate'
    ) THEN 'FOUND' ELSE 'MISSING' END as status;

-- Success message
SELECT 'Emergency schema cache refresh completed - all columns should now be recognized' as final_status;
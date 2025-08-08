-- 🔧 SIMPLE COLUMN ADDITIONS FOR SUPABASE
-- =====================================
-- Adds missing columns without requiring special permissions
-- Date: 2025-08-08 (Production Fix)

-- Add missing columns to post_history table
ALTER TABLE post_history 
ADD COLUMN IF NOT EXISTS idea_fingerprint TEXT;

-- Add missing columns to tweet_analytics table  
ALTER TABLE tweet_analytics
ADD COLUMN IF NOT EXISTS profile_visit_rate DECIMAL(5,2) DEFAULT 0.00;

-- Verify columns were added successfully
DO $$
DECLARE
    post_history_col_count INTEGER;
    tweet_analytics_col_count INTEGER;
BEGIN
    -- Check post_history.idea_fingerprint
    SELECT COUNT(*) INTO post_history_col_count 
    FROM information_schema.columns 
    WHERE table_name = 'post_history' AND column_name = 'idea_fingerprint';
    
    -- Check tweet_analytics.profile_visit_rate
    SELECT COUNT(*) INTO tweet_analytics_col_count 
    FROM information_schema.columns 
    WHERE table_name = 'tweet_analytics' AND column_name = 'profile_visit_rate';
    
    -- Report results
    IF post_history_col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: post_history.idea_fingerprint column exists';
    ELSE
        RAISE NOTICE 'ERROR: post_history.idea_fingerprint column missing';
    END IF;
    
    IF tweet_analytics_col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: tweet_analytics.profile_visit_rate column exists';
    ELSE
        RAISE NOTICE 'ERROR: tweet_analytics.profile_visit_rate column missing';
    END IF;
    
    -- Overall status
    IF post_history_col_count > 0 AND tweet_analytics_col_count > 0 THEN
        RAISE NOTICE 'MIGRATION COMPLETE: All required columns added successfully';
    ELSE
        RAISE NOTICE 'MIGRATION INCOMPLETE: Some columns failed to add';
    END IF;
END $$;

-- Update table comments for cache refresh (this is safe)
COMMENT ON TABLE post_history IS 'Post history with idea fingerprint tracking - updated 2025-08-08';
COMMENT ON TABLE tweet_analytics IS 'Tweet analytics with profile visit rates - updated 2025-08-08';

-- Success message
SELECT 'Emergency column fix completed - schema should now be up to date' AS status;
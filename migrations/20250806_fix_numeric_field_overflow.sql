-- 🔧 FIX NUMERIC FIELD OVERFLOW ISSUES
-- ====================================
-- Increase precision for numeric fields that are overflowing
-- Current: NUMERIC(8,4) can only store up to 9999.9999
-- Fix: Increase to NUMERIC(12,4) to handle millions

-- Fix engagement metrics columns
ALTER TABLE tweet_analytics 
ALTER COLUMN engagement_rate TYPE NUMERIC(12,4),
ALTER COLUMN viral_coefficient TYPE NUMERIC(12,4),
ALTER COLUMN reach_efficiency TYPE NUMERIC(12,4),
ALTER COLUMN conversion_rate TYPE NUMERIC(12,4);

-- Fix any other numeric columns that might overflow
ALTER TABLE engagement_history
ALTER COLUMN engagement_rate TYPE NUMERIC(12,4);

-- Fix performance metrics if they exist
DO $$
BEGIN
    -- Check if columns exist before altering them
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'success_prediction') THEN
        ALTER TABLE tweet_analytics ALTER COLUMN success_prediction TYPE NUMERIC(12,4);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_analytics' AND column_name = 'click_through_rate') THEN
        ALTER TABLE tweet_analytics ALTER COLUMN click_through_rate TYPE NUMERIC(12,4);
    END IF;
END $$;

-- Show what was fixed
SELECT 'Numeric field overflow issues fixed - increased precision to NUMERIC(12,4)' as status;
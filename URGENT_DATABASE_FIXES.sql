-- 🚨 URGENT DATABASE FIXES
-- Apply these immediately to fix remaining errors

-- 1. Add missing call_to_action column to viral_content_usage
ALTER TABLE viral_content_usage ADD COLUMN IF NOT EXISTS call_to_action VARCHAR(255);

-- 2. Fix remaining numeric overflow columns that weren't covered
-- These are the ones still showing "numeric field overflow" in logs
DO $$
DECLARE
    col_record RECORD;
BEGIN
    -- Fix any remaining NUMERIC(8,4) columns that are causing overflow
    FOR col_record IN 
        SELECT column_name, table_name
        FROM information_schema.columns 
        WHERE numeric_precision = 8 AND numeric_scale = 4
        AND table_name IN ('tweet_analytics', 'engagement_history', 'engagement_metrics')
    LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC(12,4)', 
                      col_record.table_name, col_record.column_name);
        RAISE NOTICE 'Fixed column %.% - changed to NUMERIC(12,4)', 
                     col_record.table_name, col_record.column_name;
    END LOOP;
END $$;

-- 3. Verify our viral content tables are working
SELECT 'Viral content templates count: ' || COUNT(*) as status FROM viral_content_templates;
SELECT 'Viral content usage table exists: ' || (CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'viral_content_usage'
) THEN 'YES' ELSE 'NO' END) as status;

-- 4. Show which columns were fixed
SELECT 
    table_name, 
    column_name, 
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns 
WHERE table_name IN ('tweet_analytics', 'viral_content_usage')
AND (numeric_precision = 12 OR column_name = 'call_to_action')
ORDER BY table_name, column_name;
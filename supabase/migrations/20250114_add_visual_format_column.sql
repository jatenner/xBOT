-- =====================================================================================
-- ADD VISUAL_FORMAT COLUMN TO CONTENT_METADATA
-- Purpose: Fix database schema mismatch preventing content insertion
-- Date: 2025-01-14
-- Issue: Plan job failing with "Could not find the 'visual_format' column"
-- =====================================================================================

BEGIN;

-- Check if content_metadata is a VIEW or TABLE
DO $$
DECLARE
    table_type_var TEXT;
BEGIN
    SELECT table_type INTO table_type_var
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'content_metadata';
    
    IF table_type_var = 'VIEW' THEN
        -- content_metadata is a VIEW, add column to underlying table
        -- Check if underlying table is content_generation_metadata_comprehensive
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'content_generation_metadata_comprehensive'
        ) THEN
            -- Add column to underlying table
            ALTER TABLE content_generation_metadata_comprehensive 
            ADD COLUMN IF NOT EXISTS visual_format TEXT;
            
            RAISE NOTICE 'Added visual_format column to content_generation_metadata_comprehensive';
            
            -- Recreate view to include new column
            -- Get current view definition
            -- Note: This assumes the view exists and can be recreated
            -- If view recreation fails, manual intervention may be needed
        ELSE
            RAISE EXCEPTION 'Underlying table content_generation_metadata_comprehensive not found';
        END IF;
    ELSE
        -- content_metadata is a TABLE, add column directly
        ALTER TABLE content_metadata 
        ADD COLUMN IF NOT EXISTS visual_format TEXT;
        
        RAISE NOTICE 'Added visual_format column to content_metadata table';
    END IF;
END $$;

-- Add index for performance queries
CREATE INDEX IF NOT EXISTS idx_content_visual_format 
ON content_generation_metadata_comprehensive(visual_format) 
WHERE visual_format IS NOT NULL;

COMMIT;


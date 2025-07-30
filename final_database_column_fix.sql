-- Final fix for any remaining database column issues
-- Run this in Supabase SQL Editor if you still see column errors

-- Double-check and add posted column if somehow missing
DO $$
BEGIN
    -- Check if posted column exists in tweets table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'posted'
    ) THEN
        ALTER TABLE tweets ADD COLUMN posted BOOLEAN DEFAULT TRUE;
        UPDATE tweets SET posted = TRUE WHERE posted IS NULL;
        RAISE NOTICE 'Added posted column to tweets table';
    ELSE
        RAISE NOTICE 'Posted column already exists in tweets table';
    END IF;
    
    -- Check if bandit_confidence column exists in learning_posts table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_posts' AND column_name = 'bandit_confidence'
    ) THEN
        ALTER TABLE learning_posts ADD COLUMN bandit_confidence REAL DEFAULT 0.5;
        RAISE NOTICE 'Added bandit_confidence column to learning_posts table';
    ELSE
        RAISE NOTICE 'Bandit_confidence column already exists in learning_posts table';
    END IF;
END $$;

-- Verify columns exist
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE (table_name = 'tweets' AND column_name = 'posted')
   OR (table_name = 'learning_posts' AND column_name = 'bandit_confidence')
ORDER BY table_name, column_name;
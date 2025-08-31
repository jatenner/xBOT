-- ================================================================
-- 🔧 CRITICAL DATABASE SCHEMA FIXES
-- ================================================================
-- Fixes the missing columns and constraint violations

-- Fix 1: Add missing success column to tweets table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'success'
    ) THEN
        ALTER TABLE tweets ADD COLUMN success BOOLEAN DEFAULT true;
        COMMENT ON COLUMN tweets.success IS 'Whether the tweet was successfully posted';
    END IF;
END $$;

-- Fix 2: Update constraint for unified_ai_intelligence to include missing decision types
DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'unified_ai_intelligence' 
        AND constraint_name = 'unified_ai_intelligence_decision_type_check'
    ) THEN
        ALTER TABLE unified_ai_intelligence 
        DROP CONSTRAINT unified_ai_intelligence_decision_type_check;
    END IF;
    
    -- Add updated constraint with all required decision types
    ALTER TABLE unified_ai_intelligence 
    ADD CONSTRAINT unified_ai_intelligence_decision_type_check 
    CHECK (decision_type IN (
        'api_usage',
        'posting_frequency', 
        'content_generation',
        'learning_update',
        'intelligence_update',
        'performance_analysis',
        'feature_extraction',
        'performance_prediction',
        'content_optimization',
        'contrarian_content_generation',
        'elite_content_generation',
        'ai_posting_strategy'
    ));
END $$;

-- Fix 3: Ensure tweets table has all necessary columns for enhanced tracking
DO $$ 
BEGIN 
    -- Add tweet_type if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'tweet_type'
    ) THEN
        ALTER TABLE tweets ADD COLUMN tweet_type VARCHAR(50) DEFAULT 'single';
    END IF;
    
    -- Add posting_method if missing  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'posting_method'
    ) THEN
        ALTER TABLE tweets ADD COLUMN posting_method VARCHAR(50) DEFAULT 'browser';
    END IF;
    
    -- Add extraction_method if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'extraction_method'
    ) THEN
        ALTER TABLE tweets ADD COLUMN extraction_method VARCHAR(50) DEFAULT 'url_capture';
    END IF;
END $$;

-- Fix 4: Create index for better performance on recent posts queries
CREATE INDEX IF NOT EXISTS idx_tweets_success_created_at 
ON tweets(success, created_at DESC);

-- Fix 5: Clean up any orphaned or invalid data
UPDATE tweets 
SET success = true 
WHERE success IS NULL;

-- Verification queries
SELECT 'Schema fixes completed successfully' as status;

SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
AND column_name IN ('success', 'tweet_type', 'posting_method', 'extraction_method')
ORDER BY column_name;

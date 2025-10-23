-- Fix content_metadata table schema - Add missing columns for reply system

-- Add generator_used column if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content_metadata' 
        AND column_name = 'generator_used'
    ) THEN
        ALTER TABLE content_metadata ADD COLUMN generator_used TEXT;
        RAISE NOTICE 'Added generator_used column';
    END IF;
END $$;

-- Add other potentially missing columns for reply system
DO $$ 
BEGIN
    -- Add target_tweet_id column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content_metadata' 
        AND column_name = 'target_tweet_id'
    ) THEN
        ALTER TABLE content_metadata ADD COLUMN target_tweet_id TEXT;
        RAISE NOTICE 'Added target_tweet_id column';
    END IF;
    
    -- Add target_tweet_content column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content_metadata' 
        AND column_name = 'target_tweet_content'
    ) THEN
        ALTER TABLE content_metadata ADD COLUMN target_tweet_content TEXT;
        RAISE NOTICE 'Added target_tweet_content column';
    END IF;
    
    -- Add estimated_reach column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content_metadata' 
        AND column_name = 'estimated_reach'
    ) THEN
        ALTER TABLE content_metadata ADD COLUMN estimated_reach INTEGER DEFAULT 0;
        RAISE NOTICE 'Added estimated_reach column';
    END IF;
    
    RAISE NOTICE 'Content metadata schema fix completed';
END $$;

-- Verify the columns now exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_metadata' 
AND column_name IN ('generator_used', 'target_tweet_id', 'target_tweet_content', 'estimated_reach')
ORDER BY column_name;

-- Fix post_attribution table schema - Add missing columns

-- First, check what columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'post_attribution' 
ORDER BY ordinal_position;

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add engagement_rate column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'engagement_rate'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN engagement_rate NUMERIC(5,4) DEFAULT 0;
        RAISE NOTICE 'Added engagement_rate column';
    END IF;
    
    -- Add impressions column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'impressions'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN impressions INTEGER DEFAULT 0;
        RAISE NOTICE 'Added impressions column';
    END IF;
    
    -- Add followers_gained column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'followers_gained'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN followers_gained INTEGER DEFAULT 0;
        RAISE NOTICE 'Added followers_gained column';
    END IF;
    
    -- Add hook_pattern column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'hook_pattern'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN hook_pattern TEXT;
        RAISE NOTICE 'Added hook_pattern column';
    END IF;
    
    -- Add topic column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'topic'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN topic TEXT;
        RAISE NOTICE 'Added topic column';
    END IF;
    
    RAISE NOTICE 'Schema fix completed';
END $$;

-- Verify the columns now exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'post_attribution' 
ORDER BY ordinal_position;

-- Check if we have any data
SELECT COUNT(*) as total_posts FROM post_attribution;

-- Show sample data if any exists
SELECT 
    posted_at,
    engagement_rate,
    impressions,
    followers_gained,
    topic,
    hook_pattern
FROM post_attribution 
ORDER BY posted_at DESC 
LIMIT 5;

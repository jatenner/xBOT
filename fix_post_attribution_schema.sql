-- Fix post_attribution table schema - Add missing columns

-- First, check if the table exists and what columns it has
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
    
    -- Add profile_clicks column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'profile_clicks'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN profile_clicks INTEGER DEFAULT 0;
        RAISE NOTICE 'Added profile_clicks column';
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
    
    -- Add generator_used column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'generator_used'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN generator_used TEXT;
        RAISE NOTICE 'Added generator_used column';
    END IF;
    
    -- Add format column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'format'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN format TEXT CHECK (format IN ('single', 'thread'));
        RAISE NOTICE 'Added format column';
    END IF;
    
    -- Add viral_score column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'viral_score'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN viral_score INTEGER;
        RAISE NOTICE 'Added viral_score column';
    END IF;
    
    -- Add last_updated column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'last_updated'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN last_updated TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added last_updated column';
    END IF;
    
    -- Add created_at column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_attribution' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE post_attribution ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column';
    END IF;
    
    RAISE NOTICE 'Schema fix completed';
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_attribution_posted_at ON post_attribution(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_attribution_engagement ON post_attribution(engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_post_attribution_topic ON post_attribution(topic);

-- Verify the fix worked
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'post_attribution'
ORDER BY ordinal_position;

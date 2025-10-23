-- Simple schema fix for post_attribution table
-- Add missing columns if they don't exist

-- Add engagement_rate column
ALTER TABLE post_attribution ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(5,4) DEFAULT 0;

-- Add impressions column  
ALTER TABLE post_attribution ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;

-- Add followers_gained column
ALTER TABLE post_attribution ADD COLUMN IF NOT EXISTS followers_gained INTEGER DEFAULT 0;

-- Add hook_pattern column
ALTER TABLE post_attribution ADD COLUMN IF NOT EXISTS hook_pattern TEXT;

-- Add topic column
ALTER TABLE post_attribution ADD COLUMN IF NOT EXISTS topic TEXT;

-- Show the updated schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'post_attribution' 
ORDER BY ordinal_position;

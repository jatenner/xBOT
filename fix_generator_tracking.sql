-- Fix generator tracking in content_metadata
-- Add missing generator_used column

ALTER TABLE content_metadata 
ADD COLUMN IF NOT EXISTS generator_used TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_content_generator_used 
ON content_metadata(generator_used) WHERE generator_used IS NOT NULL;

-- Verify column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_metadata' 
AND column_name IN ('generator_used', 'generator_name');

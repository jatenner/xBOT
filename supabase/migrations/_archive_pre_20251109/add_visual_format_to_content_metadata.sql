-- Add visual_format column to content_metadata table
-- This column tracks the visual formatting style chosen by generators

ALTER TABLE content_metadata 
ADD COLUMN IF NOT EXISTS visual_format TEXT;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_content_metadata_visual_format 
ON content_metadata(visual_format) 
WHERE visual_format IS NOT NULL;

-- Add comment
COMMENT ON COLUMN content_metadata.visual_format IS 
'Description of visual formatting used (e.g., "bullet_points", "minimal_spacing", "question_hook"). Tracks which formatting approaches perform best.';


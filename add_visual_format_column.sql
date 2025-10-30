-- Add visual format tracking to content_generation_metadata_comprehensive table
-- This allows us to track and learn from visual formatting choices

-- Add to base table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'visual_format'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive ADD COLUMN visual_format TEXT;
  END IF;
END $$;

-- Add index for performance analytics
CREATE INDEX IF NOT EXISTS idx_cgmc_visual_format 
ON content_generation_metadata_comprehensive(visual_format) 
WHERE visual_format IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN content_generation_metadata_comprehensive.visual_format IS 
'Description of visual formatting used by generator (e.g., "bullet_points", "minimal_linebreaks", "question_structure"). Helps track which formatting approaches perform best.';


-- Critical fix: Add generation_metadata column NOW
-- This unblocks content storage immediately

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'content_metadata' 
    AND column_name = 'generation_metadata'
  ) THEN
    ALTER TABLE content_metadata 
    ADD COLUMN generation_metadata JSONB;
    
    COMMENT ON COLUMN content_metadata.generation_metadata IS 
      'Stores content_type_id, content_type_name, viral_formula, hook_used for learning';
    
    RAISE NOTICE '✅ Added generation_metadata column';
  ELSE
    RAISE NOTICE 'Column generation_metadata already exists';
  END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_content_metadata_generation_metadata_gin 
  ON content_metadata USING GIN (generation_metadata);


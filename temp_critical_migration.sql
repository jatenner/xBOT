-- CRITICAL FIX: Add generation_metadata column to content_metadata
-- This allows content to be saved properly

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
      
    -- Add index for performance
    CREATE INDEX idx_content_metadata_generation_metadata_gin 
      ON content_metadata USING GIN (generation_metadata);
      
    RAISE NOTICE 'Successfully added generation_metadata column';
  ELSE
    RAISE NOTICE 'Column generation_metadata already exists';
  END IF;
END $$;

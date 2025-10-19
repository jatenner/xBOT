-- ============================================================================
-- FIX OUTCOMES TABLE SCHEMA
-- ============================================================================
-- Add missing columns that the metrics scraper needs
-- ============================================================================

DO $$ 
BEGIN
  -- Add collected_at column (separate from created_at to track when metrics were scraped)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'collected_at'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN collected_at TIMESTAMPTZ;
  END IF;

  -- Add data_source column to track where metrics came from
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'data_source'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN data_source TEXT;
  END IF;

  -- Add views column (important engagement metric)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'views'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN views INT;
  END IF;

  -- Add quote_tweets column (alias for quotes, some code uses this name)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' AND column_name = 'quote_tweets'
  ) THEN
    ALTER TABLE outcomes ADD COLUMN quote_tweets INT;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN outcomes.collected_at IS 'When the metrics were scraped (different from created_at which is when the row was first created)';
COMMENT ON COLUMN outcomes.data_source IS 'Where the metrics came from (e.g., scheduled_scraper, real-time, manual)';
COMMENT ON COLUMN outcomes.views IS 'Number of times the tweet was viewed';
COMMENT ON COLUMN outcomes.quote_tweets IS 'Number of quote tweets (high-intent sharing)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outcomes_collected_at ON outcomes(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_data_source ON outcomes(data_source);


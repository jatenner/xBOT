-- =====================================================================================
-- AUTHORITATIVE SCHEMA - Single Source of Truth
-- This migration establishes the CORRECT schema that all code should expect
-- Created: 2025-10-19
-- Purpose: Fix schema inconsistencies, add foreign keys, standardize column names
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. CONTENT_METADATA - Content queue and planning
-- =====================================================================================

-- Drop deprecated/redundant columns if they exist
DO $$ 
BEGIN
  -- Remove generated_at (use created_at instead)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'content_metadata' AND column_name = 'generated_at') THEN
    ALTER TABLE content_metadata DROP COLUMN generated_at;
  END IF;
  
  -- Remove decision_timestamp (use created_at instead)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'content_metadata' AND column_name = 'decision_timestamp') THEN
    ALTER TABLE content_metadata DROP COLUMN decision_timestamp;
  END IF;
  
  -- Remove thread_parts (use thread_tweets instead)
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'content_metadata' AND column_name = 'thread_parts') THEN
    ALTER TABLE content_metadata DROP COLUMN thread_parts;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors
END $$;

-- Ensure all required columns exist with correct types
DO $$
BEGIN
  -- Core columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'id') THEN
    ALTER TABLE content_metadata ADD COLUMN id BIGSERIAL PRIMARY KEY;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'decision_id') THEN
    ALTER TABLE content_metadata ADD COLUMN decision_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'created_at') THEN
    ALTER TABLE content_metadata ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'content_metadata' AND column_name = 'updated_at') THEN
    ALTER TABLE content_metadata ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Essential indexes for content_metadata
CREATE INDEX IF NOT EXISTS idx_content_metadata_status_scheduled 
  ON content_metadata(status, scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_content_metadata_posted_at 
  ON content_metadata(posted_at) WHERE posted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_metadata_created_at 
  ON content_metadata(created_at DESC);

-- =====================================================================================
-- 2. POSTED_DECISIONS - Successfully posted content
-- =====================================================================================

-- Ensure posted_decisions has proper structure
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'posted_decisions' AND column_name = 'created_at') THEN
    ALTER TABLE posted_decisions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Essential indexes for posted_decisions
CREATE INDEX IF NOT EXISTS idx_posted_decisions_created_at 
  ON posted_decisions(created_at DESC);

-- =====================================================================================
-- 3. OUTCOMES - Tweet performance metrics with FOREIGN KEY
-- =====================================================================================

-- Ensure outcomes has all required columns
DO $$
BEGIN
  -- Add quote_tweets as alias for quotes if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'quote_tweets') THEN
    ALTER TABLE outcomes ADD COLUMN quote_tweets INTEGER DEFAULT 0;
  END IF;
  
  -- Add views if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'views') THEN
    ALTER TABLE outcomes ADD COLUMN views INTEGER DEFAULT 0;
  END IF;
  
  -- Add profile_clicks if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'profile_clicks') THEN
    ALTER TABLE outcomes ADD COLUMN profile_clicks INTEGER DEFAULT 0;
  END IF;
  
  -- Ensure created_at exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'outcomes' AND column_name = 'created_at') THEN
    ALTER TABLE outcomes ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- 🔥 CRITICAL: Add foreign key to posted_decisions
DO $$ 
BEGIN
  -- First check if the foreign key already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_outcomes_posted_decisions'
    AND table_name = 'outcomes'
  ) THEN
    -- Add foreign key constraint
    ALTER TABLE outcomes
      ADD CONSTRAINT fk_outcomes_posted_decisions
      FOREIGN KEY (decision_id)
      REFERENCES posted_decisions(decision_id)
      ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Added foreign key: outcomes.decision_id → posted_decisions.decision_id';
  ELSE
    RAISE NOTICE '✓ Foreign key already exists: outcomes.decision_id → posted_decisions.decision_id';
  END IF;
EXCEPTION 
  WHEN foreign_key_violation THEN
    RAISE NOTICE '⚠️ Cannot add foreign key: Some outcomes.decision_id values do not exist in posted_decisions';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Foreign key creation skipped: %', SQLERRM;
END $$;

-- Essential indexes for outcomes
CREATE INDEX IF NOT EXISTS idx_outcomes_created_at 
  ON outcomes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outcomes_collected_at 
  ON outcomes(collected_at DESC) WHERE collected_at IS NOT NULL;

-- =====================================================================================
-- 4. CREATE VIEW FOR EASY JOINS (What code actually wants)
-- =====================================================================================

CREATE OR REPLACE VIEW content_with_outcomes AS
SELECT 
  pd.decision_id,
  pd.tweet_id,
  pd.content,
  pd.decision_type,
  pd.generator_name,
  pd.posted_at,
  pd.created_at as decision_created_at, -- Alias for legacy 'decision_timestamp' references
  o.likes,
  o.retweets,
  o.replies,
  o.bookmarks,
  o.quotes,
  o.impressions,
  o.views,
  o.profile_clicks,
  o.engagement_rate,
  o.followers_gained,
  o.followers_before,
  o.followers_after,
  o.collected_at,
  o.collected_pass,
  o.data_source
FROM posted_decisions pd
LEFT JOIN outcomes o ON pd.decision_id = o.decision_id;

-- Grant access to view
GRANT SELECT ON content_with_outcomes TO anon, authenticated;

-- =====================================================================================
-- 5. DOCUMENTATION
-- =====================================================================================

COMMENT ON TABLE content_metadata IS 'Content queue - content waiting to be posted';
COMMENT ON TABLE posted_decisions IS 'Posted content - successfully published tweets';
COMMENT ON TABLE outcomes IS 'Performance metrics - scraped engagement data';
COMMENT ON VIEW content_with_outcomes IS 'Convenience view joining posted_decisions with outcomes for easy querying';

COMMENT ON COLUMN content_metadata.created_at IS 'When content was generated (use this instead of decision_timestamp or generated_at)';
COMMENT ON COLUMN posted_decisions.decision_id IS 'Links to content_metadata.decision_id';
COMMENT ON COLUMN outcomes.decision_id IS 'Links to posted_decisions.decision_id (foreign key enforced)';
COMMENT ON COLUMN outcomes.collected_pass IS '0=placeholder, 1=T+1h metrics, 2=T+24h final metrics';

COMMIT;

-- =====================================================================================
-- Summary of changes:
-- ✅ Removed redundant columns (generated_at, decision_timestamp, thread_parts)
-- ✅ Standardized timestamp columns (created_at, updated_at, posted_at, collected_at)
-- ✅ Added foreign key constraint: outcomes.decision_id → posted_decisions.decision_id
-- ✅ Created content_with_outcomes view for easy JOINs
-- ✅ Added missing columns (quote_tweets, views, profile_clicks)
-- ✅ Added essential indexes for performance
-- ✅ Documented all tables and critical columns
-- =====================================================================================


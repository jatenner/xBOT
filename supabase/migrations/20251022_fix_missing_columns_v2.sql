-- ============================================================================
-- FIX MISSING DATABASE COLUMNS (v2 - Targeted)
-- Migration: 20251022_fix_missing_columns_v2
-- Purpose: Add only the missing columns that are actually missing
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX POSTED_DECISIONS - It's a view, need to alter underlying table
-- ============================================================================
-- First, find what table the view is based on
DO $$
DECLARE
  base_table TEXT;
BEGIN
  -- Check if view definition references a table
  SELECT DISTINCT table_name INTO base_table
  FROM information_schema.view_table_usage
  WHERE view_name = 'posted_decisions'
  AND view_schema = 'public'
  LIMIT 1;
  
  IF base_table IS NOT NULL THEN
    RAISE NOTICE 'posted_decisions view is based on table: %', base_table;
    
    -- Add generation_source to the base table
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS generation_source TEXT DEFAULT ''real''', base_table);
    RAISE NOTICE '✅ Added generation_source to %', base_table;
  ELSE
    RAISE NOTICE '⚠️ Could not find base table for posted_decisions view';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Error with posted_decisions: %', SQLERRM;
END $$;

-- ============================================================================
-- 2. FIX OUTCOMES - Add er_calculated (has engagement_rate but missing er_calculated)
-- ============================================================================
ALTER TABLE outcomes
ADD COLUMN IF NOT EXISTS er_calculated NUMERIC(5,4);

COMMENT ON COLUMN outcomes.er_calculated IS 'Calculated engagement rate: (likes + retweets + replies) / impressions';

-- ============================================================================
-- 3. FIX LEARNING_POSTS - Add updated_at column
-- ============================================================================
ALTER TABLE learning_posts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_learning_posts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_learning_posts_timestamp ON learning_posts;
CREATE TRIGGER trigger_update_learning_posts_timestamp
  BEFORE UPDATE ON learning_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_posts_timestamp();

-- ============================================================================
-- 4. FIX TWEET_METRICS - Add created_at column
-- ============================================================================
ALTER TABLE tweet_metrics
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_created_at 
ON tweet_metrics(created_at DESC);

-- ============================================================================
-- 5. FIX COMPREHENSIVE_METRICS - Add unique constraint for upsert
-- ============================================================================
DO $$
BEGIN
  -- Add unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'comprehensive_metrics_unique_post'
  ) THEN
    ALTER TABLE comprehensive_metrics
    ADD CONSTRAINT comprehensive_metrics_unique_post
    UNIQUE (post_id, collected_at);
    
    RAISE NOTICE '✅ Added unique constraint to comprehensive_metrics';
  ELSE
    RAISE NOTICE '✅ Unique constraint already exists on comprehensive_metrics';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '⚠️ comprehensive_metrics table does not exist (will be created when needed)';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not add constraint to comprehensive_metrics: %', SQLERRM;
END $$;

-- ============================================================================
-- 6. VERIFICATION - Check what was fixed
-- ============================================================================
DO $$
DECLARE
  outcomes_has_er BOOLEAN;
  learning_posts_has_updated BOOLEAN;
  tweet_metrics_has_created BOOLEAN;
BEGIN
  -- Check outcomes.er_calculated
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'outcomes'
    AND column_name = 'er_calculated'
  ) INTO outcomes_has_er;
  
  -- Check learning_posts.updated_at
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_posts'
    AND column_name = 'updated_at'
  ) INTO learning_posts_has_updated;
  
  -- Check tweet_metrics.created_at
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tweet_metrics'
    AND column_name = 'created_at'
  ) INTO tweet_metrics_has_created;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION VERIFICATION REPORT';
  RAISE NOTICE '========================================';
  
  IF outcomes_has_er THEN
    RAISE NOTICE '✅ outcomes.er_calculated exists';
  ELSE
    RAISE NOTICE '❌ outcomes.er_calculated MISSING';
  END IF;
  
  IF learning_posts_has_updated THEN
    RAISE NOTICE '✅ learning_posts.updated_at exists';
  ELSE
    RAISE NOTICE '❌ learning_posts.updated_at MISSING';
  END IF;
  
  IF tweet_metrics_has_created THEN
    RAISE NOTICE '✅ tweet_metrics.created_at exists';
  ELSE
    RAISE NOTICE '❌ tweet_metrics.created_at MISSING';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

COMMIT;


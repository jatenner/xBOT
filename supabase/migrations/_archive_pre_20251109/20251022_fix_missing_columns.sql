-- ============================================================================
-- FIX MISSING DATABASE COLUMNS
-- Migration: 20251022_fix_missing_columns
-- Purpose: Add missing columns blocking learning system
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX POSTED_DECISIONS - Add generation_source column
-- ============================================================================
ALTER TABLE posted_decisions
ADD COLUMN IF NOT EXISTS generation_source TEXT DEFAULT 'real';

CREATE INDEX IF NOT EXISTS idx_posted_decisions_generation_source 
ON posted_decisions(generation_source);

COMMENT ON COLUMN posted_decisions.generation_source IS 'Source of content generation: real=LLM, synthetic=fallback';

-- ============================================================================
-- 2. FIX OUTCOMES - Add er_calculated column (if missing)
-- ============================================================================
ALTER TABLE outcomes
ADD COLUMN IF NOT EXISTS er_calculated NUMERIC(5,4);

COMMENT ON COLUMN outcomes.er_calculated IS 'Calculated engagement rate: (likes + retweets + replies) / impressions';

-- ============================================================================
-- 3. FIX LEARNING_POSTS - Add updated_at column
-- ============================================================================
ALTER TABLE IF EXISTS learning_posts
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
ALTER TABLE IF EXISTS tweet_metrics
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_created_at 
ON tweet_metrics(created_at DESC);

-- ============================================================================
-- 5. FIX COMPREHENSIVE_METRICS - Add unique constraint for upsert
-- ============================================================================
-- First, check if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'comprehensive_metrics') THEN
    
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
  ELSE
    RAISE NOTICE '⚠️ comprehensive_metrics table does not exist (will be created when needed)';
  END IF;
END $$;

-- ============================================================================
-- 6. VERIFICATION - Log what was fixed
-- ============================================================================
DO $$
DECLARE
  posted_decisions_has_gen_source BOOLEAN;
  outcomes_has_er BOOLEAN;
  learning_posts_has_updated BOOLEAN;
  tweet_metrics_has_created BOOLEAN;
BEGIN
  -- Check posted_decisions.generation_source
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posted_decisions'
    AND column_name = 'generation_source'
  ) INTO posted_decisions_has_gen_source;
  
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
  
  IF posted_decisions_has_gen_source THEN
    RAISE NOTICE '✅ posted_decisions.generation_source exists';
  ELSE
    RAISE NOTICE '❌ posted_decisions.generation_source MISSING';
  END IF;
  
  IF outcomes_has_er THEN
    RAISE NOTICE '✅ outcomes.er_calculated exists';
  ELSE
    RAISE NOTICE '❌ outcomes.er_calculated MISSING';
  END IF;
  
  IF learning_posts_has_updated THEN
    RAISE NOTICE '✅ learning_posts.updated_at exists';
  ELSE
    RAISE NOTICE '⚠️ learning_posts.updated_at MISSING (table may not exist)';
  END IF;
  
  IF tweet_metrics_has_created THEN
    RAISE NOTICE '✅ tweet_metrics.created_at exists';
  ELSE
    RAISE NOTICE '⚠️ tweet_metrics.created_at MISSING (table may not exist)';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

COMMIT;


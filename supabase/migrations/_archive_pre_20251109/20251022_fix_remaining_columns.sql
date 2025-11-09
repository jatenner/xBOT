-- ============================================================================
-- FIX REMAINING DATABASE SCHEMA ISSUES
-- Migration: 20251022_fix_remaining_columns
-- Purpose: Fix learning_posts unique constraint, tweet_metrics.updated_at, content_with_outcomes view
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FIX LEARNING_POSTS - Add unique constraint for upsert
-- ============================================================================
-- The error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- This means the table needs a unique constraint on the columns used in ON CONFLICT

-- First, check what constraint is being used in the code
-- Most likely: (tweet_id, phase) or just (tweet_id)

-- Add unique constraint on tweet_id (assuming one learning entry per tweet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'learning_posts_tweet_id_unique'
  ) THEN
    ALTER TABLE learning_posts
    ADD CONSTRAINT learning_posts_tweet_id_unique UNIQUE (tweet_id);
    RAISE NOTICE '✅ Added unique constraint learning_posts_tweet_id_unique';
  ELSE
    RAISE NOTICE 'ℹ️ Constraint learning_posts_tweet_id_unique already exists';
  END IF;
END $$;

COMMENT ON CONSTRAINT learning_posts_tweet_id_unique ON learning_posts 
  IS 'Ensures one learning entry per tweet for upsert operations';

-- ============================================================================
-- 2. FIX TWEET_METRICS - Add updated_at column
-- ============================================================================
ALTER TABLE tweet_metrics
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to auto-update timestamp
CREATE OR REPLACE FUNCTION update_tweet_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tweet_metrics_timestamp ON tweet_metrics;
CREATE TRIGGER trigger_update_tweet_metrics_timestamp
  BEFORE UPDATE ON tweet_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_tweet_metrics_timestamp();

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_updated_at 
  ON tweet_metrics(updated_at DESC);

COMMENT ON COLUMN tweet_metrics.updated_at IS 'Auto-updated timestamp for metrics tracking';

-- ============================================================================
-- 3. FIX CONTENT_WITH_OUTCOMES VIEW - Add missing likes column
-- ============================================================================
-- The error: "column content_with_outcomes.likes does not exist"
-- This view is likely used for few-shot learning examples

-- Drop and recreate view with correct columns
DROP VIEW IF EXISTS content_with_outcomes CASCADE;

CREATE OR REPLACE VIEW content_with_outcomes AS
SELECT 
  cm.id,
  cm.content,
  cm.topic_cluster,
  cm.generator_name,
  cm.quality_score,
  cm.predicted_er,
  cm.tweet_id,
  cm.posted_at,
  cm.created_at,
  -- Engagement metrics (these are the missing columns)
  cm.actual_likes AS likes,
  cm.actual_retweets AS retweets,
  cm.actual_replies AS replies,
  cm.actual_impressions AS impressions,
  cm.actual_engagement_rate AS engagement_rate,
  -- Metadata
  cm.hook_type,
  cm.style,
  cm.generator_confidence
FROM content_generation_metadata_comprehensive cm
WHERE cm.status = 'posted'
  AND cm.tweet_id IS NOT NULL
ORDER BY cm.posted_at DESC;

-- Grant permissions
ALTER VIEW content_with_outcomes OWNER TO postgres;
GRANT ALL ON content_with_outcomes TO postgres;
GRANT ALL ON content_with_outcomes TO anon, authenticated, service_role;

COMMENT ON VIEW content_with_outcomes IS 'Posted content with actual outcomes for learning system';

-- ============================================================================
-- 4. VERIFY ALL FIXES
-- ============================================================================
DO $$
DECLARE
  constraint_exists BOOLEAN;
  column_exists BOOLEAN;
  view_exists BOOLEAN;
BEGIN
  -- Check learning_posts constraint
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'learning_posts_tweet_id_unique'
  ) INTO constraint_exists;
  
  IF constraint_exists THEN
    RAISE NOTICE '✅ learning_posts unique constraint verified';
  ELSE
    RAISE EXCEPTION '❌ learning_posts unique constraint missing';
  END IF;
  
  -- Check tweet_metrics.updated_at column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tweet_metrics'
    AND column_name = 'updated_at'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '✅ tweet_metrics.updated_at column verified';
  ELSE
    RAISE EXCEPTION '❌ tweet_metrics.updated_at column missing';
  END IF;
  
  -- Check content_with_outcomes view
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_name = 'content_with_outcomes'
  ) INTO view_exists;
  
  IF view_exists THEN
    RAISE NOTICE '✅ content_with_outcomes view verified';
    
    -- Check if likes column exists in view
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'content_with_outcomes'
      AND column_name = 'likes'
    ) INTO column_exists;
    
    IF column_exists THEN
      RAISE NOTICE '✅ content_with_outcomes.likes column verified';
    ELSE
      RAISE EXCEPTION '❌ content_with_outcomes.likes column missing';
    END IF;
  ELSE
    RAISE EXCEPTION '❌ content_with_outcomes view missing';
  END IF;
  
  RAISE NOTICE '🎉 All database fixes verified successfully!';
END $$;

COMMIT;


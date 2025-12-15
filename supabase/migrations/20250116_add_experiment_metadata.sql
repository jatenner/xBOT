-- =====================================================================================
-- ADD EXPERIMENT METADATA COLUMNS
-- Purpose: Add experiment_group and hook_variant columns for Phase 4 experimentation
-- Date: 2025-01-16
-- Phase: 4 Part 3 - Experimentation Layer
-- =====================================================================================
-- 
-- This migration:
-- 1. Adds experiment_group TEXT column to content_generation_metadata_comprehensive
-- 2. Adds hook_variant TEXT column to content_generation_metadata_comprehensive
-- 3. Updates content_metadata VIEW to include these columns
-- 4. Creates indexes for experiment analysis
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- STEP 1: Add experiment_group column
-- =====================================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'experiment_group'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN experiment_group TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.experiment_group IS 
      'Experiment group identifier (e.g., hook_ab_v1)';
    
    RAISE NOTICE 'Added experiment_group column to content_generation_metadata_comprehensive';
  ELSE
    RAISE NOTICE 'experiment_group column already exists';
  END IF;
END $$;

-- =====================================================================================
-- STEP 2: Add hook_variant column
-- =====================================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'hook_variant'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN hook_variant TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.hook_variant IS 
      'Hook variant identifier (e.g., A, B) for A/B testing';
    
    RAISE NOTICE 'Added hook_variant column to content_generation_metadata_comprehensive';
  ELSE
    RAISE NOTICE 'hook_variant column already exists';
  END IF;
END $$;

-- =====================================================================================
-- STEP 3: Create indexes for experiment analysis
-- =====================================================================================

CREATE INDEX IF NOT EXISTS idx_cgmc_experiment 
  ON content_generation_metadata_comprehensive(experiment_group, hook_variant) 
  WHERE experiment_group IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cgmc_experiment_posted 
  ON content_generation_metadata_comprehensive(experiment_group, hook_variant, posted_at DESC) 
  WHERE experiment_group IS NOT NULL AND posted_at IS NOT NULL;

-- =====================================================================================
-- STEP 4: Update content_metadata VIEW to include experiment columns
-- =====================================================================================

-- Drop and recreate view to include new columns
DROP VIEW IF EXISTS content_metadata CASCADE;

CREATE VIEW content_metadata AS
SELECT 
  decision_id,
  decision_type,
  content,
  thread_parts,
  status,
  created_at,
  posted_at,
  scheduled_at,
  tweet_id,
  generator_name,
  quality_score,
  predicted_er,
  topic_cluster,
  target_tweet_id,
  target_username,
  visual_format,
  content_slot,
  experiment_group, -- NEW: Experiment metadata
  hook_variant, -- NEW: Hook variant
  -- Include all other columns from base table
  generation_source,
  angle,
  tone,
  format_strategy,
  bandit_arm,
  features,
  updated_at
FROM content_generation_metadata_comprehensive;

COMMENT ON VIEW content_metadata IS 
  'Unified view of content metadata including experiment tracking (Phase 4)';

COMMIT;


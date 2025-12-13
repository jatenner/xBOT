-- =====================================================================================
-- xBOT v2 Upgrade: Add follower attribution and primary objective score fields
-- Migration: 20251205_add_v2_outcomes_fields.sql
-- Phase: 1.1 - Data & Learning Foundation
-- =====================================================================================

-- Add followers_gained_weighted column to outcomes table
-- This is a weighted version of followers_gained that accounts for:
-- - Time window (24h vs 48h attribution)
-- - Confidence in attribution
-- - Quality of followers gained
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' 
    AND column_name = 'followers_gained_weighted'
  ) THEN
    ALTER TABLE outcomes 
    ADD COLUMN followers_gained_weighted NUMERIC(10,4) DEFAULT NULL;
    
    COMMENT ON COLUMN outcomes.followers_gained_weighted IS 
      'Weighted follower gain accounting for time window, attribution confidence, and follower quality';
  END IF;
END $$;

-- Add primary_objective_score column to outcomes table
-- This is the v2 primary metric: combines engagement_rate and followers_gained_weighted
-- Formula: primary_objective_score = (engagement_rate * 0.4) + (followers_gained_weighted_normalized * 0.6)
-- Normalized to 0-1 scale for comparison
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' 
    AND column_name = 'primary_objective_score'
  ) THEN
    ALTER TABLE outcomes 
    ADD COLUMN primary_objective_score NUMERIC(10,6) DEFAULT NULL;
    
    COMMENT ON COLUMN outcomes.primary_objective_score IS 
      'Primary v2 metric: weighted combination of engagement_rate (40%) and followers_gained_weighted (60%)';
  END IF;
END $$;

-- Add optional hook_type, cta_type, structure_type columns for enhanced learning
DO $$
BEGIN
  -- hook_type: Type of hook used (e.g., 'question', 'statistic', 'controversy', 'story')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' 
    AND column_name = 'hook_type'
  ) THEN
    ALTER TABLE outcomes 
    ADD COLUMN hook_type TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN outcomes.hook_type IS 
      'Type of hook used in content (question, statistic, controversy, story, etc.)';
  END IF;

  -- cta_type: Type of call-to-action (e.g., 'none', 'question', 'link', 'engagement')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' 
    AND column_name = 'cta_type'
  ) THEN
    ALTER TABLE outcomes 
    ADD COLUMN cta_type TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN outcomes.cta_type IS 
      'Type of call-to-action (none, question, link, engagement, etc.)';
  END IF;

  -- structure_type: Content structure (e.g., 'single', 'thread', 'list', 'story')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcomes' 
    AND column_name = 'structure_type'
  ) THEN
    ALTER TABLE outcomes 
    ADD COLUMN structure_type TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN outcomes.structure_type IS 
      'Content structure type (single, thread, list, story, etc.)';
  END IF;
END $$;

-- Create indexes for efficient querying on new fields
CREATE INDEX IF NOT EXISTS idx_outcomes_followers_gained_weighted 
  ON outcomes(followers_gained_weighted DESC) 
  WHERE followers_gained_weighted IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outcomes_primary_objective_score 
  ON outcomes(primary_objective_score DESC) 
  WHERE primary_objective_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outcomes_hook_type 
  ON outcomes(hook_type) 
  WHERE hook_type IS NOT NULL;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251205_add_v2_outcomes_fields.sql completed successfully';
  RAISE NOTICE 'Added columns: followers_gained_weighted, primary_objective_score, hook_type, cta_type, structure_type';
END $$;


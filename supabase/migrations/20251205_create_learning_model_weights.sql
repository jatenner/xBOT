-- =====================================================================================
-- xBOT v2 Upgrade: Create learning_model_weights table for offline weight maps
-- Migration: 20251205_create_learning_model_weights.sql
-- Phase: 1.4 - Data & Learning Foundation
-- =====================================================================================
-- 
-- Purpose: Store computed weight maps from offline learning analysis
-- These weights guide content generation by preferring high-performing features
-- 
-- Dependencies: Requires vw_learning view (Phase 1.2)
-- =====================================================================================

-- Create learning_model_weights table
CREATE TABLE IF NOT EXISTS learning_model_weights (
  id BIGSERIAL PRIMARY KEY,
  
  -- Weight map (JSONB)
  -- Structure: { "generator_name": { "dataNerd": 0.25, "contrarian": 0.15, ... }, 
  --              "topic": { "supplements": 0.20, "nutrition": 0.18, ... },
  --              "tone": { "data-driven": 0.22, "expert": 0.20, ... },
  --              "decision_type": { "single": 0.60, "thread": 0.40 },
  --              "content_slot": { "myth_busting": 0.25, "framework": 0.20, ... } }
  weights JSONB NOT NULL,
  
  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_range_start TIMESTAMPTZ NOT NULL,
  date_range_end TIMESTAMPTZ NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  version TEXT NOT NULL DEFAULT '1.0',
  
  -- Performance metrics of the dataset used
  avg_primary_objective_score NUMERIC(10,6),
  avg_followers_gained_weighted NUMERIC(10,4),
  total_posts_analyzed INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true, -- Only one active weight map at a time
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_learning_model_weights_active 
  ON learning_model_weights(is_active, computed_at DESC) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_learning_model_weights_computed_at 
  ON learning_model_weights(computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_model_weights_version 
  ON learning_model_weights(version);

-- Ensure only one active weight map at a time (via application logic, not constraint)
-- Application should set is_active=false on old maps when creating new one

-- Add comment
COMMENT ON TABLE learning_model_weights IS 
  'Stores computed weight maps from offline learning analysis. '
  'Weights guide content generation by preferring high-performing features. '
  'Only one weight map should be active at a time.';

COMMENT ON COLUMN learning_model_weights.weights IS 
  'JSONB map of feature → weight. Features: generator_name, topic, tone, decision_type, content_slot. '
  'Weights are normalized probabilities (sum to 1.0 per feature category).';

COMMENT ON COLUMN learning_model_weights.is_active IS 
  'Only one weight map should be active at a time. Set to false when a new weight map is computed.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251205_create_learning_model_weights.sql completed successfully';
  RAISE NOTICE 'Created table: learning_model_weights';
END $$;


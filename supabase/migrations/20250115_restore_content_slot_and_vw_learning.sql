-- =====================================================================================
-- RESTORE CONTENT_SLOT AND VW_LEARNING
-- Purpose: Restore Phase 2 content_slot and Phase 1 vw_learning view
-- Date: 2025-01-15
-- Phase: 1-3 Learning System Restoration
-- =====================================================================================
-- 
-- This migration:
-- 1. Adds content_slot column to content_generation_metadata_comprehensive (if missing)
-- 2. Recreates content_metadata VIEW with content_slot included
-- 3. Creates/restores vw_learning view for unified learning queries
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- STEP 1: Add content_slot to base table
-- =====================================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'content_generation_metadata_comprehensive' 
    AND column_name = 'content_slot'
  ) THEN
    ALTER TABLE content_generation_metadata_comprehensive 
    ADD COLUMN content_slot TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN content_generation_metadata_comprehensive.content_slot IS 
      'Content slot type from micro content calendar (myth_busting, framework, research, practical_tip, etc.)';
    
    RAISE NOTICE 'Added content_slot column to content_generation_metadata_comprehensive';
  ELSE
    RAISE NOTICE 'content_slot column already exists';
  END IF;
END $$;

-- Create index for content_slot
CREATE INDEX IF NOT EXISTS idx_cgmc_content_slot 
  ON content_generation_metadata_comprehensive(content_slot) 
  WHERE content_slot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cgmc_slot_posted_at 
  ON content_generation_metadata_comprehensive(content_slot, posted_at DESC) 
  WHERE content_slot IS NOT NULL AND posted_at IS NOT NULL;

-- =====================================================================================
-- STEP 2: Recreate content_metadata VIEW with content_slot
-- =====================================================================================

DROP VIEW IF EXISTS content_metadata CASCADE;

CREATE VIEW content_metadata AS
SELECT 
  id,
  decision_id,
  content,
  thread_parts,
  topic_cluster,
  generation_source,
  generator_name,
  generator_confidence,
  bandit_arm,
  timing_arm,
  angle,
  style,
  hook_type,
  hook_pattern,
  cta_type,
  fact_source,
  fact_count,
  quality_score,
  predicted_er,
  predicted_engagement,
  novelty,
  readability_score,
  sentiment,
  actual_likes,
  actual_retweets,
  actual_replies,
  actual_impressions,
  actual_engagement_rate,
  viral_score,
  prediction_accuracy,
  style_effectiveness,
  hook_effectiveness,
  cta_effectiveness,
  fact_resonance,
  status,
  scheduled_at,
  posted_at,
  tweet_id,
  skip_reason,
  error_message,
  target_tweet_id,
  target_username,
  features,
  content_hash,
  embedding,
  experiment_id,
  experiment_arm,
  thread_length,
  created_at,
  updated_at,
  decision_type,
  raw_topic,
  tone,
  format_strategy,
  visual_format,
  content_slot  -- ✅ RESTORED
FROM content_generation_metadata_comprehensive;

-- Restore permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON content_metadata TO service_role;

COMMENT ON VIEW content_metadata IS 
  'View of content_generation_metadata_comprehensive with all content tracking fields including content_slot (Phase 2)';

-- =====================================================================================
-- STEP 3: Create/restore vw_learning view
-- =====================================================================================

DROP VIEW IF EXISTS vw_learning CASCADE;

CREATE VIEW vw_learning AS
SELECT 
  -- Identity
  cm.decision_id,
  cm.tweet_id,
  
  -- Content Descriptors (from content_metadata)
  cm.raw_topic AS topic,
  cm.angle,
  cm.tone,
  cm.generator_name,
  cm.decision_type,
  cm.content_slot, -- v2 field (Phase 2)
  cm.format_strategy,
  cm.content,
  cm.thread_parts,
  
  -- Reply-specific fields
  cm.target_tweet_id,
  cm.target_username,
  
  -- Timing (from content_metadata)
  cm.created_at,
  cm.posted_at,
  cm.scheduled_at,
  
  -- Performance Metrics (from outcomes - primary source)
  o.impressions,
  o.views,
  o.likes,
  o.retweets,
  o.replies,
  o.bookmarks,
  o.profile_clicks,
  o.engagement_rate,
  o.followers_gained, -- Raw follower gain
  o.followers_gained_weighted, -- v2 weighted follower gain
  o.primary_objective_score, -- v2 primary metric
  o.hook_type, -- v2 optional field
  o.cta_type, -- v2 optional field
  o.structure_type, -- v2 optional field
  o.collected_at,
  o.data_source,
  o.simulated,
  
  -- Additional metrics from tweet_metrics (if available)
  tm.likes_count AS tm_likes_count,
  tm.retweets_count AS tm_retweets_count,
  tm.replies_count AS tm_replies_count,
  tm.impressions_count AS tm_impressions_count,
  tm.created_at AS tm_created_at,
  tm.updated_at AS tm_updated_at,
  
  -- Simplified metrics from learning_posts (if available)
  lp.likes_count AS lp_likes_count,
  lp.retweets_count AS lp_retweets_count,
  lp.replies_count AS lp_replies_count,
  lp.bookmarks_count AS lp_bookmarks_count,
  lp.impressions_count AS lp_impressions_count,
  lp.updated_at AS lp_updated_at,
  
  -- Status
  cm.status,
  
  -- Computed fields for learning
  CASE 
    WHEN cm.posted_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (NOW() - cm.posted_at)) / 3600.0 -- Hours since post
    ELSE NULL
  END AS age_hours,
  
  CASE 
    WHEN cm.posted_at IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (NOW() - cm.posted_at)) / 86400.0 -- Days since post
    ELSE NULL
  END AS age_days,
  
  -- Quality indicators
  CASE 
    WHEN o.impressions > 0 AND o.engagement_rate > 0 THEN true
    ELSE false
  END AS has_metrics,
  
  CASE 
    WHEN o.followers_gained_weighted IS NOT NULL AND o.primary_objective_score IS NOT NULL THEN true
    ELSE false
  END AS has_v2_metrics

FROM content_metadata cm
  
-- Left join outcomes (primary metrics source)
LEFT JOIN outcomes o ON cm.decision_id = o.decision_id
  
-- Left join tweet_metrics (timing-specific metrics)
LEFT JOIN tweet_metrics tm ON cm.tweet_id = tm.tweet_id
  
-- Left join learning_posts (simplified metrics for some learning systems)
LEFT JOIN learning_posts lp ON cm.tweet_id = lp.tweet_id

-- Only include posted content (exclude queued/failed/skipped)
WHERE cm.status = 'posted'
  AND cm.tweet_id IS NOT NULL;

-- Create indexes on underlying tables for view performance
CREATE INDEX IF NOT EXISTS idx_cgmc_status_posted_at 
  ON content_generation_metadata_comprehensive(status, posted_at DESC) 
  WHERE status = 'posted';

CREATE INDEX IF NOT EXISTS idx_outcomes_decision_id 
  ON outcomes(decision_id);

CREATE INDEX IF NOT EXISTS idx_outcomes_v2_metrics 
  ON outcomes(primary_objective_score DESC, followers_gained_weighted DESC) 
  WHERE primary_objective_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id 
  ON tweet_metrics(tweet_id);

-- Add comment to view
COMMENT ON VIEW vw_learning IS 
  'Unified learning view combining content_metadata, outcomes, tweet_metrics, and learning_posts. '
  'Provides one row per posted decision with all learning-relevant data. '
  'v2 fields: followers_gained_weighted, primary_objective_score, content_slot, hook_type, cta_type, structure_type';

COMMIT;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250115_restore_content_slot_and_vw_learning.sql completed successfully';
  RAISE NOTICE 'Restored: content_slot column and vw_learning view';
END $$;


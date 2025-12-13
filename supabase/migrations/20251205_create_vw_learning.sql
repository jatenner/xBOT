-- =====================================================================================
-- xBOT v2 Upgrade: Create unified learning view (vw_learning)
-- Migration: 20251205_create_vw_learning.sql
-- Phase: 1.2 - Data & Learning Foundation
-- =====================================================================================
-- 
-- Purpose: Unified view combining all learning-relevant data from core tables
-- Provides one row per decision/tweet with:
--   - Content descriptors (topic, angle, tone, generator_name, decision_type, content_slot)
--   - Timing (created_at, posted_at)
--   - Performance (impressions, engagement_rate, followers_gained_weighted, primary_objective_score)
--
-- Dependencies: Requires outcomes table to have v2 fields (followers_gained_weighted, primary_objective_score)
-- =====================================================================================

-- Drop view if it exists (for idempotent migration)
DROP VIEW IF EXISTS vw_learning;

-- Create unified learning view
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
  cm.content_slot, -- v2 field (may be NULL until Phase 2.1)
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
-- (These should already exist, but ensure they're present)

-- Index on content_metadata for filtering
CREATE INDEX IF NOT EXISTS idx_content_metadata_status_posted_at 
  ON content_metadata(status, posted_at DESC) 
  WHERE status = 'posted';

-- Index on outcomes decision_id (should already exist)
CREATE INDEX IF NOT EXISTS idx_outcomes_decision_id 
  ON outcomes(decision_id);

-- Index on outcomes for v2 fields
CREATE INDEX IF NOT EXISTS idx_outcomes_v2_metrics 
  ON outcomes(primary_objective_score DESC, followers_gained_weighted DESC) 
  WHERE primary_objective_score IS NOT NULL;

-- Index on tweet_metrics tweet_id (should already exist)
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id 
  ON tweet_metrics(tweet_id);

-- Index on learning_posts tweet_id (should already exist as PRIMARY KEY)
-- No additional index needed

-- Add comment to view
COMMENT ON VIEW vw_learning IS 
  'Unified learning view combining content_metadata, outcomes, tweet_metrics, and learning_posts. '
  'Provides one row per posted decision with all learning-relevant data. '
  'v2 fields: followers_gained_weighted, primary_objective_score, content_slot, hook_type, cta_type, structure_type';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251205_create_vw_learning.sql completed successfully';
  RAISE NOTICE 'Created view: vw_learning';
  RAISE NOTICE 'View combines: content_metadata, outcomes, tweet_metrics, learning_posts';
END $$;


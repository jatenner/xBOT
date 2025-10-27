-- =====================================================================================
-- FORMAT STRATEGY TRACKING COLUMN
-- Purpose: Store AI-generated formatting strategies for diversity and learning
-- Date: 2025-10-27
-- Author: AI Agent (5-Dimensional Diversity System)
-- =====================================================================================

BEGIN;

-- Add format_strategy column to BASE TABLE
-- (content_metadata is a VIEW of content_generation_metadata_comprehensive)
ALTER TABLE content_generation_metadata_comprehensive 
ADD COLUMN IF NOT EXISTS format_strategy TEXT;

-- Add index for performance queries
CREATE INDEX IF NOT EXISTS idx_content_format_strategy 
ON content_generation_metadata_comprehensive(format_strategy) 
WHERE format_strategy IS NOT NULL;

-- Add index for learning queries (format + metrics combined)
CREATE INDEX IF NOT EXISTS idx_content_format_performance
ON content_generation_metadata_comprehensive(created_at DESC) 
WHERE format_strategy IS NOT NULL 
  AND actual_impressions IS NOT NULL;

-- Recreate the VIEW to include new column
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
  format_strategy  -- ✅ NEW COLUMN
FROM content_generation_metadata_comprehensive;

-- Log migration success
DO $$
BEGIN
  RAISE NOTICE '✅ Format strategy column added successfully';
  RAISE NOTICE '   Column: format_strategy (TEXT)';
  RAISE NOTICE '   Indexes: Performance tracking enabled';
  RAISE NOTICE '   View: content_metadata recreated with new column';
  RAISE NOTICE '🎨 5-Dimensional Diversity System: COMPLETE';
END $$;

COMMIT;


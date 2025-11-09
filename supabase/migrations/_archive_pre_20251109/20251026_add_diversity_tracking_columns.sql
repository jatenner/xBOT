-- =====================================================================================
-- DIVERSITY TRACKING SYSTEM - Add Topic/Angle/Tone Columns
-- Purpose: Enable rolling 10-post blacklist for content diversity
-- Date: 2025-10-26
-- Author: AI Agent (Diversity System Implementation)
-- =====================================================================================

BEGIN;

-- Add diversity tracking columns to BASE TABLE
-- (content_metadata is a VIEW of content_generation_metadata_comprehensive)

-- raw_topic: Specific topic before formatting (e.g., "NAD+ precursors", "GGT biomarker")
ALTER TABLE content_generation_metadata_comprehensive 
ADD COLUMN IF NOT EXISTS raw_topic TEXT;

-- tone: Voice/style of content (e.g., "Skeptical investigative", "Casual storytelling")
ALTER TABLE content_generation_metadata_comprehensive 
ADD COLUMN IF NOT EXISTS tone TEXT;

-- Note: 'angle' column already exists in base table
-- Note: 'topic_cluster' column already exists in base table

-- Recreate the VIEW to include new columns
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
  raw_topic,  -- ✅ NEW COLUMN
  tone        -- ✅ NEW COLUMN
FROM content_generation_metadata_comprehensive;

-- Create indexes on BASE TABLE for fast queries
CREATE INDEX IF NOT EXISTS idx_content_diversity_tracking 
ON content_generation_metadata_comprehensive(created_at DESC) 
WHERE raw_topic IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_raw_topic 
ON content_generation_metadata_comprehensive(raw_topic) 
WHERE raw_topic IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_tone 
ON content_generation_metadata_comprehensive(tone) 
WHERE tone IS NOT NULL;

-- Log migration success
DO $$
BEGIN
  RAISE NOTICE 'Diversity tracking columns added successfully';
  RAISE NOTICE 'Columns: raw_topic (TEXT), tone (TEXT)';
  RAISE NOTICE 'Indexes created for fast queries';
END $$;

COMMIT;


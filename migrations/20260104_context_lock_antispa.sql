-- Migration: Add context lock and anti-spam tracking columns
-- Date: 2026-01-04
-- Description: Support for context lock, semantic gate, and anti-spam invariants

-- Add context snapshot columns to content_generation_metadata_comprehensive
ALTER TABLE content_generation_metadata_comprehensive 
ADD COLUMN IF NOT EXISTS target_tweet_content_snapshot TEXT,
ADD COLUMN IF NOT EXISTS target_tweet_content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS context_lock_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS context_lock_similarity NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS semantic_similarity NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS anti_spam_checks JSONB;

-- Add index for fast cooldown lookups
CREATE INDEX IF NOT EXISTS idx_content_metadata_reply_cooldown 
ON content_generation_metadata_comprehensive(decision_type, status, target_username, posted_at)
WHERE decision_type = 'reply' AND status = 'posted';

CREATE INDEX IF NOT EXISTS idx_content_metadata_root_cooldown
ON content_generation_metadata_comprehensive(decision_type, status, root_tweet_id, posted_at)
WHERE decision_type = 'reply' AND status = 'posted' AND root_tweet_id IS NOT NULL;

-- Add blocked_reason enum values (extend existing)
COMMENT ON COLUMN content_generation_metadata_comprehensive.skip_reason IS 
'Reason for skip/block: context_mismatch, low_similarity, root_tweet_cooldown, author_cooldown, self_reply_blocked, hourly_rate_limit_reached, etc.';

-- Update content_metadata view to include new columns
CREATE OR REPLACE VIEW content_metadata AS
SELECT id,
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
     content_slot,
     root_tweet_id,
     original_candidate_tweet_id,
     resolved_via_root,
     guard_results,
     prompt_hash,
     selection_reason,
     structure_type,
     target_tweet_content_snapshot,
     target_tweet_content_hash,
     context_lock_verified,
     context_lock_similarity,
     semantic_similarity,
     anti_spam_checks
FROM content_generation_metadata_comprehensive;

-- Grant permissions (if using RLS)
-- ALTER TABLE content_generation_metadata_comprehensive ENABLE ROW LEVEL SECURITY;


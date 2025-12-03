-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ENHANCE EXPERT ANALYSIS WITH VISUAL DATA POINTS
-- Date: December 3, 2025
-- Purpose: Add visual data points and strategic insights to expert analysis
-- Risk: LOW - Adding new columns, not modifying existing data
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- ENHANCE: expert_tweet_analysis table
-- Add visual data points and strategic insights columns
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE expert_tweet_analysis
ADD COLUMN IF NOT EXISTS visual_data_points JSONB,
ADD COLUMN IF NOT EXISTS visual_strategic_insights JSONB;

COMMENT ON COLUMN expert_tweet_analysis.visual_data_points IS 
  'Structured visual metrics: emoji positions, counts, ratios, visual complexity, line break positions';

COMMENT ON COLUMN expert_tweet_analysis.visual_strategic_insights IS 
  'Strategic insights connecting visual data points to performance: why visual elements work, data-backed reasoning';

-- ════════════════════════════════════════════════════════════════════════════
-- NOTE: vi_format_intelligence.expert_insights structure enhancement
-- No schema change needed - JSONB structure will be enhanced in code
-- The expert_insights JSONB will include:
-- - visual_data_patterns (emoji placement, structural ratio, visual complexity)
-- - pattern_correlations (success rates, sample sizes)
-- - specific_guidance (exact positions, counts, ratios)
-- ════════════════════════════════════════════════════════════════════════════

COMMIT;


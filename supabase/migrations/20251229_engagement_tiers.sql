-- Migration: Add engagement tier classification
-- Date: 2025-12-29
-- Purpose: Track engagement tier for reply opportunities to enable performance analytics

-- Add engagement_tier column to reply_opportunities
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS engagement_tier TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier 
ON reply_opportunities(engagement_tier);

-- Add timing_window column for future timing analysis
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS timing_window TEXT;

-- Add account_size_tier column for future account analysis
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS account_size_tier TEXT;

-- Add opportunity_score_v2 for multi-dimensional scoring
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0;

-- Create index for scoring
CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 
ON reply_opportunities(opportunity_score_v2 DESC);

-- Add comment
COMMENT ON COLUMN reply_opportunities.engagement_tier IS 'Engagement tier: ULTRA_VIRAL (100K+), MEGA_VIRAL (50K+), VIRAL (25K+), TRENDING (10K+), POPULAR (5K+), MODERATE (<5K)';


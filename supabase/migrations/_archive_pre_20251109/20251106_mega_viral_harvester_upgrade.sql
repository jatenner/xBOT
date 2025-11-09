-- ═══════════════════════════════════════════════════════════════════════════════
-- MEGA-VIRAL HARVESTER UPGRADE - November 6, 2025
-- 
-- Upgrades:
-- 1. Add AI health judgment columns to reply_opportunities
-- 2. Add tier columns for TITAN/ULTRA/MEGA/SUPER/HIGH classification
-- 3. Add indexes for waterfall priority selection
-- 4. Update tier values to match new system
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. ADD AI HEALTH JUDGMENT COLUMNS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE reply_opportunities
ADD COLUMN IF NOT EXISTS health_relevance_score INTEGER CHECK (health_relevance_score >= 0 AND health_relevance_score <= 10),
ADD COLUMN IF NOT EXISTS health_category TEXT,
ADD COLUMN IF NOT EXISTS ai_judge_reason TEXT,
ADD COLUMN IF NOT EXISTS target_username TEXT,
ADD COLUMN IF NOT EXISTS target_followers INTEGER,
ADD COLUMN IF NOT EXISTS target_tweet_id TEXT,
ADD COLUMN IF NOT EXISTS target_tweet_url TEXT,
ADD COLUMN IF NOT EXISTS target_tweet_content TEXT,
ADD COLUMN IF NOT EXISTS tweet_posted_at TIMESTAMPTZ;

-- Drop old unique constraint on tweet_id if it exists, add to target_tweet_id
DO $$ 
BEGIN
  -- Make target_tweet_id unique (prevent duplicate replies)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reply_opportunities_target_tweet_id_key'
  ) THEN
    ALTER TABLE reply_opportunities ADD CONSTRAINT reply_opportunities_target_tweet_id_key UNIQUE (target_tweet_id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. UPDATE TIER SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop old tier constraint if exists
ALTER TABLE reply_opportunities DROP CONSTRAINT IF EXISTS reply_opportunities_tier_check;

-- Add new tier constraint with updated values
ALTER TABLE reply_opportunities 
ADD CONSTRAINT reply_opportunities_tier_check 
CHECK (tier IN ('TITAN', 'ULTRA', 'MEGA', 'SUPER', 'HIGH', 'golden', 'good', 'acceptable'));

COMMENT ON COLUMN reply_opportunities.tier IS 
  'Engagement tier: TITAN (250K+), ULTRA (100K+), MEGA (50K+), SUPER (25K+), HIGH (10K+). Legacy: golden, good, acceptable.';

COMMENT ON COLUMN reply_opportunities.health_relevance_score IS 
  'AI-judged health relevance score (0-10). 6+ = health-related.';

COMMENT ON COLUMN reply_opportunities.health_category IS 
  'AI-classified health category: fitness, nutrition, longevity, mental_health, supplements, protocols, medical, wellness';

COMMENT ON COLUMN reply_opportunities.ai_judge_reason IS 
  'AI explanation for health relevance judgment';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. INDEXES FOR WATERFALL PRIORITY SELECTION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for selecting by absolute likes (waterfall priority)
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_waterfall
ON reply_opportunities(like_count DESC, created_at DESC)
WHERE replied_to = FALSE;

-- Index for health-relevant opportunities
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_health
ON reply_opportunities(health_relevance_score DESC, like_count DESC)
WHERE replied_to = FALSE 
  AND health_relevance_score >= 6;

-- Index for tier-based selection (backwards compatible)
DROP INDEX IF EXISTS idx_reply_opportunities_tier;
CREATE INDEX idx_reply_opportunities_tier
ON reply_opportunities(tier, like_count DESC, created_at DESC)
WHERE replied_to = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. CLEANUP OLD DATA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Update old tier values to new system (if any exist)
-- This is a one-time migration for existing data
UPDATE reply_opportunities
SET tier = CASE
  WHEN like_count >= 250000 THEN 'TITAN'
  WHEN like_count >= 100000 THEN 'ULTRA'
  WHEN like_count >= 50000 THEN 'MEGA'
  WHEN like_count >= 25000 THEN 'SUPER'
  WHEN like_count >= 10000 THEN 'HIGH'
  ELSE tier
END
WHERE tier IN ('golden', 'good', 'acceptable') OR tier IS NULL;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check new columns exist
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'reply_opportunities' 
-- AND column_name IN ('health_relevance_score', 'health_category', 'ai_judge_reason');

-- Check tier distribution
-- SELECT tier, COUNT(*) as count
-- FROM reply_opportunities
-- GROUP BY tier
-- ORDER BY 
--   CASE tier
--     WHEN 'TITAN' THEN 1
--     WHEN 'ULTRA' THEN 2
--     WHEN 'MEGA' THEN 3
--     WHEN 'SUPER' THEN 4
--     WHEN 'HIGH' THEN 5
--     ELSE 6
--   END;


-- ═══════════════════════════════════════════════════════════════════════════════
-- REPLY OPPORTUNITIES TABLE UPGRADE
-- 
-- Adds missing columns for new 3-tier freshness harvester system
-- - Timestamp-based tracking (not minutes_ago)
-- - Tier classification (FRESH/TRENDING/VIRAL/MEGA)
-- - AI health relevance scoring
-- - Expiration tracking
-- 
-- Date: November 6, 2025
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Add new columns to reply_opportunities table
ALTER TABLE reply_opportunities 
  ADD COLUMN IF NOT EXISTS tweet_posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('FRESH', 'FRESH+', 'TRENDING', 'TRENDING+', 'VIRAL', 'VIRAL+', 'MEGA', 'MEGA+')),
  ADD COLUMN IF NOT EXISTS health_relevance_score INTEGER CHECK (health_relevance_score BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS health_category TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_to BOOLEAN DEFAULT false;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_tier 
  ON reply_opportunities(tier);

CREATE INDEX IF NOT EXISTS idx_reply_opportunities_expires 
  ON reply_opportunities(expires_at, replied_to);

CREATE INDEX IF NOT EXISTS idx_reply_opportunities_health_score 
  ON reply_opportunities(health_relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_reply_opportunities_posted_at 
  ON reply_opportunities(tweet_posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_reply_opportunities_replied_to 
  ON reply_opportunities(replied_to);

-- Update comment
COMMENT ON TABLE reply_opportunities IS 
  'Reply opportunities from 3-tier freshness harvester (FRESH/TRENDING/VIRAL/MEGA). AI-filtered for health relevance.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check new columns exist:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'reply_opportunities' 
-- AND column_name IN ('tweet_posted_at', 'tier', 'health_relevance_score', 'expires_at', 'replied_to');


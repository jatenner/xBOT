-- =====================================================================================
-- UNLIMITED REPLY SYSTEM UPGRADE
-- Removes all hardcoded limits, adds engagement rate filtering, learning system
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- UPGRADE discovered_accounts TABLE
-- =====================================================================================

-- Add quality, engagement, and learning fields
ALTER TABLE discovered_accounts 
ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(8,6),
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(6,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_replies_to_account INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS followers_gained_from_account INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scrape_priority INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS posts_per_day DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_likes INTEGER DEFAULT 0;

-- Create indexes for smart account selection
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_quality 
ON discovered_accounts(quality_score DESC, last_scraped_at ASC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_conversion 
ON discovered_accounts(conversion_rate DESC) 
WHERE followers_gained_from_account > 0;

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_priority 
ON discovered_accounts(scrape_priority DESC, last_scraped_at ASC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_engagement
ON discovered_accounts(engagement_rate DESC)
WHERE engagement_rate IS NOT NULL;

-- =====================================================================================
-- UPGRADE reply_opportunities TABLE
-- =====================================================================================

-- Add tier, engagement rate, and expiry
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(8,6),
ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('golden', 'good', 'acceptable')),
ADD COLUMN IF NOT EXISTS momentum_score DECIMAL(8,4),
ADD COLUMN IF NOT EXISTS account_followers INTEGER,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS replied_to BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reply_decision_id UUID;

-- Create indexes for smart opportunity selection (removed NOW() from WHERE clauses - not immutable)
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_tier 
ON reply_opportunities(tier DESC, momentum_score DESC, created_at DESC)
WHERE replied_to = FALSE;

CREATE INDEX IF NOT EXISTS idx_reply_opportunities_active 
ON reply_opportunities(created_at DESC)
WHERE replied_to = FALSE;

CREATE INDEX IF NOT EXISTS idx_reply_opportunities_engagement
ON reply_opportunities(engagement_rate DESC)
WHERE replied_to = FALSE AND engagement_rate IS NOT NULL;

-- =====================================================================================
-- NEW: reply_conversions TABLE (Learning System)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS reply_conversions (
  id BIGSERIAL PRIMARY KEY,
  reply_decision_id UUID NOT NULL,
  target_account TEXT NOT NULL,
  target_tweet_id TEXT NOT NULL,
  opportunity_tier TEXT NOT NULL,
  engagement_rate DECIMAL(8,6),
  
  -- Performance tracking
  reply_likes INTEGER DEFAULT 0,
  reply_retweets INTEGER DEFAULT 0,
  reply_impressions INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  followers_gained INTEGER DEFAULT 0,
  
  -- Timestamps
  replied_at TIMESTAMPTZ NOT NULL,
  measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_conversions_account 
ON reply_conversions(target_account, followers_gained DESC);

CREATE INDEX IF NOT EXISTS idx_reply_conversions_tier 
ON reply_conversions(opportunity_tier, followers_gained DESC);

CREATE INDEX IF NOT EXISTS idx_reply_conversions_decision
ON reply_conversions(reply_decision_id);

-- =====================================================================================
-- VIEWS FOR ANALYTICS
-- =====================================================================================

-- Top-performing accounts for replies
CREATE OR REPLACE VIEW top_reply_accounts AS
SELECT 
  target_account,
  COUNT(*) as total_replies,
  SUM(followers_gained) as total_followers_gained,
  AVG(followers_gained)::DECIMAL(6,2) as avg_followers_per_reply,
  AVG(engagement_rate)::DECIMAL(8,6) as avg_target_engagement,
  MAX(replied_at) as last_replied_at
FROM reply_conversions
GROUP BY target_account
HAVING COUNT(*) >= 3
ORDER BY avg_followers_per_reply DESC;

-- Performance by tier
CREATE OR REPLACE VIEW reply_performance_by_tier AS
SELECT 
  opportunity_tier,
  COUNT(*) as total_replies,
  AVG(reply_impressions)::DECIMAL(8,2) as avg_visibility,
  AVG(followers_gained)::DECIMAL(6,2) as avg_followers_gained,
  SUM(followers_gained) as total_followers_gained
FROM reply_conversions
WHERE measured_at IS NOT NULL
GROUP BY opportunity_tier
ORDER BY avg_followers_gained DESC;

-- Account quality view
CREATE OR REPLACE VIEW account_quality_report AS
SELECT 
  username,
  follower_count,
  quality_score,
  engagement_rate,
  conversion_rate,
  total_replies_to_account,
  followers_gained_from_account,
  scrape_priority,
  last_scraped_at,
  last_updated
FROM discovered_accounts
WHERE quality_score >= 50
ORDER BY scrape_priority DESC, quality_score DESC
LIMIT 100;

COMMIT;


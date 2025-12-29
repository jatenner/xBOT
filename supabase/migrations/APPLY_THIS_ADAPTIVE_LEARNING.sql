-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ADAPTIVE LEARNING SYSTEM - DATABASE MIGRATIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 
-- HOW TO APPLY:
-- 1. Go to: https://supabase.com/dashboard/project/_/sql
-- 2. Copy ALL of this file
-- 3. Paste into SQL Editor
-- 4. Click "Run" or press Cmd+Enter
-- 
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 1: ENGAGEMENT TIERS (reply_opportunities)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Add engagement tier classification
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS engagement_tier TEXT;

COMMENT ON COLUMN reply_opportunities.engagement_tier IS 
'Engagement tier: EXTREME_VIRAL (100K+), ULTRA_VIRAL (50K+), MEGA_VIRAL (25K+), VIRAL (10K+), TRENDING (5K+), POPULAR (2K+), RISING (1K+), MODERATE (<1K)';

-- Add timing window classification
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS timing_window TEXT;

COMMENT ON COLUMN reply_opportunities.timing_window IS 
'Timing window: ULTRA_FRESH (<2h), FRESH (<6h), ACTIVE (<24h), AGING (>24h)';

-- Add account size tier
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS account_size_tier TEXT;

COMMENT ON COLUMN reply_opportunities.account_size_tier IS 
'Account size tier: MEGA (1M+), LARGE (100K+), MEDIUM (10K+), SMALL (<10K)';

-- Add multi-dimensional opportunity score
ALTER TABLE reply_opportunities 
ADD COLUMN IF NOT EXISTS opportunity_score_v2 NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN reply_opportunities.opportunity_score_v2 IS 
'Multi-dimensional opportunity score (0-90): engagement + account + timing - competition';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reply_opp_engagement_tier 
ON reply_opportunities(engagement_tier);

CREATE INDEX IF NOT EXISTS idx_reply_opp_score_v2 
ON reply_opportunities(opportunity_score_v2 DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 2: PERFORMANCE ANALYTICS TABLE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Create performance analytics table
CREATE TABLE IF NOT EXISTS reply_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dimension being analyzed
  dimension_type TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  
  -- Performance metrics
  reply_count INTEGER DEFAULT 0,
  avg_followers_gained NUMERIC(10,2) DEFAULT 0,
  avg_reply_likes NUMERIC(10,2) DEFAULT 0,
  avg_impressions NUMERIC(10,2) DEFAULT 0,
  avg_profile_clicks NUMERIC(10,2) DEFAULT 0,
  
  -- Quality indicators
  confidence_score NUMERIC(5,4) DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  roi_score NUMERIC(10,2) DEFAULT 0,
  performance_tier TEXT,
  
  -- Time window
  measurement_start TIMESTAMPTZ NOT NULL,
  measurement_end TIMESTAMPTZ NOT NULL,
  
  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_perf_analytics_dimension 
ON reply_performance_analytics(dimension_type, dimension_value);

CREATE INDEX IF NOT EXISTS idx_perf_analytics_updated 
ON reply_performance_analytics(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_perf_analytics_roi 
ON reply_performance_analytics(roi_score DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_analytics_unique 
ON reply_performance_analytics(dimension_type, dimension_value, measurement_start);

-- Add comments
COMMENT ON TABLE reply_performance_analytics IS 
'Stores aggregated performance analytics for replies by various dimensions (e.g., engagement tier, generator)';

COMMENT ON COLUMN reply_performance_analytics.dimension_type IS 
'The type of metric being analyzed (e.g., engagement_tier, generator_id, account_size_tier)';

COMMENT ON COLUMN reply_performance_analytics.dimension_value IS 
'The specific value of the metric (e.g., VIRAL, ResearchSynthesizer, LARGE)';

COMMENT ON COLUMN reply_performance_analytics.roi_score IS 
'Calculated Return on Investment score: (avg_followers_gained / baseline) * 100';

COMMENT ON COLUMN reply_performance_analytics.confidence_score IS 
'Confidence in the ROI score based on sample size: sample_size / 30 (capped at 1.0)';

COMMENT ON COLUMN reply_performance_analytics.performance_tier IS 
'Qualitative rating: EXCELLENT (ROI > 200%), GOOD (150-200%), MODERATE (100-150%), POOR (<100%)';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PHASE 3: DISCOVERED ACCOUNTS ENHANCEMENT
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Add performance tracking columns
ALTER TABLE discovered_accounts 
ADD COLUMN IF NOT EXISTS avg_followers_per_reply NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN discovered_accounts.avg_followers_per_reply IS 
'Average followers gained per reply to this account (rolling average)';

ALTER TABLE discovered_accounts 
ADD COLUMN IF NOT EXISTS performance_tier TEXT;

COMMENT ON COLUMN discovered_accounts.performance_tier IS 
'Performance tier: excellent (10+ avg), good (5-10 avg), moderate (2-5 avg), poor (<2 avg)';

ALTER TABLE discovered_accounts 
ADD COLUMN IF NOT EXISTS last_high_value_reply_at TIMESTAMPTZ;

COMMENT ON COLUMN discovered_accounts.last_high_value_reply_at IS 
'Timestamp of last reply that gained 10+ followers';

ALTER TABLE discovered_accounts 
ADD COLUMN IF NOT EXISTS total_replies_count INTEGER DEFAULT 0;

COMMENT ON COLUMN discovered_accounts.total_replies_count IS 
'Total number of replies posted to this account';

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_performance 
ON discovered_accounts(performance_tier, avg_followers_per_reply DESC);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_last_success 
ON discovered_accounts(last_high_value_reply_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION QUERIES
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Uncomment these to verify migrations applied successfully:

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'reply_opportunities' 
-- AND column_name IN ('engagement_tier', 'timing_window', 'account_size_tier', 'opportunity_score_v2');

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'discovered_accounts' 
-- AND column_name IN ('avg_followers_per_reply', 'performance_tier', 'last_high_value_reply_at', 'total_replies_count');

-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_name = 'reply_performance_analytics';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- DONE!
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- After running this, your adaptive learning system will be fully activated!
-- The system will automatically start using the new columns and tables.


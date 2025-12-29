-- Migration: Performance Analytics Foundation
-- Date: 2025-12-29
-- Purpose: Track reply performance across multiple dimensions for adaptive learning

-- ============================================================================
-- REPLY PERFORMANCE ANALYTICS
-- ============================================================================
-- Aggregates performance metrics by dimension (engagement tier, account size, timing, generator)

CREATE TABLE IF NOT EXISTS reply_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dimension classification
  dimension_type TEXT NOT NULL, -- 'engagement_tier', 'account_size', 'timing_window', 'generator'
  dimension_value TEXT NOT NULL, -- 'VIRAL', '1M+', '<2h', 'ResearchSynthesizer'
  
  -- Aggregated metrics
  reply_count INTEGER DEFAULT 0,
  avg_followers_gained NUMERIC(10,2) DEFAULT 0,
  avg_reply_likes NUMERIC(10,2) DEFAULT 0,
  avg_impressions NUMERIC(10,2) DEFAULT 0,
  avg_profile_clicks NUMERIC(10,2) DEFAULT 0,
  
  -- Statistical confidence
  confidence_score NUMERIC(5,4) DEFAULT 0, -- 0.0 to 1.0 (sample_size / 30)
  sample_size INTEGER DEFAULT 0,
  
  -- ROI calculation
  roi_score NUMERIC(10,2) DEFAULT 0, -- (avg_followers / baseline) * 100
  performance_tier TEXT, -- 'excellent' (150%+), 'good' (100%+), 'moderate' (50%+), 'poor' (<50%)
  
  -- Time window for this analysis
  measurement_start TIMESTAMPTZ NOT NULL,
  measurement_end TIMESTAMPTZ NOT NULL,
  
  -- Metadata for additional context
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_perf_analytics_dimension 
ON reply_performance_analytics(dimension_type, dimension_value);

CREATE INDEX IF NOT EXISTS idx_perf_analytics_updated 
ON reply_performance_analytics(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_perf_analytics_roi 
ON reply_performance_analytics(roi_score DESC);

-- Unique constraint to prevent duplicate analytics entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_analytics_unique 
ON reply_performance_analytics(dimension_type, dimension_value, measurement_start);

-- ============================================================================
-- DISCOVERED ACCOUNTS ENHANCEMENTS
-- ============================================================================
-- Add performance tracking fields to discovered_accounts

ALTER TABLE discovered_accounts
ADD COLUMN IF NOT EXISTS avg_followers_per_reply NUMERIC(10,2) DEFAULT 0;

ALTER TABLE discovered_accounts
ADD COLUMN IF NOT EXISTS performance_tier TEXT;

ALTER TABLE discovered_accounts
ADD COLUMN IF NOT EXISTS last_high_value_reply_at TIMESTAMPTZ;

ALTER TABLE discovered_accounts
ADD COLUMN IF NOT EXISTS total_replies_count INTEGER DEFAULT 0;

-- Index for performance-based queries
CREATE INDEX IF NOT EXISTS idx_discovered_accounts_performance 
ON discovered_accounts(performance_tier, avg_followers_per_reply DESC);

CREATE INDEX IF NOT EXISTS idx_discovered_accounts_last_success 
ON discovered_accounts(last_high_value_reply_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE reply_performance_analytics IS 'Aggregated performance metrics by dimension for adaptive learning and strategy optimization';

COMMENT ON COLUMN reply_performance_analytics.dimension_type IS 'Type of dimension: engagement_tier, account_size, timing_window, generator';

COMMENT ON COLUMN reply_performance_analytics.confidence_score IS 'Statistical confidence (0-1) based on sample size, calculated as min(sample_size / 30, 1.0)';

COMMENT ON COLUMN reply_performance_analytics.roi_score IS 'Return on investment score: (avg_followers_gained / baseline) * 100, where baseline is typically 5';

COMMENT ON COLUMN discovered_accounts.avg_followers_per_reply IS 'Average followers gained per reply to this accounts tweets';

COMMENT ON COLUMN discovered_accounts.performance_tier IS 'Performance classification: excellent, good, moderate, poor';


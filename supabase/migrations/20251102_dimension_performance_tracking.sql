-- ═══════════════════════════════════════════════════════════
-- 🧠 DIMENSION PERFORMANCE TRACKING
-- ═══════════════════════════════════════════════════════════
-- Track performance for angle, tone, and format_strategy dimensions
-- Enables learning loops: generators learn what drives engagement/followers
-- Created: November 2, 2025

-- ═══════════════════════════════════════════════════════════
-- 1. ANGLE PERFORMANCE TRACKING
-- ═══════════════════════════════════════════════════════════
-- Track which angles (perspectives/approaches) perform best

CREATE TABLE IF NOT EXISTS angle_performance (
  id BIGSERIAL PRIMARY KEY,
  
  -- Angle identification
  angle TEXT NOT NULL UNIQUE,
  angle_type TEXT, -- contrarian, practical, research-focused, surprising, etc.
  
  -- Usage statistics
  times_used INTEGER DEFAULT 0,
  first_used TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  
  -- Performance metrics
  total_engagement INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  
  -- Averaged metrics (for comparison)
  avg_engagement_rate NUMERIC(10,4) DEFAULT 0,
  avg_likes NUMERIC(10,2) DEFAULT 0,
  avg_retweets NUMERIC(10,2) DEFAULT 0,
  avg_followers_gained NUMERIC(10,2) DEFAULT 0,
  
  -- Statistical confidence (higher = more reliable data)
  -- 0.0-0.3 = low confidence (1-5 uses)
  -- 0.3-0.7 = medium confidence (5-15 uses)
  -- 0.7-1.0 = high confidence (15+ uses)
  confidence_score NUMERIC(5,4) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_angle_perf_followers ON angle_performance(avg_followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_angle_perf_engagement ON angle_performance(avg_engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_angle_perf_confidence ON angle_performance(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_angle_perf_type ON angle_performance(angle_type);

COMMENT ON TABLE angle_performance IS 
  'Tracks performance of different content angles/perspectives to enable learning';

-- ═══════════════════════════════════════════════════════════
-- 2. TONE PERFORMANCE TRACKING
-- ═══════════════════════════════════════════════════════════
-- Track which tones (voice/style) perform best

CREATE TABLE IF NOT EXISTS tone_performance (
  id BIGSERIAL PRIMARY KEY,
  
  -- Tone identification
  tone TEXT NOT NULL UNIQUE,
  tone_cluster TEXT, -- conversational, technical, provocative, storytelling, etc.
  is_singular BOOLEAN DEFAULT true, -- Single voice vs compound tone
  
  -- Usage statistics
  times_used INTEGER DEFAULT 0,
  first_used TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  
  -- Performance metrics
  total_engagement INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  
  -- Averaged metrics
  avg_engagement_rate NUMERIC(10,4) DEFAULT 0,
  avg_likes NUMERIC(10,2) DEFAULT 0,
  avg_retweets NUMERIC(10,2) DEFAULT 0,
  avg_followers_gained NUMERIC(10,2) DEFAULT 0,
  
  -- Statistical confidence
  confidence_score NUMERIC(5,4) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tone_perf_followers ON tone_performance(avg_followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_tone_perf_engagement ON tone_performance(avg_engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_tone_perf_confidence ON tone_performance(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_tone_perf_cluster ON tone_performance(tone_cluster);

COMMENT ON TABLE tone_performance IS 
  'Tracks performance of different content tones/voices to enable learning';

-- ═══════════════════════════════════════════════════════════
-- 3. FORMAT STRATEGY PERFORMANCE TRACKING
-- ═══════════════════════════════════════════════════════════
-- Track which format strategies perform best

CREATE TABLE IF NOT EXISTS format_strategy_performance (
  id BIGSERIAL PRIMARY KEY,
  
  -- Strategy identification
  format_strategy TEXT NOT NULL UNIQUE,
  
  -- Usage statistics
  times_used INTEGER DEFAULT 0,
  first_used TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  
  -- Performance metrics
  total_engagement INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  
  -- Averaged metrics
  avg_engagement_rate NUMERIC(10,4) DEFAULT 0,
  avg_followers_gained NUMERIC(10,2) DEFAULT 0,
  
  -- Statistical confidence
  confidence_score NUMERIC(5,4) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_format_strat_perf_followers ON format_strategy_performance(avg_followers_gained DESC);
CREATE INDEX IF NOT EXISTS idx_format_strat_perf_engagement ON format_strategy_performance(avg_engagement_rate DESC);

COMMENT ON TABLE format_strategy_performance IS 
  'Tracks performance of different format strategies to enable learning';

-- ═══════════════════════════════════════════════════════════
-- HELPER FUNCTION: Calculate confidence score
-- ═══════════════════════════════════════════════════════════
-- Confidence increases with sample size, caps at 1.0

CREATE OR REPLACE FUNCTION calculate_confidence_score(sample_size INTEGER)
RETURNS NUMERIC(5,4) AS $$
BEGIN
  -- 0 uses = 0.0 confidence
  -- 5 uses = 0.3 confidence
  -- 15 uses = 0.7 confidence
  -- 30+ uses = 1.0 confidence
  RETURN LEAST(1.0, sample_size::NUMERIC / 30.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_confidence_score IS 
  'Calculate statistical confidence based on sample size (0.0-1.0)';

-- ═══════════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════════
-- These tables enable complete learning loops:
-- 
-- 1. After each post, update performance for angle/tone/format_strategy
-- 2. When generating new content, query these tables for top performers
-- 3. AI learns: "contrarian angles get 3x engagement"
-- 4. AI learns: "conversational tone drives 2x followers"
-- 5. System gets smarter over time
-- ═══════════════════════════════════════════════════════════


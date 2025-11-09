-- ==========================================
-- SCRAPER HEALTH TRACKING SYSTEM
-- ==========================================
-- Purpose: Track scraper performance over time
-- Enables: Health monitoring, success rate calculation, strategy analysis
-- Created: November 5, 2025

BEGIN;

-- Table: scraper_health
CREATE TABLE IF NOT EXISTS scraper_health (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  decision_id UUID,
  
  -- Extraction details
  strategy_used TEXT CHECK (strategy_used IN ('intelligent', 'fallback', 'analytics', 'public_tweet')),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  attempt_number INT NOT NULL DEFAULT 1,
  
  -- Metrics extracted (for verification)
  extracted_likes INT,
  extracted_retweets INT,
  extracted_replies INT,
  extracted_views INT,
  
  -- Performance tracking
  extraction_duration_ms INT,
  page_url TEXT,
  
  -- Timestamps
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  scraper_version TEXT DEFAULT 'bulletproof_v2'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scraper_health_scraped_at 
  ON scraper_health(scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraper_health_success 
  ON scraper_health(success);

CREATE INDEX IF NOT EXISTS idx_scraper_health_tweet_id 
  ON scraper_health(tweet_id);

CREATE INDEX IF NOT EXISTS idx_scraper_health_strategy 
  ON scraper_health(strategy_used);

-- Composite index for success rate queries
CREATE INDEX IF NOT EXISTS idx_scraper_health_success_rate 
  ON scraper_health(scraped_at DESC, success);

COMMIT;

-- ==========================================
-- ROLLBACK PLAN (if needed)
-- ==========================================
-- DROP INDEX IF EXISTS idx_scraper_health_success_rate;
-- DROP INDEX IF EXISTS idx_scraper_health_strategy;
-- DROP INDEX IF EXISTS idx_scraper_health_tweet_id;
-- DROP INDEX IF EXISTS idx_scraper_health_success;
-- DROP INDEX IF EXISTS idx_scraper_health_scraped_at;
-- DROP TABLE IF EXISTS scraper_health;


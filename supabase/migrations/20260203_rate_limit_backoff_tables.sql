-- ═══════════════════════════════════════════════════════════════════════════════
-- RATE LIMIT BACKOFF AND BUDGET TRACKING TABLES
-- 
-- Implements persistent backoff state and navigation budgets for harvesting
-- to prevent repeated 429 hits and manage daily quotas.
-- 
-- Date: February 3, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create bot_backoff_state table for persistent rate limit backoff
CREATE TABLE IF NOT EXISTS bot_backoff_state (
  key TEXT PRIMARY KEY DEFAULT 'harvest_search',
  is_blocked BOOLEAN DEFAULT false,
  blocked_until TIMESTAMPTZ,
  consecutive_429 INTEGER DEFAULT 0,
  last_429_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bot_run_counters table for daily budget tracking
CREATE TABLE IF NOT EXISTS bot_run_counters (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  nav_count INTEGER DEFAULT 0,
  search_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bot_backoff_state_key ON bot_backoff_state(key);
CREATE INDEX IF NOT EXISTS idx_bot_backoff_state_blocked_until ON bot_backoff_state(blocked_until) WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bot_run_counters_date ON bot_run_counters(date);

-- Create RPC function for incrementing budget counters atomically
CREATE OR REPLACE FUNCTION increment_budget_counter(
  p_date DATE,
  p_nav_amount INTEGER DEFAULT 0,
  p_search_amount INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO bot_run_counters (date, nav_count, search_count, updated_at)
  VALUES (p_date, p_nav_amount, p_search_amount, NOW())
  ON CONFLICT (date) DO UPDATE SET
    nav_count = bot_run_counters.nav_count + p_nav_amount,
    search_count = bot_run_counters.search_count + p_search_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE bot_backoff_state IS 'Persistent backoff state for rate-limited operations (survives deploys)';
COMMENT ON TABLE bot_run_counters IS 'Daily counters for navigation and search budgets';
COMMENT ON FUNCTION increment_budget_counter IS 'Atomically increment navigation and search budget counters';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED ACCOUNT STATS TABLE
-- 
-- Tracks per-seed performance metrics for weighted sampling
-- Enables epsilon-greedy exploration/exploitation strategy
-- 
-- Date: January 8, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create seed_account_stats table
-- Note: Foreign key to seed_accounts is optional (table may not exist yet)
CREATE TABLE IF NOT EXISTS public.seed_account_stats (
  handle TEXT PRIMARY KEY,
  scraped_count INTEGER NOT NULL DEFAULT 0,
  stored_count INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC(10, 2) DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  rolling_7d_success_rate NUMERIC(5, 4) DEFAULT 0, -- 0.0000 to 1.0000
  last_harvest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_seed_account_stats_success_rate 
  ON public.seed_account_stats(rolling_7d_success_rate DESC, last_success_at DESC NULLS LAST);

-- Add comment
COMMENT ON TABLE public.seed_account_stats IS 'Tracks per-seed performance metrics for weighted sampling. Used for epsilon-greedy exploration/exploitation.';

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED ACCOUNTS TABLE
-- 
-- Database-backed seed accounts for scalable harvesting
-- Replaces hardcoded SEED_ACCOUNTS list with dynamic DB-driven system
-- 
-- Date: January 7, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create seed_accounts table
CREATE TABLE IF NOT EXISTS public.seed_accounts (
  handle TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  category TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_seed_accounts_enabled_priority 
  ON public.seed_accounts(enabled, priority);

-- Add comment
COMMENT ON TABLE public.seed_accounts IS 'Database-backed seed accounts for scalable harvesting. Priority: lower = higher priority (10 = top-tier, 100 = filler)';

COMMIT;


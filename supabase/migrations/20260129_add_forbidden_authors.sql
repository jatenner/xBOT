-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD FORBIDDEN AUTHORS TABLE
-- 
-- Tracks authors whose tweets consistently fail accessibility checks
-- Used to skip these authors during harvesting in P1 mode
-- 
-- Date: January 29, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Create forbidden_authors table
CREATE TABLE IF NOT EXISTS forbidden_authors (
  author_handle TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  failure_count INTEGER DEFAULT 1,
  failure_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
  accessibility_status TEXT CHECK (accessibility_status IN ('forbidden', 'login_wall', 'deleted')) DEFAULT 'forbidden',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_forbidden_authors_handle ON forbidden_authors(author_handle);
CREATE INDEX IF NOT EXISTS idx_forbidden_authors_status ON forbidden_authors(accessibility_status);

-- Add comment
COMMENT ON TABLE forbidden_authors IS 'Authors whose tweets consistently fail accessibility checks (protected/deleted accounts)';

COMMIT;

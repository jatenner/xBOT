-- Migration: Add missing profile data fields to brain_accounts
-- Captures: verified status, join date, location — all visible on profile pages

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS join_date TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS location TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS pinned_tweet_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Index on verified for filtering
CREATE INDEX IF NOT EXISTS idx_brain_accounts_verified ON brain_accounts(verified) WHERE verified = true;

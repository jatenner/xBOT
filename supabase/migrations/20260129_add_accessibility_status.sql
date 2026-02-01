-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD ACCESSIBILITY STATUS TO REPLY_OPPORTUNITIES
-- 
-- Tracks accessibility status from fast probe/preflight checks
-- Prevents re-attempting forbidden/login_wall/deleted tweets
-- 
-- Date: January 29, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Add accessibility_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reply_opportunities' 
    AND column_name = 'accessibility_status'
  ) THEN
    ALTER TABLE public.reply_opportunities 
    ADD COLUMN accessibility_status TEXT CHECK (accessibility_status IN ('unknown', 'ok', 'forbidden', 'login_wall', 'deleted')) DEFAULT 'unknown';
  END IF;
END $$;

-- Add accessibility_checked_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reply_opportunities' 
    AND column_name = 'accessibility_checked_at'
  ) THEN
    ALTER TABLE public.reply_opportunities 
    ADD COLUMN accessibility_checked_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add accessibility_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reply_opportunities' 
    AND column_name = 'accessibility_reason'
  ) THEN
    ALTER TABLE public.reply_opportunities 
    ADD COLUMN accessibility_reason TEXT;
  END IF;
END $$;

-- Add discovery_source column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'reply_opportunities' 
    AND column_name = 'discovery_source'
  ) THEN
    ALTER TABLE public.reply_opportunities 
    ADD COLUMN discovery_source TEXT;
  END IF;
END $$;

-- Create index for accessibility filtering
CREATE INDEX IF NOT EXISTS idx_reply_opportunities_accessibility 
  ON reply_opportunities(accessibility_status, replied_to) 
  WHERE accessibility_status IN ('ok', 'unknown') AND replied_to = false;

COMMIT;

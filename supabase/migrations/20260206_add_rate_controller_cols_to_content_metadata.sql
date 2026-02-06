-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD RATE CONTROLLER COLUMNS TO content_metadata
--
-- In some environments content_metadata is a BASE TABLE (not a view).
-- Schema preflight expects prompt_version, strategy_id, hour_bucket, outcome_score.
-- This migration adds them to content_metadata when it is a table.
--
-- Date: February 6, 2026
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Only run if content_metadata is a table (relkind='r')
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'content_metadata' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.content_metadata
      ADD COLUMN IF NOT EXISTS prompt_version TEXT,
      ADD COLUMN IF NOT EXISTS strategy_id TEXT,
      ADD COLUMN IF NOT EXISTS hour_bucket INTEGER,
      ADD COLUMN IF NOT EXISTS outcome_score NUMERIC DEFAULT 0;

    ALTER TABLE public.content_metadata
      DROP CONSTRAINT IF EXISTS content_metadata_hour_bucket_check;
    ALTER TABLE public.content_metadata
      ADD CONSTRAINT content_metadata_hour_bucket_check
      CHECK (hour_bucket IS NULL OR (hour_bucket >= 0 AND hour_bucket <= 23));

    CREATE INDEX IF NOT EXISTS idx_content_metadata_hour_bucket
      ON public.content_metadata(hour_bucket) WHERE hour_bucket IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_content_metadata_strategy_id
      ON public.content_metadata(strategy_id) WHERE strategy_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_content_metadata_prompt_version
      ON public.content_metadata(prompt_version) WHERE prompt_version IS NOT NULL;

    RAISE NOTICE 'Added rate controller columns to content_metadata (table)';
  ELSE
    RAISE NOTICE 'content_metadata is not a table (view or missing), skipping column additions';
  END IF;
END $$;

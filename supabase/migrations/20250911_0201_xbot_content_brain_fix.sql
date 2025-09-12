-- xBot Content Brain Schema Fix - Add created_at to existing tables
-- Migration: 20250911_0201_xbot_content_brain_fix.sql
-- Purpose: Add created_at columns to tables that might have been created with ts column

BEGIN;

-- Fix api_usage table if it exists
DO $$
BEGIN
  -- Add created_at column if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='api_usage') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='api_usage' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.api_usage ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Fix content_events table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='content_events') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='content_events' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.content_events ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Fix learn_metrics table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='learn_metrics') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='learn_metrics' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.learn_metrics ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Fix decision_log table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='decision_log') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='decision_log' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.decision_log ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Fix quality_metrics table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quality_metrics') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='quality_metrics' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.quality_metrics ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Fix bandit_arms table if it exists (add created_at if missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bandit_arms') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='bandit_arms' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.bandit_arms ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Fix budget_tracking table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='budget_tracking') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='budget_tracking' AND column_name='created_at'
    ) THEN
      ALTER TABLE public.budget_tracking ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

-- Add indexes for created_at columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_content_events_created_at ON public.content_events(created_at);
CREATE INDEX IF NOT EXISTS idx_learn_metrics_created_at ON public.learn_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_decision_log_created_at ON public.decision_log(created_at);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_created_at ON public.quality_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_created_at ON public.bandit_arms(created_at);
CREATE INDEX IF NOT EXISTS idx_budget_tracking_created_at ON public.budget_tracking(created_at);

-- PostgREST schema reload notification
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Success message
SELECT 'Content Brain schema fix completed - added created_at columns where missing' as status;

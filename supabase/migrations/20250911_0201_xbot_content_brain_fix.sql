-- xBot Content Brain Schema Fix - Use created_at consistently
-- Migration: 20250911_0201_xbot_content_brain_fix.sql
-- Purpose: Fix ts column references, ensure created_at timestamptz consistency

BEGIN;

-- Ensure pgcrypto for UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) content_events: record every generated post/reply attempt
CREATE TABLE IF NOT EXISTS public.content_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,                -- 'single' | 'thread' | 'reply'
  topic text,
  format text,                       -- 'hook', 'list', 'story', ...
  model text,
  quality_score numeric(5,2),
  predicted_engagement numeric(6,2),
  actual_engagement numeric(6,2),
  meta jsonb DEFAULT '{}'::jsonb
);

-- Add created_at column if missing and drop ts if present
DO $$
BEGIN
  -- Add created_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='content_events' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.content_events ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Drop ts column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='content_events' AND column_name='ts'
  ) THEN
    -- Copy data from ts to created_at if needed
    UPDATE public.content_events SET created_at = ts WHERE created_at IS NULL;
    ALTER TABLE public.content_events DROP COLUMN ts;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_events_created_at ON public.content_events(created_at);
CREATE INDEX IF NOT EXISTS idx_content_events_kind ON public.content_events(kind);
CREATE INDEX IF NOT EXISTS idx_content_events_topic ON public.content_events(topic);

-- 2) learn_metrics: daily rates, CTR, follow conv, etc.
CREATE TABLE IF NOT EXISTS public.learn_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  window text NOT NULL,              -- 'hour','day','week'
  metric text NOT NULL,              -- 'engagement_rate','follow_conv', etc.
  value numeric(12,6) NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb
);

-- Add created_at column if missing and drop ts if present
DO $$
BEGIN
  -- Add created_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='learn_metrics' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.learn_metrics ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Drop ts column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='learn_metrics' AND column_name='ts'
  ) THEN
    -- Copy data from ts to created_at if needed
    UPDATE public.learn_metrics SET created_at = ts WHERE created_at IS NULL;
    ALTER TABLE public.learn_metrics DROP COLUMN ts;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_learn_metrics_window ON public.learn_metrics(window, created_at);
CREATE INDEX IF NOT EXISTS idx_learn_metrics_created_at ON public.learn_metrics(created_at);

-- 3) bandit_arms: Thompson Sampling for format/topic/time
CREATE TABLE IF NOT EXISTS public.bandit_arms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  arm_key text NOT NULL UNIQUE,      -- e.g. 'nutrition:single:morning'
  alpha numeric(10,4) NOT NULL DEFAULT 1.0,
  beta  numeric(10,4) NOT NULL DEFAULT 1.0,
  last_reward numeric(12,6),
  meta jsonb DEFAULT '{}'::jsonb
);

-- Add created_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='bandit_arms' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.bandit_arms ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bandit_arms_key ON public.bandit_arms(arm_key);
CREATE INDEX IF NOT EXISTS idx_bandit_arms_created_at ON public.bandit_arms(created_at);

-- 4) budget_tracking: token & $ usage
CREATE TABLE IF NOT EXISTS public.budget_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  model text,
  usd_spent numeric(10,4) NOT NULL DEFAULT 0,
  tokens_in int,
  tokens_out int,
  meta jsonb DEFAULT '{}'::jsonb
);

-- Add created_at column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='budget_tracking' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.budget_tracking ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budget_tracking_created_at ON public.budget_tracking(created_at);

-- 5) quality_metrics: gating signals per post/content
CREATE TABLE IF NOT EXISTS public.quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  content_id uuid,
  rule text NOT NULL,                 -- e.g. 'no_first_person', 'evidence_cited'
  passed boolean NOT NULL,
  score numeric(5,2),
  meta jsonb DEFAULT '{}'::jsonb
);

-- Add created_at column if missing and drop ts if present
DO $$
BEGIN
  -- Add created_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quality_metrics' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.quality_metrics ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Drop ts column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quality_metrics' AND column_name='ts'
  ) THEN
    -- Copy data from ts to created_at if needed
    UPDATE public.quality_metrics SET created_at = ts WHERE created_at IS NULL;
    ALTER TABLE public.quality_metrics DROP COLUMN ts;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quality_metrics_content ON public.quality_metrics(content_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_created_at ON public.quality_metrics(created_at);

-- 6) decision_log: runtime decisions for audit
CREATE TABLE IF NOT EXISTS public.decision_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  decision text NOT NULL,             -- 'POST_NOW', 'SKIP', 'REPLY', etc.
  reason text,
  confidence numeric(5,2),
  meta jsonb DEFAULT '{}'::jsonb
);

-- Add created_at column if missing and drop ts if present
DO $$
BEGIN
  -- Add created_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='decision_log' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.decision_log ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Drop ts column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='decision_log' AND column_name='ts'
  ) THEN
    -- Copy data from ts to created_at if needed
    UPDATE public.decision_log SET created_at = ts WHERE created_at IS NULL;
    ALTER TABLE public.decision_log DROP COLUMN ts;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decision_log_created_at ON public.decision_log(created_at);
CREATE INDEX IF NOT EXISTS idx_decision_log_decision ON public.decision_log(decision);

-- Fix API usage table to be consistent
DO $$
BEGIN
  -- Add created_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='api_usage' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.api_usage ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- Drop ts column if it exists  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='api_usage' AND column_name='ts'
  ) THEN
    -- Copy data from ts to created_at if needed
    UPDATE public.api_usage SET created_at = ts WHERE created_at IS NULL;
    ALTER TABLE public.api_usage DROP COLUMN ts;
  END IF;

  -- Drop old indexes on ts if they exist
  DROP INDEX IF EXISTS idx_api_usage_ts;
  DROP INDEX IF EXISTS idx_content_events_ts;
  DROP INDEX IF EXISTS idx_learn_metrics_ts;
  DROP INDEX IF EXISTS idx_decision_log_ts;
  DROP INDEX IF EXISTS idx_quality_metrics_ts;
END $$;

-- Enable Row Level Security on all tables
ALTER TABLE public.content_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learn_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bandit_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_log ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies
DO $$
BEGIN
    -- Drop existing policies for clean setup
    DROP POLICY IF EXISTS "allow_all_content_events" ON public.content_events;
    DROP POLICY IF EXISTS "allow_all_learn_metrics" ON public.learn_metrics;
    DROP POLICY IF EXISTS "allow_all_decision_log" ON public.decision_log;
    DROP POLICY IF EXISTS "allow_all_bandit_arms" ON public.bandit_arms;
    DROP POLICY IF EXISTS "allow_all_budget_tracking" ON public.budget_tracking;
    DROP POLICY IF EXISTS "allow_all_quality_metrics" ON public.quality_metrics;
    
    -- Create permissive policies for service operations
    CREATE POLICY "allow_all_content_events" ON public.content_events FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_learn_metrics" ON public.learn_metrics FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_decision_log" ON public.decision_log FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_bandit_arms" ON public.bandit_arms FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_budget_tracking" ON public.budget_tracking FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_quality_metrics" ON public.quality_metrics FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Grant comprehensive permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;

-- PostgREST schema reload notification
NOTIFY pgrst, 'reload schema';

-- Verification test with new schema
DO $$
DECLARE
    test_id uuid := gen_random_uuid();
    test_count INTEGER;
BEGIN
    -- Test content_events insert
    INSERT INTO public.content_events (id, kind, topic, format, model, meta)
    VALUES (
        test_id,
        'single', 
        'nutrition',
        'hook',
        'gpt-4',
        '{"test": true, "migration": "20250911_0201_xbot_content_brain_fix"}'::jsonb
    );
    
    -- Verify insert
    SELECT COUNT(*) INTO test_count 
    FROM public.content_events 
    WHERE id = test_id;
    
    IF test_count = 1 THEN
        RAISE NOTICE 'SUCCESS: Content brain schema fix verification passed (UUID: %)', test_id;
        -- Clean up test record
        DELETE FROM public.content_events WHERE id = test_id;
    ELSE
        RAISE EXCEPTION 'FAILURE: Content brain schema fix verification failed';
    END IF;
END $$;

COMMIT;

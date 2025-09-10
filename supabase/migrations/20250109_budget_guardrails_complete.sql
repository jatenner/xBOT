-- =====================================================
-- BUDGET GUARDRAILS: OpenAI Usage Log + RPC Function
-- Idempotent migration for cost tracking and budget enforcement
-- =====================================================

BEGIN;

-- 1) Create openai_usage_log table with UUID primary key
CREATE TABLE IF NOT EXISTS public.openai_usage_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  cost_tier text,
  intent text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  request_id text,
  finish_reason text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 2) Performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_created_at ON public.openai_usage_log (created_at);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_model ON public.openai_usage_log (model);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_intent ON public.openai_usage_log (intent);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_cost_usd ON public.openai_usage_log (cost_usd);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_daily ON public.openai_usage_log (date_trunc('day', created_at), cost_usd);

-- 3) Create or replace the RPC function with jsonb parameter
CREATE OR REPLACE FUNCTION public.log_openai_usage(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  -- Extract values from jsonb payload with safe defaults
  INSERT INTO public.openai_usage_log (
    model,
    cost_tier,
    intent,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    cost_usd,
    request_id,
    finish_reason,
    raw
  ) VALUES (
    COALESCE(payload->>'model', 'unknown'),
    payload->>'cost_tier',
    COALESCE(payload->>'intent', 'general'),
    COALESCE((payload->>'prompt_tokens')::integer, 0),
    COALESCE((payload->>'completion_tokens')::integer, 0),
    COALESCE((payload->>'total_tokens')::integer, 0),
    COALESCE((payload->>'cost_usd')::numeric, 0),
    payload->>'request_id',
    payload->>'finish_reason',
    COALESCE(payload->'raw', '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;
  
  RETURN inserted_id;
END;
$$;

-- 4) Grant permissions for the RPC function
GRANT EXECUTE ON FUNCTION public.log_openai_usage(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_openai_usage(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_openai_usage(jsonb) TO anon;

-- 5) Grant table permissions
GRANT SELECT, INSERT ON public.openai_usage_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.openai_usage_log TO service_role;
GRANT SELECT ON public.openai_usage_log TO anon;

-- 6) Create a view for daily cost aggregation
CREATE OR REPLACE VIEW public.openai_daily_costs AS
SELECT 
  date_trunc('day', created_at AT TIME ZONE 'UTC') as date_utc,
  model,
  intent,
  count(*) as request_count,
  sum(prompt_tokens) as total_prompt_tokens,
  sum(completion_tokens) as total_completion_tokens,
  sum(total_tokens) as total_tokens,
  sum(cost_usd) as total_cost_usd,
  avg(cost_usd) as avg_cost_per_request
FROM public.openai_usage_log
GROUP BY date_trunc('day', created_at AT TIME ZONE 'UTC'), model, intent
ORDER BY date_utc DESC, total_cost_usd DESC;

-- Grant view permissions
GRANT SELECT ON public.openai_daily_costs TO authenticated;
GRANT SELECT ON public.openai_daily_costs TO service_role;
GRANT SELECT ON public.openai_daily_costs TO anon;

-- 7) Create budget tracking table for ROI optimization
CREATE TABLE IF NOT EXISTS public.budget_roi_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  intent text NOT NULL,
  date_utc date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  engagement_score numeric(8,2) DEFAULT 0,
  followers_gained integer DEFAULT 0,
  roi_score numeric(8,4) DEFAULT 0, -- computed: (engagement + followers) / cost
  UNIQUE(intent, date_utc)
);

-- Index for ROI tracking
CREATE INDEX IF NOT EXISTS idx_budget_roi_tracking_intent_date ON public.budget_roi_tracking (intent, date_utc DESC);
CREATE INDEX IF NOT EXISTS idx_budget_roi_tracking_roi_score ON public.budget_roi_tracking (roi_score DESC);

-- Grant ROI table permissions
GRANT SELECT, INSERT, UPDATE ON public.budget_roi_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_roi_tracking TO service_role;

COMMIT;

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE '🧱 MIGRATION_APPLIED: Budget guardrails with openai_usage_log, RPC function, and ROI tracking';
END $$;

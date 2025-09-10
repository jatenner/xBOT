-- =====================================================
-- OPENAI USAGE LOG - Complete Cost Tracking Schema  
-- Auto-migration for hard budget cap enforcement
-- =====================================================

-- Create usage log table with proper constraints
CREATE TABLE IF NOT EXISTS public.openai_usage_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  cost_tier text NOT NULL,
  intent text,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  request_id text,
  finish_reason text,
  raw jsonb
);

-- Performance indexes for cost tracking queries
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_created_at ON public.openai_usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_model ON public.openai_usage_log(model);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_intent ON public.openai_usage_log(intent);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_cost_daily ON public.openai_usage_log(date_trunc('day', created_at), cost_usd);

-- RPC function for bulletproof cost logging
CREATE OR REPLACE FUNCTION public.log_openai_usage(payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id bigint;
BEGIN
  INSERT INTO public.openai_usage_log (
    model, cost_tier, intent, prompt_tokens, completion_tokens, 
    total_tokens, cost_usd, request_id, finish_reason, raw
  ) VALUES (
    COALESCE(payload->>'model', 'unknown'),
    COALESCE(payload->>'cost_tier', 'standard'),
    payload->>'intent',
    COALESCE((payload->>'prompt_tokens')::int, 0),
    COALESCE((payload->>'completion_tokens')::int, 0),
    COALESCE((payload->>'total_tokens')::int, 0),
    COALESCE((payload->>'cost_usd')::numeric, 0),
    payload->>'request_id',
    payload->>'finish_reason',
    payload->'raw'
  )
  RETURNING id INTO inserted_id;
  
  RETURN inserted_id;
END;
$$;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION public.log_openai_usage(jsonb) TO service_role;
GRANT SELECT, INSERT ON public.openai_usage_log TO service_role;

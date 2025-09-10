-- =====================================================
-- LOG OPENAI USAGE RPC FUNCTION
-- Secure function for logging OpenAI usage
-- =====================================================

BEGIN;

-- Create RPC function
CREATE OR REPLACE FUNCTION public.log_openai_usage(
  p_completion_tokens integer,
  p_cost_tier text,
  p_cost_usd numeric,
  p_finish_reason text,
  p_intent text,
  p_model text,
  p_prompt_tokens integer,
  p_raw jsonb,
  p_request_id text,
  p_total_tokens integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.openai_usage_log (
    model, cost_tier, intent,
    prompt_tokens, completion_tokens, total_tokens,
    cost_usd, request_id, finish_reason, raw
  ) VALUES (
    COALESCE(p_model, 'unknown'),
    p_cost_tier,
    p_intent,
    COALESCE(p_prompt_tokens, 0),
    COALESCE(p_completion_tokens, 0),
    COALESCE(p_total_tokens, COALESCE(p_prompt_tokens, 0) + COALESCE(p_completion_tokens, 0)),
    COALESCE(p_cost_usd, 0),
    p_request_id,
    p_finish_reason,
    COALESCE(p_raw, '{}'::jsonb)
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_openai_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.log_openai_usage TO authenticated;

COMMIT;

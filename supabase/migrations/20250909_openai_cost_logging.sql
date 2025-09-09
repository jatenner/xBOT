-- 🎯 IDEMPOTENT OPENAI COST LOGGING SCHEMA
-- Safe to re-run multiple times

BEGIN;

-- 1) Create table with all required columns
CREATE TABLE IF NOT EXISTS public.openai_usage_log (
    id                bigserial PRIMARY KEY,
    created_at        timestamptz NOT NULL DEFAULT now(),
    model             text NOT NULL,
    cost_tier         text,
    intent            text,
    prompt_tokens     integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
    completion_tokens integer NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
    total_tokens      integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
    cost_usd          numeric(12,6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
    request_id        text,
    finish_reason     text,
    raw               jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- 2) Create helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_created_at ON public.openai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_model ON public.openai_usage_log (model);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_intent ON public.openai_usage_log (intent);
CREATE INDEX IF NOT EXISTS idx_openai_usage_log_cost_tier ON public.openai_usage_log (cost_tier);

-- 3) Enable RLS (idempotent)
ALTER TABLE public.openai_usage_log ENABLE ROW LEVEL SECURITY;

-- 4) Create RLS policies (drop if exists, then recreate for idempotency)
DROP POLICY IF EXISTS "openai_usage_log_select_authenticated" ON public.openai_usage_log;
DROP POLICY IF EXISTS "openai_usage_log_insert_service_role" ON public.openai_usage_log;

CREATE POLICY "openai_usage_log_select_authenticated"
    ON public.openai_usage_log
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "openai_usage_log_insert_service_role"
    ON public.openai_usage_log
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- 5) Create RPC function with exact signature the app expects
CREATE OR REPLACE FUNCTION public.log_openai_usage(
    p_completion_tokens integer,
    p_cost_tier         text,
    p_cost_usd          numeric,
    p_finish_reason     text,
    p_intent            text,
    p_model             text,
    p_prompt_tokens     integer,
    p_raw               jsonb,
    p_request_id        text,
    p_total_tokens      integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.openai_usage_log (
        created_at,
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
        now(),
        COALESCE(p_model, 'unknown'),
        COALESCE(p_cost_tier, 'other'),
        p_intent,
        COALESCE(p_prompt_tokens, 0),
        COALESCE(p_completion_tokens, 0),
        COALESCE(p_total_tokens, 0),
        COALESCE(p_cost_usd, 0),
        p_request_id,
        p_finish_reason,
        COALESCE(p_raw, '{}'::jsonb)
    );
END;
$$;

-- 6) Grant permissions (idempotent)
GRANT SELECT ON public.openai_usage_log TO authenticated;
GRANT INSERT ON public.openai_usage_log TO service_role;
GRANT EXECUTE ON FUNCTION public.log_openai_usage(integer, text, numeric, text, text, text, integer, jsonb, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_openai_usage(integer, text, numeric, text, text, text, integer, jsonb, text, integer) TO authenticated;

COMMIT;

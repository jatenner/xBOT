-- Complete api_usage table setup for production with Transaction Pooler
-- Migration: 20250911_0001_api_usage_complete.sql
-- Compatible with: Supabase Transaction Pooler (port 6543)

-- Create api_usage table with exact schema expected by application
CREATE TABLE IF NOT EXISTS public.api_usage (
    id               BIGSERIAL PRIMARY KEY,
    intent           TEXT NOT NULL,
    model            TEXT NOT NULL,
    prompt_tokens    INTEGER DEFAULT 0 NOT NULL,
    completion_tokens INTEGER DEFAULT 0 NOT NULL,
    cost_usd         NUMERIC(12,6) DEFAULT 0 NOT NULL,
    meta             JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure meta column exists (for existing tables)
DO $$
BEGIN
    -- Add meta column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_usage' 
        AND column_name = 'meta'
    ) THEN
        ALTER TABLE public.api_usage 
        ADD COLUMN meta JSONB DEFAULT '{}'::jsonb NOT NULL;
    END IF;
END $$;

-- Create optimized indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_intent ON public.api_usage(intent);
CREATE INDEX IF NOT EXISTS idx_api_usage_model ON public.api_usage(model);
CREATE INDEX IF NOT EXISTS idx_api_usage_cost_date ON public.api_usage(DATE(created_at), cost_usd);

-- Enable Row Level Security
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean setup
DROP POLICY IF EXISTS "api_usage_all" ON public.api_usage;
DROP POLICY IF EXISTS "insert_api_usage" ON public.api_usage;
DROP POLICY IF EXISTS "select_api_usage" ON public.api_usage;
DROP POLICY IF EXISTS "api_usage_authenticated_rw" ON public.api_usage;

-- Create comprehensive policy for authenticated users
-- Service role bypasses RLS, so this is primarily for app-level access
CREATE POLICY "api_usage_all" ON public.api_usage 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Grant necessary permissions to authenticated role
GRANT ALL ON public.api_usage TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.api_usage_id_seq TO authenticated;

-- Ensure public access for service role operations
GRANT ALL ON public.api_usage TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE public.api_usage_id_seq TO PUBLIC;

-- Set table owner for consistency
ALTER TABLE public.api_usage OWNER TO postgres;
ALTER SEQUENCE public.api_usage_id_seq OWNER TO postgres;

-- Add helpful comments for documentation
COMMENT ON TABLE public.api_usage IS 'OpenAI API usage tracking for budget enforcement and analytics';
COMMENT ON COLUMN public.api_usage.intent IS 'Purpose/category of the API call (e.g., content_generation, ai_decision)';
COMMENT ON COLUMN public.api_usage.model IS 'OpenAI model used (e.g., gpt-4o-mini, gpt-4o)';
COMMENT ON COLUMN public.api_usage.cost_usd IS 'Actual cost in USD with high precision for budget tracking';
COMMENT ON COLUMN public.api_usage.meta IS 'Additional metadata as JSON (priority, optimization_data, etc.)';

-- Notify PostgREST to reload schema (Supabase specific)
-- This ensures the REST API immediately recognizes the new table
NOTIFY pgrst, 'reload schema';

-- Verification: Test table accessibility
-- This will fail gracefully if there are permission issues
DO $$
DECLARE
    test_result INTEGER;
BEGIN
    -- Test basic insert/select functionality
    INSERT INTO public.api_usage (intent, model, prompt_tokens, completion_tokens, cost_usd, meta)
    VALUES ('migration_test', 'setup', 0, 0, 0, '{"migration": "20250911_0001_api_usage_complete", "test": true}');
    
    SELECT COUNT(*) INTO test_result 
    FROM public.api_usage 
    WHERE intent = 'migration_test';
    
    IF test_result > 0 THEN
        RAISE NOTICE 'SUCCESS: api_usage table is accessible and functional';
        -- Clean up test record
        DELETE FROM public.api_usage WHERE intent = 'migration_test';
    ELSE
        RAISE EXCEPTION 'FAILURE: api_usage table test insert/select failed';
    END IF;
END $$;

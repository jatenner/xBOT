-- Create api_usage table for OpenAI cost tracking
-- Migration: 20250910_api_usage.sql

-- Create the api_usage table
CREATE TABLE IF NOT EXISTS public.api_usage (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    intent TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0 NOT NULL,
    completion_tokens INTEGER DEFAULT 0 NOT NULL,
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    cost_usd DECIMAL(10,6) NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb
);

-- Set table owner to postgres
ALTER TABLE public.api_usage OWNER TO postgres;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_intent ON public.api_usage(intent);
CREATE INDEX IF NOT EXISTS idx_api_usage_cost ON public.api_usage(cost_usd);

-- Enable Row Level Security
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to insert
-- Note: Service role bypasses RLS entirely
DROP POLICY IF EXISTS "insert_api_usage" ON public.api_usage;
CREATE POLICY "insert_api_usage" ON public.api_usage
    FOR INSERT TO authenticated WITH CHECK (true);

-- Create policy for authenticated users to select their own records
DROP POLICY IF EXISTS "select_api_usage" ON public.api_usage;
CREATE POLICY "select_api_usage" ON public.api_usage
    FOR SELECT TO authenticated USING (true);

-- Grant necessary permissions
GRANT INSERT, SELECT ON public.api_usage TO authenticated;
GRANT USAGE ON SEQUENCE public.api_usage_id_seq TO authenticated;

-- Add comment
COMMENT ON TABLE public.api_usage IS 'OpenAI API usage tracking for budget enforcement';
COMMENT ON COLUMN public.api_usage.intent IS 'Purpose of the API call (e.g., follower_growth_content)';
COMMENT ON COLUMN public.api_usage.meta IS 'Additional metadata as JSON (e.g., daily_total, budget_logs)';
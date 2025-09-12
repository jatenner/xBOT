-- 20250912_0001_api_usage.sql
-- Purpose: Create api_usage table with UUID primary key
-- Idempotent, safe to run multiple times

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create api_usage table
CREATE TABLE IF NOT EXISTS api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  cost_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  tokens_in INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS api_usage_created_at_idx ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS api_usage_provider_idx ON api_usage(provider);
CREATE INDEX IF NOT EXISTS api_usage_model_idx ON api_usage(model);

-- Enable Row Level Security
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  -- Drop existing policies to ensure clean setup
  DROP POLICY IF EXISTS "api_usage_all" ON api_usage;
  DROP POLICY IF EXISTS "api_usage_service" ON api_usage;
  
  -- Create new policies
  CREATE POLICY "api_usage_all" ON api_usage 
  FOR ALL TO authenticated
  USING (true) 
  WITH CHECK (true);

  CREATE POLICY "api_usage_service" ON api_usage 
  FOR ALL TO service_role
  USING (true) 
  WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN
  -- Ignore policy errors
END $$;

-- Grant permissions
GRANT ALL ON api_usage TO authenticated;
GRANT ALL ON api_usage TO service_role;
GRANT ALL ON api_usage TO postgres;

-- Add comments
COMMENT ON TABLE api_usage IS 'API usage tracking with cost and token information';
COMMENT ON COLUMN api_usage.provider IS 'API provider (e.g., openai, anthropic)';
COMMENT ON COLUMN api_usage.model IS 'Model name (e.g., gpt-4, claude-3)';
COMMENT ON COLUMN api_usage.cost_usd IS 'Cost in USD';
COMMENT ON COLUMN api_usage.tokens_in IS 'Input tokens count';
COMMENT ON COLUMN api_usage.tokens_out IS 'Output tokens count';
COMMENT ON COLUMN api_usage.metadata IS 'Additional metadata as JSON';

COMMIT;

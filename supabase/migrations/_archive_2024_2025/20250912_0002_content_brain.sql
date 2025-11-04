-- 20250912_0002_content_brain.sql
-- Purpose: Create content brain tables for xBOT
-- Idempotent, safe to run multiple times

BEGIN;

-- Enable UUID generation if not already present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Content events table
CREATE TABLE IF NOT EXISTS content_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,                -- generated|posted|engagement|error
  topic TEXT,
  format TEXT,                       -- single|thread|reply
  engagement NUMERIC(6,3),           -- nullable until real data
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for content_events
CREATE INDEX IF NOT EXISTS content_events_kind_idx ON content_events(kind);
CREATE INDEX IF NOT EXISTS content_events_topic_idx ON content_events(topic);
CREATE INDEX IF NOT EXISTS content_events_created_at_idx ON content_events(created_at);

-- Bandit arms table for Thompson Sampling
CREATE TABLE IF NOT EXISTS bandit_arms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arm TEXT UNIQUE NOT NULL,          -- e.g., 'nutrition:single:morning'
  alpha DOUBLE PRECISION NOT NULL DEFAULT 1,
  beta DOUBLE PRECISION NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for bandit_arms
CREATE INDEX IF NOT EXISTS bandit_arms_arm_idx ON bandit_arms(arm);
CREATE INDEX IF NOT EXISTS bandit_arms_created_at_idx ON bandit_arms(created_at);

-- Learning metrics table
CREATE TABLE IF NOT EXISTS learn_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,              -- ctr|reply_rate|bookmark_rate
  value DOUBLE PRECISION NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for learn_metrics
CREATE INDEX IF NOT EXISTS learn_metrics_metric_idx ON learn_metrics(metric);
CREATE INDEX IF NOT EXISTS learn_metrics_created_at_idx ON learn_metrics(created_at);

-- Enable Row Level Security
ALTER TABLE content_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bandit_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
  -- Create policies for content_events
  DROP POLICY IF EXISTS "content_events_all" ON content_events;
  CREATE POLICY "content_events_all" ON content_events 
  FOR ALL TO authenticated
  USING (true) 
  WITH CHECK (true);

  -- Create policies for bandit_arms
  DROP POLICY IF EXISTS "bandit_arms_all" ON bandit_arms;
  CREATE POLICY "bandit_arms_all" ON bandit_arms 
  FOR ALL TO authenticated
  USING (true) 
  WITH CHECK (true);

  -- Create policies for learn_metrics
  DROP POLICY IF EXISTS "learn_metrics_all" ON learn_metrics;
  CREATE POLICY "learn_metrics_all" ON learn_metrics 
  FOR ALL TO authenticated
  USING (true) 
  WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN
  -- Ignore policy errors
END $$;

-- Grant permissions
GRANT ALL ON content_events TO authenticated;
GRANT ALL ON content_events TO service_role;
GRANT ALL ON content_events TO postgres;

GRANT ALL ON bandit_arms TO authenticated;
GRANT ALL ON bandit_arms TO service_role;
GRANT ALL ON bandit_arms TO postgres;

GRANT ALL ON learn_metrics TO authenticated;
GRANT ALL ON learn_metrics TO service_role;
GRANT ALL ON learn_metrics TO postgres;

-- Add comments
COMMENT ON TABLE content_events IS 'Content generation and posting events';
COMMENT ON TABLE bandit_arms IS 'Thompson Sampling bandit arms for content optimization';
COMMENT ON TABLE learn_metrics IS 'Learning metrics for content performance';

-- Create helper function for bandit arm updates
CREATE OR REPLACE FUNCTION update_bandit_arm(
  p_arm TEXT,
  p_success BOOLEAN,
  p_context JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO bandit_arms (arm, alpha, beta)
  VALUES (
    p_arm,
    CASE WHEN p_success THEN 2 ELSE 1 END,  -- alpha = 2 for success, 1 for failure
    CASE WHEN p_success THEN 1 ELSE 2 END   -- beta = 1 for success, 2 for failure
  )
  ON CONFLICT (arm) DO UPDATE SET
    alpha = bandit_arms.alpha + CASE WHEN p_success THEN 1 ELSE 0 END,
    beta = bandit_arms.beta + CASE WHEN p_success THEN 0 ELSE 1 END;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Migration: Autonomous Runtime Configuration System
-- Date: 2025-06-27
-- Purpose: Add bot_config table and autonomous runtime tuning capabilities

-- Bot Config Table: Stores dynamic configuration values
CREATE TABLE IF NOT EXISTS bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for fast lookups
  CONSTRAINT bot_config_key_check CHECK (length(key) > 0)
);

CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key);
CREATE INDEX IF NOT EXISTS idx_bot_config_updated_at ON bot_config(updated_at DESC);

-- Migration History Table: Track applied migrations
CREATE TABLE IF NOT EXISTS migration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply Pending Migrations Function
CREATE OR REPLACE FUNCTION apply_pending_migrations()
RETURNS text[]
LANGUAGE plpgsql
AS $$
DECLARE
    migration_file text;
    applied_migrations text[] := '{}';
BEGIN
    -- Loop through known migration files
    FOR migration_file IN 
        SELECT unnest(ARRAY[
            '20250619_add_rejected_drafts.sql',
            '20250623_add_rejected_drafts.sql', 
            '20250625_growth_metrics.sql',
            '20250625_seed_bot_config.sql',
            '20250627_add_missing_core_tables.sql',
            '20250627_metrics_and_dashboard.sql',
            '20250627_nightly_analytics.sql',
            '20250627_autonomous_runtime_config.sql'
        ])
        WHERE NOT EXISTS (
            SELECT 1 FROM migration_history 
            WHERE filename = unnest
        )
    LOOP
        -- Insert into migration history
        INSERT INTO migration_history (filename) VALUES (migration_file);
        applied_migrations := array_append(applied_migrations, migration_file);
    END LOOP;

    RETURN applied_migrations;
END;
$$;

-- Seed default configuration values
INSERT INTO bot_config (key, value) VALUES
  ('target_tweets_per_day', '8'),
  ('min_readability', '45'),
  ('max_readability', '60'),
  ('quality_gate_consecutive_threshold', '3'),
  ('auto_adjust_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Log migration
SELECT apply_pending_migrations(); 
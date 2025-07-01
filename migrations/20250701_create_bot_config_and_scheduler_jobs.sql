-- Migration: Create bot_config and scheduler_jobs tables
-- Date: 2025-07-01
-- Purpose: Fix bot startup issues by creating required tables and seeding configuration

-- 1) Create bot_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.bot_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Create scheduler_jobs table if it doesn't exist  
CREATE TABLE IF NOT EXISTS public.scheduler_jobs (
  job_name TEXT PRIMARY KEY,
  cron     TEXT NOT NULL,
  enabled  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Seed the runtime_config with bot defaults
INSERT INTO public.bot_config (key, value)
VALUES (
  'runtime_config',
  '{"maxDailyTweets": 6, "quality": {"readabilityMin": 55, "credibilityMin": 0.85}, "fallbackStaggerMinutes": 90, "postingStrategy": "balanced"}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4) Schedule draft draining every 10 minutes
INSERT INTO public.scheduler_jobs (job_name, cron)
VALUES ('draft_drain', '*/10 * * * *')
ON CONFLICT (job_name) DO UPDATE SET cron = EXCLUDED.cron;

-- 5) Add additional essential scheduler jobs
INSERT INTO public.scheduler_jobs (job_name, cron) VALUES
  ('nightly_analytics', '0 2 * * *'),
  ('weekly_cleanup', '0 3 * * 0'),
  ('daily_metrics', '0 1 * * *')
ON CONFLICT (job_name) DO UPDATE SET cron = EXCLUDED.cron;

-- 6) Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_config_updated_at ON public.bot_config(updated_at);
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_enabled ON public.scheduler_jobs(enabled);

-- Verification query to confirm tables exist
SELECT 'Tables created successfully' as status; 
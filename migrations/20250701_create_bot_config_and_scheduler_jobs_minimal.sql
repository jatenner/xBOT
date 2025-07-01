-- Minimal Bot Configuration Migration
-- Creates essential tables for bot startup

-- Create bot_config table
CREATE TABLE IF NOT EXISTS public.bot_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Create scheduler_jobs table
CREATE TABLE IF NOT EXISTS public.scheduler_jobs (
  job_name TEXT PRIMARY KEY,
  cron TEXT NOT NULL
);

-- Add runtime configuration
INSERT INTO public.bot_config (key, value)
VALUES (
  'runtime_config',
  '{"maxDailyTweets": 6, "quality": {"readabilityMin": 55, "credibilityMin": 0.85}, "fallbackStaggerMinutes": 90, "postingStrategy": "balanced"}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add draft drain job
INSERT INTO public.scheduler_jobs (job_name, cron)
VALUES ('draft_drain', '*/10 * * * *')
ON CONFLICT (job_name) DO UPDATE SET cron = EXCLUDED.cron; 
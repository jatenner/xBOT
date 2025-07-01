-- Add Missing Columns to Existing Tables
-- Date: 2025-07-01
-- Purpose: Upgrade minimal tables to production-ready with all features

-- 1) Add missing columns to bot_config table
ALTER TABLE public.bot_config 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2) Add missing columns to scheduler_jobs table
ALTER TABLE public.scheduler_jobs
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_run TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_run TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS run_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 300,
ADD COLUMN IF NOT EXISTS retry_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100;

-- 3) Create update triggers
CREATE OR REPLACE FUNCTION update_bot_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bot_config_updated_at_trigger ON public.bot_config;
CREATE TRIGGER bot_config_updated_at_trigger
    BEFORE UPDATE ON public.bot_config
    FOR EACH ROW
    EXECUTE FUNCTION update_bot_config_updated_at();

CREATE OR REPLACE FUNCTION update_scheduler_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scheduler_jobs_updated_at_trigger ON public.scheduler_jobs;
CREATE TRIGGER scheduler_jobs_updated_at_trigger
    BEFORE UPDATE ON public.scheduler_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduler_jobs_updated_at();

-- 4) Update existing runtime_config with description
UPDATE public.bot_config 
SET description = 'Main runtime configuration for the bot',
    updated_at = NOW()
WHERE key = 'runtime_config';

-- 5) Update existing draft_drain job with details
UPDATE public.scheduler_jobs
SET description = 'Drain pending drafts every 10 minutes',
    priority = 100,
    updated_at = NOW()
WHERE job_name = 'draft_drain';

-- 6) Add additional scheduler jobs
INSERT INTO public.scheduler_jobs (job_name, cron, description, priority) VALUES
  ('nightly_analytics', '0 2 * * *', 'Run nightly analytics and optimization', 200),
  ('weekly_cleanup', '0 3 * * 0', 'Weekly database cleanup and archiving', 300),
  ('daily_metrics', '0 1 * * *', 'Calculate daily performance metrics', 150),
  ('hourly_health_check', '0 * * * *', 'Hourly system health monitoring', 50),
  ('learning_insights_update', '*/30 * * * *', 'Update learning insights every 30 minutes', 120),
  ('viral_pattern_analysis', '0 4 * * *', 'Analyze viral patterns daily', 250),
  ('competitive_intelligence', '0 6 * * *', 'Update competitive intelligence', 180),
  ('trend_monitoring', '*/15 * * * *', 'Monitor trending topics every 15 minutes', 80),
  ('engagement_optimization', '0 */2 * * *', 'Optimize engagement strategy every 2 hours', 110)
ON CONFLICT (job_name) DO UPDATE SET 
  cron = EXCLUDED.cron,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  updated_at = NOW();

-- 7) Add additional configuration entries
INSERT INTO public.bot_config (key, value, description) VALUES
  ('nuclear_learning_config', '{
    "viralPatterns": {
      "breakingNews": {"successRate": 0.89, "engagementMultiplier": 3.2},
      "hotTakes": {"successRate": 0.82, "engagementMultiplier": 2.8},
      "dataBombs": {"successRate": 0.78, "engagementMultiplier": 2.5},
      "threadStarters": {"successRate": 0.91, "engagementMultiplier": 3.5}
    },
    "adaptationSettings": {
      "learningRate": 0.1,
      "memoryWindow": 168,
      "confidenceThreshold": 0.75
    }
  }'::jsonb, 'Nuclear learning intelligence configuration'),
  
  ('api_limits_config', '{
    "twitter": {"dailyTweets": 50, "monthlyTweets": 1500},
    "openai": {"dailyTokens": 50000, "monthlyTokens": 1000000},
    "news": {"dailyRequests": 1000, "monthlyRequests": 30000},
    "images": {"dailyRequests": 100, "monthlyRequests": 3000}
  }'::jsonb, 'API usage limits and quotas'),
  
  ('growth_targets', '{
    "dailyFollowers": 50,
    "weeklyEngagement": 500,
    "monthlyViralPosts": 10,
    "quarterlyGoals": {"followers": 5000, "engagement": 50000}
  }'::jsonb, 'Growth targets and KPIs'),
  
  ('monitoring_config', '{
    "healthChecks": {
      "interval": 60,
      "endpoints": ["database", "twitter", "openai", "scheduler"],
      "alertThresholds": {"errorRate": 0.05, "responseTime": 5000}
    },
    "notifications": {
      "errorAlerts": true,
      "performanceAlerts": true,
      "growthMilestones": true
    }
  }'::jsonb, 'System monitoring and alerting configuration')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 8) Create performance indexes
CREATE INDEX IF NOT EXISTS idx_bot_config_updated_at ON public.bot_config(updated_at);
CREATE INDEX IF NOT EXISTS idx_bot_config_active ON public.bot_config(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bot_config_created_by ON public.bot_config(created_by);

CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_enabled ON public.scheduler_jobs(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_next_run ON public.scheduler_jobs(next_run) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_priority ON public.scheduler_jobs(priority, enabled);
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_last_run ON public.scheduler_jobs(last_run);
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_error_count ON public.scheduler_jobs(error_count) WHERE error_count > 0;

-- 9) Verification
SELECT 'Upgrade completed successfully' as status; 
-- Production Bot Configuration Migration
-- Date: 2025-07-01
-- Purpose: Create full production-ready tables with proper indexing and features

-- 1) Create bot_config table with full features
CREATE TABLE IF NOT EXISTS public.bot_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system',
  is_active BOOLEAN DEFAULT TRUE
);

-- 2) Create scheduler_jobs table with full features
CREATE TABLE IF NOT EXISTS public.scheduler_jobs (
  job_name TEXT PRIMARY KEY,
  cron TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  timeout_seconds INTEGER DEFAULT 300,
  retry_attempts INTEGER DEFAULT 3,
  priority INTEGER DEFAULT 100
);

-- 3) Create bot_config update trigger
CREATE OR REPLACE FUNCTION update_bot_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bot_config_updated_at_trigger
    BEFORE UPDATE ON public.bot_config
    FOR EACH ROW
    EXECUTE FUNCTION update_bot_config_updated_at();

-- 4) Create scheduler_jobs update trigger
CREATE OR REPLACE FUNCTION update_scheduler_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduler_jobs_updated_at_trigger
    BEFORE UPDATE ON public.scheduler_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_scheduler_jobs_updated_at();

-- 5) Seed the runtime_config with comprehensive defaults
INSERT INTO public.bot_config (key, value, description)
VALUES (
  'runtime_config',
  '{
    "maxDailyTweets": 6,
    "quality": {
      "readabilityMin": 55,
      "credibilityMin": 0.85,
      "engagementThreshold": 0.1
    },
    "fallbackStaggerMinutes": 90,
    "postingStrategy": "balanced",
    "contentMix": {
      "breaking_news": 25,
      "hot_takes": 20,
      "data_insights": 20,
      "trending": 15,
      "threads": 10,
      "educational": 10
    },
    "learningSettings": {
      "adaptationSpeed": "medium",
      "viralThreshold": 50,
      "engagementWindow": 24
    },
    "safetyLimits": {
      "maxAPICallsPerHour": 1000,
      "maxOpenAITokensPerDay": 50000,
      "emergencyStopThreshold": 10
    }
  }'::jsonb,
  'Main runtime configuration for the bot'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 6) Add comprehensive scheduler jobs
INSERT INTO public.scheduler_jobs (job_name, cron, description, priority) VALUES
  ('draft_drain', '*/10 * * * *', 'Drain pending drafts every 10 minutes', 100),
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

-- 7) Create performance indexes
CREATE INDEX IF NOT EXISTS idx_bot_config_updated_at ON public.bot_config(updated_at);
CREATE INDEX IF NOT EXISTS idx_bot_config_active ON public.bot_config(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bot_config_created_by ON public.bot_config(created_by);

CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_enabled ON public.scheduler_jobs(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_next_run ON public.scheduler_jobs(next_run) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_priority ON public.scheduler_jobs(priority, enabled);
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_last_run ON public.scheduler_jobs(last_run);
CREATE INDEX IF NOT EXISTS idx_scheduler_jobs_error_count ON public.scheduler_jobs(error_count) WHERE error_count > 0;

-- 8) Create additional configuration entries for nuclear learning
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
  }'::jsonb, 'Growth targets and KPIs')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 9) Add monitoring and alerting configuration
INSERT INTO public.bot_config (key, value, description) VALUES
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

-- 10) Verification query
SELECT 
  'bot_config' as table_name,
  COUNT(*) as row_count,
  ARRAY_AGG(key ORDER BY key) as config_keys
FROM public.bot_config
UNION ALL
SELECT 
  'scheduler_jobs' as table_name,
  COUNT(*) as row_count,
  ARRAY_AGG(job_name ORDER BY priority) as job_names
FROM public.scheduler_jobs; 
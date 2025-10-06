-- =====================================================
-- ESSENTIAL TABLES FOR XBOT AUTONOMOUS SYSTEM
-- Clean, minimal schema for core functionality
-- =====================================================

BEGIN;

-- 1) Posts table for content tracking
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE,
  text TEXT NOT NULL,
  format TEXT DEFAULT 'single',
  topic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  
  -- Engagement metrics
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  
  -- AI metadata
  generation_params JSONB DEFAULT '{}'::jsonb,
  quality_score DECIMAL(3,2) DEFAULT 0
);

-- 2) Learning metrics table
CREATE TABLE IF NOT EXISTS public.learn_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  reach_efficiency DECIMAL(5,4) DEFAULT 0,
  ts TIMESTAMPTZ DEFAULT NOW()
);

-- 3) OpenAI usage logging
CREATE TABLE IF NOT EXISTS public.openai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  model TEXT NOT NULL,
  cost_tier TEXT,
  intent TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd DECIMAL(12,6) DEFAULT 0,
  request_id TEXT,
  finish_reason TEXT,
  raw JSONB DEFAULT '{}'::jsonb
);

-- 4) Monitored posts for learning
CREATE TABLE IF NOT EXISTS public.monitored_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  format TEXT DEFAULT 'single',
  topic TEXT,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  quality_score DECIMAL(5,2),
  hook_type TEXT,
  persona TEXT,
  framework TEXT,
  monitoring_started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Performance indexes
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_tweet_id ON public.posts (tweet_id);
CREATE INDEX IF NOT EXISTS idx_learn_metrics_post_id ON public.learn_metrics (post_id);
CREATE INDEX IF NOT EXISTS idx_learn_metrics_ts ON public.learn_metrics (ts DESC);
CREATE INDEX IF NOT EXISTS idx_openai_usage_created_at ON public.openai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_tweet_id ON public.monitored_posts (tweet_id);

-- 6) Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learn_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_posts ENABLE ROW LEVEL SECURITY;

-- 7) Service role policies
DO $$
BEGIN
  -- Posts policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON public.posts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  -- Learn metrics policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'learn_metrics' AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON public.learn_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  -- OpenAI usage policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'openai_usage_log' AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON public.openai_usage_log FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  
  -- Monitored posts policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monitored_posts' AND policyname = 'service_role_all') THEN
    CREATE POLICY "service_role_all" ON public.monitored_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END$$;

-- 8) OpenAI logging function
CREATE OR REPLACE FUNCTION public.log_openai_usage(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.openai_usage_log (
    model, cost_tier, intent,
    prompt_tokens, completion_tokens, total_tokens,
    cost_usd, request_id, finish_reason, raw
  ) VALUES (
    payload->>'model',
    payload->>'cost_tier',
    payload->>'intent',
    COALESCE((payload->>'prompt_tokens')::integer, 0),
    COALESCE((payload->>'completion_tokens')::integer, 0),
    COALESCE((payload->>'total_tokens')::integer, 0),
    COALESCE((payload->>'cost_usd')::decimal, 0),
    payload->>'request_id',
    payload->>'finish_reason',
    payload
  ) RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- 9) Grant permissions
GRANT ALL ON public.posts TO service_role;
GRANT ALL ON public.learn_metrics TO service_role;
GRANT ALL ON public.openai_usage_log TO service_role;
GRANT ALL ON public.monitored_posts TO service_role;
GRANT EXECUTE ON FUNCTION public.log_openai_usage TO service_role;

COMMIT;

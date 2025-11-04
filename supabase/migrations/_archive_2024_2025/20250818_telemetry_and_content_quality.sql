-- xBOT Telemetry Schema Migration (2025-08-18)
-- Idempotent schema setup for tweet metrics and learning posts
-- Ensures RLS policies and service-role access

-- Create tweet_metrics table with proper structure
CREATE TABLE IF NOT EXISTS public.tweet_metrics (
  tweet_id text PRIMARY KEY,
  collected_at timestamptz DEFAULT now(),
  likes_count bigint DEFAULT 0,
  retweets_count bigint DEFAULT 0,
  replies_count bigint DEFAULT 0,
  bookmarks_count bigint DEFAULT 0,
  impressions_count bigint DEFAULT 0,
  content text
);

-- Create learning_posts table with format constraints
CREATE TABLE IF NOT EXISTS public.learning_posts (
  tweet_id text PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  format text CHECK (format IN ('single','thread')),
  likes_count bigint DEFAULT 0,
  retweets_count bigint DEFAULT 0,
  replies_count bigint DEFAULT 0,
  bookmarks_count bigint DEFAULT 0,
  impressions_count bigint DEFAULT 0,
  viral_potential_score numeric DEFAULT 0,
  content text
);

-- Add missing columns idempotently
DO $$
BEGIN
  -- tweet_metrics columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='collected_at') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN collected_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='likes_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN likes_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='retweets_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN retweets_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='replies_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN replies_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='bookmarks_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN bookmarks_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='impressions_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN impressions_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='content') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN content text;
  END IF;

  -- learning_posts columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='created_at') THEN
    ALTER TABLE public.learning_posts ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='format') THEN
    ALTER TABLE public.learning_posts ADD COLUMN format text CHECK (format IN ('single','thread'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='likes_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN likes_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='retweets_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN retweets_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='replies_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN replies_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='bookmarks_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN bookmarks_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='impressions_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN impressions_count bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='viral_potential_score') THEN
    ALTER TABLE public.learning_posts ADD COLUMN viral_potential_score numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='content') THEN
    ALTER TABLE public.learning_posts ADD COLUMN content text;
  END IF;
END$$;

-- Create backward compatibility view for legacy 'likes' column
CREATE OR REPLACE VIEW public.learning_posts_compat AS
SELECT
  tweet_id, created_at, format,
  likes_count, likes_count as likes, -- legacy alias
  retweets_count, replies_count, bookmarks_count, impressions_count,
  viral_potential_score, content
FROM public.learning_posts;

-- Enable RLS on both tables
ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_posts ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (service_role bypasses RLS anyway)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS all_tm ON public.tweet_metrics;
  DROP POLICY IF EXISTS all_lp ON public.learning_posts;
  
  -- Create new permissive policies
  CREATE POLICY all_tm ON public.tweet_metrics
    FOR ALL USING (true) WITH CHECK (true);
    
  CREATE POLICY all_lp ON public.learning_posts
    FOR ALL USING (true) WITH CHECK (true);
END$$;

-- Create useful indexes
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_collected_at ON public.tweet_metrics(collected_at);
CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at ON public.learning_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_learning_posts_format ON public.learning_posts(format);

-- Ask PostgREST to refresh its schema cache
SELECT pg_notify('pgrst', 'reload schema');

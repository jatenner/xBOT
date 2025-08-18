-- Fix production database schema to match expected column names
-- Production has different column names that need to be aligned

-- Fix tweet_metrics table - add missing columns with correct names
DO $$
BEGIN
  -- Add the columns our code expects if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='likes_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN likes_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='retweets_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN retweets_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='replies_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN replies_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='bookmarks_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN bookmarks_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='impressions_count') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN impressions_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='content') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN content text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='collected_at') THEN
    ALTER TABLE public.tweet_metrics ADD COLUMN collected_at timestamptz NOT NULL DEFAULT now();
  END IF;
END$$;

-- Fix learning_posts table - add missing columns with correct names
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='likes_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN likes_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='retweets_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN retweets_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='replies_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN replies_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='bookmarks_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN bookmarks_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='impressions_count') THEN
    ALTER TABLE public.learning_posts ADD COLUMN impressions_count bigint NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='viral_potential_score') THEN
    ALTER TABLE public.learning_posts ADD COLUMN viral_potential_score integer NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_posts' AND column_name='format') THEN
    ALTER TABLE public.learning_posts ADD COLUMN format text CHECK (format IN ('single','thread')) DEFAULT 'single';
  END IF;
END$$;

-- Copy data from existing columns to new ones if they exist
DO $$
BEGIN
  -- Copy like_count to likes_count if the old column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='like_count') THEN
    UPDATE public.tweet_metrics SET likes_count = like_count WHERE likes_count = 0;
  END IF;
  
  -- Copy retweet_count to retweets_count if the old column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='retweet_count') THEN
    UPDATE public.tweet_metrics SET retweets_count = retweet_count WHERE retweets_count = 0;
  END IF;
  
  -- Copy reply_count to replies_count if the old column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='reply_count') THEN
    UPDATE public.tweet_metrics SET replies_count = reply_count WHERE replies_count = 0;
  END IF;
  
  -- Copy impression_count to impressions_count if the old column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='impression_count') THEN
    UPDATE public.tweet_metrics SET impressions_count = impression_count WHERE impressions_count = 0;
  END IF;
  
  -- Copy captured_at to collected_at if we need to
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweet_metrics' AND column_name='captured_at') THEN
    UPDATE public.tweet_metrics SET collected_at = captured_at WHERE collected_at = '1970-01-01'::timestamptz;
  END IF;
END$$;

-- Enable RLS (idempotent)
ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_posts ENABLE ROW LEVEL SECURITY;

-- Service role policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tweet_metrics' AND policyname='service_can_all_tweet_metrics'
  ) THEN
    CREATE POLICY "service_can_all_tweet_metrics" ON public.tweet_metrics
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='learning_posts' AND policyname='service_can_all_learning_posts'
  ) THEN
    CREATE POLICY "service_can_all_learning_posts" ON public.learning_posts
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');

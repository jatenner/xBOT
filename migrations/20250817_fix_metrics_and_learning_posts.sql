-- Defensive migration to add *_count columns and backfill data
-- Ensures schema compatibility for tweet_metrics and learning_posts

-- ================================
-- TABLE: public.tweet_metrics
-- ================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.tweet_metrics (
  tweet_id TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  likes_count INT NOT NULL DEFAULT 0,
  retweets_count INT NOT NULL DEFAULT 0,
  replies_count INT NOT NULL DEFAULT 0,
  bookmarks_count INT NOT NULL DEFAULT 0,
  impressions_count BIGINT NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  CONSTRAINT tweet_metrics_pk PRIMARY KEY (tweet_id, collected_at)
);

-- Add missing columns to existing table
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS retweets_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS replies_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS bookmarks_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS impressions_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id ON public.tweet_metrics(tweet_id);

-- ================================
-- TABLE: public.learning_posts
-- ================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.learning_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tweet_id TEXT,
  format TEXT CHECK (format IN ('single','thread')),
  topic TEXT,
  viral_potential_score INT NOT NULL DEFAULT 0,
  likes_count INT NOT NULL DEFAULT 0,
  retweets_count INT NOT NULL DEFAULT 0,
  replies_count INT NOT NULL DEFAULT 0,
  bookmarks_count INT NOT NULL DEFAULT 0,
  impressions_count BIGINT NOT NULL DEFAULT 0
);

-- Add missing columns to existing table
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS retweets_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS replies_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS bookmarks_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS impressions_count BIGINT NOT NULL DEFAULT 0;

-- Backfill from legacy column names if they exist
DO $$ BEGIN
  -- learning_posts backfill
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='likes') THEN
    UPDATE public.learning_posts SET likes_count = COALESCE(likes, likes_count) WHERE likes_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='retweets') THEN
    UPDATE public.learning_posts SET retweets_count = COALESCE(retweets, retweets_count) WHERE retweets_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='replies') THEN
    UPDATE public.learning_posts SET replies_count = COALESCE(replies, replies_count) WHERE replies_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='bookmarks') THEN
    UPDATE public.learning_posts SET bookmarks_count = COALESCE(bookmarks, bookmarks_count) WHERE bookmarks_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learning_posts' AND column_name='impressions') THEN
    UPDATE public.learning_posts SET impressions_count = COALESCE(impressions, impressions_count) WHERE impressions_count = 0;
  END IF;
  
  -- tweet_metrics backfill (if legacy columns exist)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tweet_metrics' AND column_name='likes') THEN
    UPDATE public.tweet_metrics SET likes_count = COALESCE(likes, likes_count) WHERE likes_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tweet_metrics' AND column_name='retweets') THEN
    UPDATE public.tweet_metrics SET retweets_count = COALESCE(retweets, retweets_count) WHERE retweets_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tweet_metrics' AND column_name='replies') THEN
    UPDATE public.tweet_metrics SET replies_count = COALESCE(replies, replies_count) WHERE replies_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tweet_metrics' AND column_name='bookmarks') THEN
    UPDATE public.tweet_metrics SET bookmarks_count = COALESCE(bookmarks, bookmarks_count) WHERE bookmarks_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tweet_metrics' AND column_name='impressions') THEN
    UPDATE public.tweet_metrics SET impressions_count = COALESCE(impressions, impressions_count) WHERE impressions_count = 0;
  END IF;
END $$;

-- ================================
-- ROW LEVEL SECURITY
-- ================================

-- Enable RLS and permissive policies for service role
ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tweet_metrics' AND policyname='service_all') THEN
    CREATE POLICY service_all ON public.tweet_metrics
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='learning_posts' AND policyname='service_all') THEN
    CREATE POLICY service_all ON public.learning_posts
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Ask PostgREST to reload schema
SELECT pg_notify('pgrst','reload schema');

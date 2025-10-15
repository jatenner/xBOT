-- ===================================================
-- METRICS & LEARNING SCHEMA PATCH
-- Fix PostgREST schema cache errors & missing columns
-- ===================================================

-- TWEET METRICS TABLE
ALTER TABLE IF EXISTS public.tweet_metrics
  ADD COLUMN IF NOT EXISTS tweet_id            text,
  ADD COLUMN IF NOT EXISTS collected_at        timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS likes_count         bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retweets_count      bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replies_count       bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bookmarks_count     bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions_count   bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content             text;

-- Create unique index for upserts (tweet_id + timestamp)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'tweet_metrics_pk_like'
  ) THEN
    CREATE UNIQUE INDEX tweet_metrics_pk_like
      ON public.tweet_metrics (tweet_id, collected_at);
  END IF;
END$$;

-- Performance index for queries
CREATE INDEX IF NOT EXISTS tweet_metrics_collected_idx
  ON public.tweet_metrics (collected_at DESC);

-- LEARNING POSTS TABLE
ALTER TABLE IF EXISTS public.learning_posts
  ADD COLUMN IF NOT EXISTS tweet_id              text,
  ADD COLUMN IF NOT EXISTS created_at            timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS likes_count           bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retweets_count        bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replies_count         bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bookmarks_count       bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impressions_count     bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS viral_potential_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content               text,
  ADD COLUMN IF NOT EXISTS likes                 bigint DEFAULT 0; -- back-compat

-- Performance index for learning queries
CREATE INDEX IF NOT EXISTS learning_posts_tweet_idx
  ON public.learning_posts (tweet_id);

CREATE INDEX IF NOT EXISTS learning_posts_created_idx
  ON public.learning_posts (created_at DESC);

-- Performance index for viral potential analysis
CREATE INDEX IF NOT EXISTS learning_posts_viral_idx
  ON public.learning_posts (viral_potential_score DESC)
  WHERE viral_potential_score > 0;

-- ===================================================
-- RELOAD PostgREST SCHEMA CACHE
-- ===================================================
SELECT pg_notify('pgrst', 'reload schema');

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'DB_SCHEMA_MIGRATION_COMPLETE: tweet_metrics and learning_posts columns added, indexes created, PostgREST cache reloaded';
END$$;

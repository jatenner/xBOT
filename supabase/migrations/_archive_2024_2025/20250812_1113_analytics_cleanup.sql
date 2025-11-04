-- BEGIN: analytics cleanup (idempotent)
-- Fix missing tables and views that analytics code expects

-- 1. Ensure learning_posts table exists with created_at column
DO $$
BEGIN
  -- Create learning_posts table if not exists
  IF NOT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='learning_posts'
  ) THEN
     CREATE TABLE public.learning_posts (
       id            bigserial PRIMARY KEY,
       tweet_id      bigint NULL,
       content       text NULL,
       metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
       created_at    timestamptz NOT NULL DEFAULT now()
     );
     
     CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at
       ON public.learning_posts(created_at);
     CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id
       ON public.learning_posts(tweet_id);
  END IF;

  -- Add created_at column if missing
  IF NOT EXISTS (
     SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='learning_posts' AND column_name='created_at'
  ) THEN
     ALTER TABLE public.learning_posts
       ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
     
     CREATE INDEX IF NOT EXISTS idx_learning_posts_created_at
       ON public.learning_posts(created_at);
  END IF;
END $$;

-- 2. Ensure learning_insights table exists
DO $$
BEGIN
  IF NOT EXISTS (
     SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='learning_insights'
  ) THEN
     CREATE TABLE public.learning_insights (
       id            bigserial PRIMARY KEY,
       key           text UNIQUE NOT NULL,
       value         jsonb NOT NULL DEFAULT '{}'::jsonb,
       category      text NULL,
       confidence    decimal(3,2) DEFAULT 0.5,
       created_at    timestamptz NOT NULL DEFAULT now(),
       updated_at    timestamptz NOT NULL DEFAULT now()
     );
     
     CREATE INDEX IF NOT EXISTS idx_learning_insights_key
       ON public.learning_insights(key);
     CREATE INDEX IF NOT EXISTS idx_learning_insights_category
       ON public.learning_insights(category);
     CREATE INDEX IF NOT EXISTS idx_learning_insights_created_at
       ON public.learning_insights(created_at);
  END IF;
END $$;

-- 3. Create tweet_performance view that wraps vw_bandit_performance
-- This provides compatibility for code expecting tweet_performance table
CREATE OR REPLACE VIEW public.tweet_performance AS
SELECT 
  -- Map from vw_bandit_performance structure
  day as created_at,
  engine_version,
  tweets_processed,
  avg_engagement,
  total_rewards,
  bandit_updates,
  top_topics,
  best_hours,
  logged_at,
  -- Add required follower_growth column (nullable for now)
  NULL::integer AS follower_growth
FROM vw_bandit_performance
UNION ALL
-- Add compatibility rows from tweets table for recent data
SELECT 
  posted_at as created_at,
  'compatibility' as engine_version,
  1 as tweets_processed,
  COALESCE((analytics->>'engagement_rate')::decimal, 0) as avg_engagement,
  COALESCE((analytics->>'likes')::integer + (analytics->>'retweets')::integer, 0) as total_rewards,
  1 as bandit_updates,
  CASE WHEN metadata->>'topic' IS NOT NULL 
       THEN jsonb_build_array(metadata->>'topic') 
       ELSE '[]'::jsonb END as top_topics,
  '[]'::jsonb as best_hours,
  posted_at as logged_at,
  -- Calculate follower_growth from analytics if available
  COALESCE((analytics->>'follower_delta')::integer, 0) as follower_growth
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
  AND platform = 'twitter'
  AND analytics IS NOT NULL
ORDER BY created_at DESC;

-- 4. Add helpful comment for future maintenance
COMMENT ON VIEW public.tweet_performance IS 
'Compatibility view that combines vw_bandit_performance and recent tweets data. Provides follower_growth column required by analytics code.';

-- END: analytics cleanup
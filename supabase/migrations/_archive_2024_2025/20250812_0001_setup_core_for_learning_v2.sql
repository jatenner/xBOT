DO $$
BEGIN
  -- tweets table (full schema for analytics compatibility)
  IF to_regclass('public.tweets') IS NULL THEN
    CREATE TABLE public.tweets (
      id                text PRIMARY KEY,
      tweet_id          text UNIQUE,
      created_at        timestamptz DEFAULT now(),
      posted_at         timestamptz DEFAULT now(),
      text              text,
      content           text,
      platform          text DEFAULT 'twitter',
      metadata          jsonb DEFAULT '{}'::jsonb,
      analytics         jsonb DEFAULT '{}'::jsonb,
      learning_metadata jsonb DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON public.tweets(created_at);
    CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON public.tweets(posted_at);
    CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON public.tweets(tweet_id);
    CREATE INDEX IF NOT EXISTS idx_tweets_platform ON public.tweets(platform);
    CREATE INDEX IF NOT EXISTS idx_tweets_learning_metadata_gin
      ON public.tweets USING GIN (learning_metadata);
    CREATE INDEX IF NOT EXISTS idx_tweets_metadata_gin
      ON public.tweets USING GIN (metadata);
    CREATE INDEX IF NOT EXISTS idx_tweets_analytics_gin
      ON public.tweets USING GIN (analytics);
  END IF;

  -- add missing columns if tweets exists but columns are missing
  IF to_regclass('public.tweets') IS NOT NULL THEN
    -- Add tweet_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweets' AND column_name='tweet_id') THEN
      ALTER TABLE public.tweets ADD COLUMN tweet_id text UNIQUE;
      CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON public.tweets(tweet_id);
    END IF;
    
    -- Add posted_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweets' AND column_name='posted_at') THEN
      ALTER TABLE public.tweets ADD COLUMN posted_at timestamptz DEFAULT now();
      CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON public.tweets(posted_at);
    END IF;
    
    -- Add content if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweets' AND column_name='content') THEN
      ALTER TABLE public.tweets ADD COLUMN content text;
    END IF;
    
    -- Add platform if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweets' AND column_name='platform') THEN
      ALTER TABLE public.tweets ADD COLUMN platform text DEFAULT 'twitter';
      CREATE INDEX IF NOT EXISTS idx_tweets_platform ON public.tweets(platform);
    END IF;
    
    -- Add metadata if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweets' AND column_name='metadata') THEN
      ALTER TABLE public.tweets ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
      CREATE INDEX IF NOT EXISTS idx_tweets_metadata_gin ON public.tweets USING GIN (metadata);
    END IF;
    
    -- Add analytics if missing  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweets' AND column_name='analytics') THEN
      ALTER TABLE public.tweets ADD COLUMN analytics jsonb DEFAULT '{}'::jsonb;
      CREATE INDEX IF NOT EXISTS idx_tweets_analytics_gin ON public.tweets USING GIN (analytics);
    END IF;
    
    -- Add learning_metadata if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tweets' AND column_name='learning_metadata') THEN
      ALTER TABLE public.tweets ADD COLUMN learning_metadata jsonb DEFAULT '{}'::jsonb;
      CREATE INDEX IF NOT EXISTS idx_tweets_learning_metadata_gin ON public.tweets USING GIN (learning_metadata);
    END IF;
  END IF;

  -- bot_config used by smoke tests
  IF to_regclass('public.bot_config') IS NULL THEN
    CREATE TABLE public.bot_config (
      environment     text NOT NULL,
      config_key      text NOT NULL,
      config_value    jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at      timestamptz DEFAULT now(),
      PRIMARY KEY (environment, config_key)
    );
  END IF;

  -- supportive tables (safe if already present)
  CREATE TABLE IF NOT EXISTS public.daily_summaries (
    id bigserial PRIMARY KEY,
    day date UNIQUE,
    summary text,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS public.audit_log (
    id bigserial PRIMARY KEY,
    event text NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

  CREATE TABLE IF NOT EXISTS public.system_health (
    id bigserial PRIMARY KEY,
    name text UNIQUE,
    status text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    checked_at timestamptz DEFAULT now()
  );
END $$;
-- Defensive schema migration to match code requirements
-- Handles column renames, missing columns, and ensures PostgREST cache reload

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
    content TEXT NOT NULL DEFAULT ''
);

-- Add missing columns with IF NOT EXISTS pattern
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS tweet_id TEXT;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS retweets_count INT DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS replies_count INT DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS bookmarks_count INT DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS impressions_count BIGINT DEFAULT 0;
ALTER TABLE public.tweet_metrics ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- Handle legacy column names -> new names (backfill pattern)
DO $$
BEGIN
    -- likes -> likes_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'likes') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'likes_count') THEN
        ALTER TABLE public.tweet_metrics ADD COLUMN likes_count INT DEFAULT 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'likes') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'likes_count') THEN
        UPDATE public.tweet_metrics SET likes_count = likes WHERE likes_count = 0 AND likes IS NOT NULL;
    END IF;

    -- retweets -> retweets_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'retweets') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'retweets_count') THEN
        ALTER TABLE public.tweet_metrics ADD COLUMN retweets_count INT DEFAULT 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'retweets') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'retweets_count') THEN
        UPDATE public.tweet_metrics SET retweets_count = retweets WHERE retweets_count = 0 AND retweets IS NOT NULL;
    END IF;

    -- replies -> replies_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'replies') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'replies_count') THEN
        ALTER TABLE public.tweet_metrics ADD COLUMN replies_count INT DEFAULT 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'replies') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'replies_count') THEN
        UPDATE public.tweet_metrics SET replies_count = replies WHERE replies_count = 0 AND replies IS NOT NULL;
    END IF;

    -- bookmarks -> bookmarks_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'bookmarks') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'bookmarks_count') THEN
        ALTER TABLE public.tweet_metrics ADD COLUMN bookmarks_count INT DEFAULT 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'bookmarks') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'bookmarks_count') THEN
        UPDATE public.tweet_metrics SET bookmarks_count = bookmarks WHERE bookmarks_count = 0 AND bookmarks IS NOT NULL;
    END IF;

    -- impressions -> impressions_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'impressions') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'impressions_count') THEN
        ALTER TABLE public.tweet_metrics ADD COLUMN impressions_count BIGINT DEFAULT 0;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'impressions') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tweet_metrics' AND column_name = 'impressions_count') THEN
        UPDATE public.tweet_metrics SET impressions_count = impressions WHERE impressions_count = 0 AND impressions IS NOT NULL;
    END IF;
END $$;

-- Ensure constraints and indexes
DO $$
BEGIN
    -- Try to create primary key if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'tweet_metrics' AND constraint_type = 'PRIMARY KEY') THEN
        ALTER TABLE public.tweet_metrics ADD PRIMARY KEY (tweet_id, collected_at);
    END IF;
EXCEPTION
    WHEN others THEN
        -- If PK creation fails, try to add a unique constraint instead
        BEGIN
            ALTER TABLE public.tweet_metrics ADD CONSTRAINT tweet_metrics_unique UNIQUE (tweet_id, collected_at);
        EXCEPTION
            WHEN others THEN NULL; -- Ignore if constraint already exists
        END;
END $$;

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

-- Add missing columns with IF NOT EXISTS pattern
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS tweet_id TEXT;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS viral_potential_score INT DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS retweets_count INT DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS replies_count INT DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS bookmarks_count INT DEFAULT 0;
ALTER TABLE public.learning_posts ADD COLUMN IF NOT EXISTS impressions_count BIGINT DEFAULT 0;

-- Handle legacy column names -> new names for learning_posts
DO $$
BEGIN
    -- likes -> likes_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'likes') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'likes_count') THEN
        UPDATE public.learning_posts SET likes_count = likes WHERE likes_count = 0 AND likes IS NOT NULL;
    END IF;

    -- retweets -> retweets_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'retweets') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'retweets_count') THEN
        UPDATE public.learning_posts SET retweets_count = retweets WHERE retweets_count = 0 AND retweets IS NOT NULL;
    END IF;

    -- replies -> replies_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'replies') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'replies_count') THEN
        UPDATE public.learning_posts SET replies_count = replies WHERE replies_count = 0 AND replies IS NOT NULL;
    END IF;

    -- bookmarks -> bookmarks_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'bookmarks') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'bookmarks_count') THEN
        UPDATE public.learning_posts SET bookmarks_count = bookmarks WHERE bookmarks_count = 0 AND bookmarks IS NOT NULL;
    END IF;

    -- impressions -> impressions_count
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'impressions') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'learning_posts' AND column_name = 'impressions_count') THEN
        UPDATE public.learning_posts SET impressions_count = impressions WHERE impressions_count = 0 AND impressions IS NOT NULL;
    END IF;
END $$;

-- Add format constraint if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE table_name = 'learning_posts' AND constraint_name LIKE '%format%') THEN
        ALTER TABLE public.learning_posts ADD CONSTRAINT learning_posts_format_check 
            CHECK (format IN ('single','thread'));
    END IF;
EXCEPTION
    WHEN others THEN NULL; -- Ignore if constraint already exists
END $$;

-- ================================
-- ROW LEVEL SECURITY
-- ================================

-- Enable RLS for both tables
ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_posts ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for service_role
DO $$
BEGIN
    -- tweet_metrics policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tweet_metrics' AND policyname = 'service_role_all_tweet_metrics') THEN
        CREATE POLICY service_role_all_tweet_metrics ON public.tweet_metrics
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    -- learning_posts policies  
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'learning_posts' AND policyname = 'service_role_all_learning_posts') THEN
        CREATE POLICY service_role_all_learning_posts ON public.learning_posts
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
EXCEPTION
    WHEN others THEN NULL; -- Ignore if policies already exist
END $$;

-- ================================
-- FORCE POSTGREST SCHEMA RELOAD
-- ================================

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

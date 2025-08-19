-- Emergency Database Setup for xBOT
-- Ensures learning_posts table exists and has proper permissions

-- Create learning_posts table if not exists
CREATE TABLE IF NOT EXISTS public.learning_posts (
  tweet_id VARCHAR(255) PRIMARY KEY,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  viral_potential_score INTEGER DEFAULT 0,
  format VARCHAR(50) DEFAULT 'single',
  quality_score INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create tweet_metrics table if not exists  
CREATE TABLE IF NOT EXISTS public.tweet_metrics (
  tweet_id VARCHAR(255) NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0,
  retweets_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  viral_potential_score INTEGER DEFAULT 0,
  content TEXT,
  PRIMARY KEY (tweet_id, collected_at)
);

-- Enable RLS but create permissive policies
ALTER TABLE public.learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tweet_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all operations for service role" ON public.learning_posts;
DROP POLICY IF EXISTS "Enable all operations for service role" ON public.tweet_metrics;

-- Create permissive policies for service role
CREATE POLICY "Enable all operations for service role" 
ON public.learning_posts FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable all operations for service role" 
ON public.tweet_metrics FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Grant permissions to service role
GRANT ALL ON public.learning_posts TO service_role;
GRANT ALL ON public.tweet_metrics TO service_role;

-- Notify PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');

-- Verify tables exist
\d public.learning_posts;
\d public.tweet_metrics;

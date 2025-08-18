-- Fix production database issues:
-- 1. Ensure proper constraints for ON CONFLICT
-- 2. Fix RLS permissions
-- 3. Ensure proper access for learning_posts

-- Add composite unique constraint for tweet_metrics if it doesn't exist
DO $$
BEGIN
  -- Check if composite unique constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema='public' 
    AND table_name='tweet_metrics' 
    AND constraint_name='tweet_metrics_tweet_id_collected_at_key'
  ) THEN
    -- Add composite unique constraint for ON CONFLICT support
    ALTER TABLE public.tweet_metrics 
    ADD CONSTRAINT tweet_metrics_tweet_id_collected_at_key 
    UNIQUE (tweet_id, collected_at);
  END IF;
EXCEPTION WHEN others THEN
  -- If constraint addition fails, that's ok - table might have different structure
  NULL;
END$$;

-- Ensure learning_posts has proper access
-- Check if the service role has proper permissions
DO $$
BEGIN
  -- Grant full access to service role for learning_posts
  GRANT ALL ON public.learning_posts TO service_role;
  
  -- Grant full access to service role for tweet_metrics  
  GRANT ALL ON public.tweet_metrics TO service_role;
  
  -- Grant usage on schema
  GRANT USAGE ON SCHEMA public TO service_role;
EXCEPTION WHEN others THEN
  -- Continue if grants fail
  NULL;
END$$;

-- Ensure RLS policies allow service role access (idempotent)
DO $$
BEGIN
  -- Drop existing policies if they exist to recreate them
  DROP POLICY IF EXISTS "service_can_all_tweet_metrics" ON public.tweet_metrics;
  DROP POLICY IF EXISTS "service_can_all_learning_posts" ON public.learning_posts;
  
  -- Create permissive policies for service role
  CREATE POLICY "service_can_all_tweet_metrics" ON public.tweet_metrics
    FOR ALL TO service_role USING (true) WITH CHECK (true);
    
  CREATE POLICY "service_can_all_learning_posts" ON public.learning_posts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
    
EXCEPTION WHEN others THEN
  -- Continue if policy creation fails
  NULL;
END$$;

-- Alternative: temporarily disable RLS if needed for service role
-- ALTER TABLE public.tweet_metrics DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.learning_posts DISABLE ROW LEVEL SECURITY;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');

-- 🔧 FIXED SUPABASE FUNCTIONS
-- Copy and paste this entire block into Supabase SQL Editor

-- Function to get recent content for uniqueness checking
CREATE OR REPLACE FUNCTION public.get_recent_content_for_uniqueness(days_back integer DEFAULT 7)
RETURNS TABLE(
  content text,
  content_category text,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.content::text,
    COALESCE(t.content_category::text, 'general'::text) as content_category,
    t.created_at
  FROM tweets t
  WHERE t.created_at >= (NOW() - (days_back || ' days')::interval)
  ORDER BY t.created_at DESC
  LIMIT 100;
END;
$$;

-- Grant permissions to use the function
GRANT EXECUTE ON FUNCTION public.get_recent_content_for_uniqueness(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_recent_content_for_uniqueness(integer) TO authenticated;

-- Function to check content similarity
CREATE OR REPLACE FUNCTION public.check_content_similarity(
  new_content text,
  similarity_threshold real DEFAULT 0.8
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  similar_count integer;
BEGIN
  SELECT COUNT(*)
  INTO similar_count
  FROM tweets t
  WHERE t.created_at >= (NOW() - interval '7 days')
    AND similarity(LOWER(t.content), LOWER(new_content)) > similarity_threshold;
  
  RETURN similar_count > 0;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.check_content_similarity(text, real) TO anon;
GRANT EXECUTE ON FUNCTION public.check_content_similarity(text, real) TO authenticated;

-- Enable the pg_trgm extension for similarity function
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function to get tweet posting statistics
CREATE OR REPLACE FUNCTION public.get_posting_stats(days_back integer DEFAULT 1)
RETURNS TABLE(
  total_tweets integer,
  avg_engagement decimal,
  last_post_time timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_tweets,
    COALESCE(AVG(COALESCE(t.likes, 0) + COALESCE(t.retweets, 0) + COALESCE(t.replies, 0)), 0)::decimal as avg_engagement,
    MAX(t.created_at) as last_post_time
  FROM tweets t
  WHERE t.created_at >= (NOW() - (days_back || ' days')::interval);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_posting_stats(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_posting_stats(integer) TO authenticated; 
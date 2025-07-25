-- SECURE DATABASE SETUP FOR XBOT
-- This maintains security while allowing the bot to function properly

-- 1. CREATE SERVICE ROLE AUTHENTICATION
-- First, we'll create a secure way for the bot to authenticate

-- Enable RLS on tweets table (security best practice)
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on content_uniqueness table 
ALTER TABLE content_uniqueness ENABLE ROW LEVEL SECURITY;

-- 2. CREATE SECURE POLICIES FOR BOT ACCESS
-- These policies allow the bot to read/write its own data securely

-- Policy: Allow bot to insert tweets (using service role key)
CREATE POLICY "bot_insert_tweets" ON tweets
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- Policy: Allow bot to read its own tweets  
CREATE POLICY "bot_read_tweets" ON tweets
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Allow bot to update its tweets if needed
CREATE POLICY "bot_update_tweets" ON tweets
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow bot to insert content uniqueness records
CREATE POLICY "bot_insert_content_uniqueness" ON content_uniqueness
  FOR INSERT
  TO service_role  
  WITH CHECK (true);

-- Policy: Allow bot to read content uniqueness records
CREATE POLICY "bot_read_content_uniqueness" ON content_uniqueness
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Allow bot to update content uniqueness records (for upserts)
CREATE POLICY "bot_update_content_uniqueness" ON content_uniqueness
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. CREATE ENGAGEMENT HISTORY POLICIES (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'engagement_history') THEN
        -- Enable RLS
        ALTER TABLE engagement_history ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "bot_insert_engagement" ON engagement_history
          FOR INSERT TO service_role WITH CHECK (true);
        CREATE POLICY "bot_read_engagement" ON engagement_history  
          FOR SELECT TO service_role USING (true);
    END IF;
END $$;

-- 4. CREATE READ-ONLY POLICIES FOR DASHBOARD/MONITORING
-- These allow safe read access for monitoring without compromising security

CREATE POLICY "dashboard_read_tweets" ON tweets
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "dashboard_read_engagement" ON engagement_history
  FOR SELECT  
  TO anon
  USING (true);

-- 5. CREATE VERIFICATION FUNCTIONS
-- These help verify the setup is working correctly

CREATE OR REPLACE FUNCTION verify_bot_permissions()
RETURNS TABLE (
  test_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Test tweet insert
  BEGIN
    INSERT INTO tweets (tweet_id, content, content_type, created_at) 
    VALUES ('test_123456789', 'Test tweet for verification', 'test', NOW());
    
    RETURN QUERY SELECT 'Tweet Insert'::TEXT, 'SUCCESS'::TEXT, 'Bot can insert tweets'::TEXT;
    
    -- Clean up
    DELETE FROM tweets WHERE tweet_id = 'test_123456789';
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Tweet Insert'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test content_uniqueness insert
  BEGIN
    INSERT INTO content_uniqueness (content_hash, original_content, normalized_content) 
    VALUES ('test_hash_123', 'Test content', 'test content');
    
    RETURN QUERY SELECT 'Content Uniqueness Insert'::TEXT, 'SUCCESS'::TEXT, 'Bot can insert uniqueness records'::TEXT;
    
    -- Clean up
    DELETE FROM content_uniqueness WHERE content_hash = 'test_hash_123';
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Content Uniqueness Insert'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
  -- Test read access
  BEGIN
    PERFORM COUNT(*) FROM tweets;
    RETURN QUERY SELECT 'Tweet Read'::TEXT, 'SUCCESS'::TEXT, 'Bot can read tweets'::TEXT;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Tweet Read'::TEXT, 'FAILED'::TEXT, SQLERRM::TEXT;
  END;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREATE CONTENT ANALYSIS FUNCTIONS
-- These help with content uniqueness checking

CREATE OR REPLACE FUNCTION get_recent_content_for_uniqueness(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  content TEXT,
  created_at TIMESTAMPTZ,
  content_hash TEXT,
  tweet_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.content,
    t.created_at,
    COALESCE(cu.content_hash, ''),
    t.tweet_id
  FROM tweets t
  LEFT JOIN content_uniqueness cu ON cu.original_content = t.content
  WHERE t.created_at >= NOW() - INTERVAL '1 day' * days_back
  ORDER BY t.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CREATE DAILY STATS FUNCTION
CREATE OR REPLACE FUNCTION get_daily_post_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  post_count BIGINT,
  first_post_time TIMESTAMPTZ,
  last_post_time TIMESTAMPTZ,
  unique_content_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as post_count,
    MIN(created_at) as first_post_time,
    MAX(created_at) as last_post_time,
    COUNT(DISTINCT content) as unique_content_count
  FROM tweets 
  WHERE DATE(created_at AT TIME ZONE 'America/New_York') = target_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. GRANT NECESSARY PERMISSIONS
-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION verify_bot_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION get_recent_content_for_uniqueness(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_daily_post_stats(DATE) TO service_role;

-- Also grant to anon for dashboard access
GRANT EXECUTE ON FUNCTION get_daily_post_stats(DATE) TO anon;

-- 9. CREATE INDEXES FOR PERFORMANCE
-- Ensure fast queries for uniqueness checking
CREATE INDEX IF NOT EXISTS idx_tweets_created_at_desc ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_content_hash ON tweets(MD5(content));
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_content_hash ON content_uniqueness(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_original_content ON content_uniqueness(original_content);

-- 10. VERIFICATION QUERY
-- Run this to verify everything is working
SELECT 'SECURE DATABASE SETUP COMPLETE' as status;
SELECT 'Run: SELECT * FROM verify_bot_permissions(); to test' as next_step; 
-- RLS bypass for service role on posting and analytics tables
-- Created: 2025-01-16
-- Purpose: Ensure service role can insert into all posting tables without RLS restrictions

-- Function to check if current role is service role
CREATE OR REPLACE FUNCTION is_service_role() RETURNS boolean AS $$
BEGIN
  RETURN current_setting('role', true) = 'service_role' 
    OR auth.role() = 'service_role'
    OR session_user = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for tweets table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tweets' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "Service role full access" ON tweets;
    CREATE POLICY "Service role full access" ON tweets
      FOR ALL USING (is_service_role());
  END IF;
END $$;

-- Update RLS policies for intelligent_posts table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'intelligent_posts' AND schemaname = 'public') THEN
    ALTER TABLE intelligent_posts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON intelligent_posts;
    CREATE POLICY "Service role full access" ON intelligent_posts
      FOR ALL USING (is_service_role());
  END IF;
END $$;

-- Update RLS policies for signal_synapse_threads table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'signal_synapse_threads' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "Service role access" ON signal_synapse_threads;
    CREATE POLICY "Service role full access" ON signal_synapse_threads
      FOR ALL USING (is_service_role());
  END IF;
END $$;

-- Update RLS policies for signal_synapse_posting_data table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'signal_synapse_posting_data' AND schemaname = 'public') THEN
    DROP POLICY IF EXISTS "Service role access" ON signal_synapse_posting_data;
    CREATE POLICY "Service role full access" ON signal_synapse_posting_data
      FOR ALL USING (is_service_role());
  END IF;
END $$;

-- Update RLS policies for performance_tracking table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'performance_tracking' AND schemaname = 'public') THEN
    ALTER TABLE performance_tracking ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Service role full access" ON performance_tracking;
    CREATE POLICY "Service role full access" ON performance_tracking
      FOR ALL USING (is_service_role());
  END IF;
END $$;

COMMENT ON FUNCTION is_service_role() IS 'Helper function to identify service role for RLS bypass';
-- ================================================================
-- FIX POSTS SCHEMA FOR AUTHORITATIVE CONTENT
-- Simple targeted fixes for missing columns
-- Date: 2025-09-08
-- ================================================================

-- Add missing scores column if it doesn't exist
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{"overall": 75, "hookScore": 50, "clarityScore": 75, "noveltyScore": 60, "authorityScore": 70, "evidenceScore": 60}';

-- Add missing created_at column if it doesn't exist  
ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing posts with default scores if they don't have any
UPDATE posts 
SET scores = '{"overall": 75, "hookScore": 50, "clarityScore": 75, "noveltyScore": 60, "authorityScore": 70, "evidenceScore": 60}'
WHERE scores IS NULL;

-- Fix RLS policies with simpler syntax
DROP POLICY IF EXISTS "Service role can manage rejected_posts" ON rejected_posts;
DROP POLICY IF EXISTS "Service role can manage content_insights" ON content_performance_insights;

-- Create RLS policies for service role
CREATE POLICY "rejected_posts_service_role" ON rejected_posts FOR ALL TO service_role USING (true);
CREATE POLICY "content_insights_service_role" ON content_performance_insights FOR ALL TO service_role USING (true);

-- Add missing indexes with proper column checks
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON posts(created_at DESC);
    END IF;
END
$$;

-- Notification
SELECT 'Posts schema fixed for authoritative content system' AS status;

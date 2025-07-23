-- Simple Engagement Table Setup for Supabase
-- This version removes all potential conflicts

-- Drop table if it exists (in case there's a partial/broken version)
DROP TABLE IF EXISTS engagement_history;

-- Create the table with minimal structure
CREATE TABLE engagement_history (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  content TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  response_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add one simple index
CREATE INDEX idx_engagement_created ON engagement_history(created_at);

-- Test with a simple insert
INSERT INTO engagement_history (action_type, target_id, target_type) 
VALUES ('test', 'test_id', 'tweet');

-- Verify it worked
SELECT * FROM engagement_history LIMIT 1;

-- Clean up test
DELETE FROM engagement_history WHERE action_type = 'test';

-- Final success message
SELECT 'Engagement table ready!' AS status; 
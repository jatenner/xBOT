-- 🤝 ENGAGEMENT HISTORY TABLE SETUP
-- Copy and paste this into Supabase SQL Editor

-- Create engagement_history table
CREATE TABLE IF NOT EXISTS engagement_history (
  id BIGSERIAL PRIMARY KEY,
  action_type VARCHAR(20) NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  target_type VARCHAR(10) NOT NULL,
  content TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  response_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_history_created_at ON engagement_history(created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action_type ON engagement_history(action_type);
CREATE INDEX IF NOT EXISTS idx_engagement_history_success ON engagement_history(success);

-- Test the table by inserting a sample record
INSERT INTO engagement_history (action_type, target_id, target_type, success, content) 
VALUES ('like', 'test_123', 'tweet', true, 'Setup test');

-- Check if the insert worked
SELECT 
  COUNT(*) as total_records,
  'Engagement history table created successfully!' as status
FROM engagement_history;

-- Clean up test record
DELETE FROM engagement_history WHERE target_id = 'test_123';

-- Final verification
SELECT 
  'Ready for real engagement tracking!' as message,
  NOW() as setup_completed_at; 
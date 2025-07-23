-- 🤝 REAL ENGAGEMENT SYSTEM DATABASE SETUP
-- =========================================
-- Creates the engagement_history table to track all real Twitter API actions

-- Create engagement_history table for tracking real Twitter actions
CREATE TABLE IF NOT EXISTS engagement_history (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('like', 'reply', 'follow', 'retweet', 'search')),
  target_id VARCHAR(50) NOT NULL,
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('tweet', 'user')),
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
CREATE INDEX IF NOT EXISTS idx_engagement_history_target ON engagement_history(target_type, target_id);

-- Add a view for daily engagement stats
CREATE OR REPLACE VIEW daily_engagement_stats AS
SELECT 
  DATE(created_at) as date,
  action_type,
  COUNT(*) as total_actions,
  COUNT(*) FILTER (WHERE success = true) as successful_actions,
  COUNT(*) FILTER (WHERE success = false) as failed_actions,
  ROUND(
    (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)) * 100, 
    2
  ) as success_rate_percent
FROM engagement_history
GROUP BY DATE(created_at), action_type
ORDER BY date DESC, action_type;

-- Log the setup
INSERT INTO system_logs (action, data, source) VALUES 
  ('real_engagement_system_setup', 
   '{"table": "engagement_history", "indexes": 4, "view": "daily_engagement_stats"}', 
   'migration');

-- Display setup completion
SELECT 
  'Real Engagement System Setup Complete!' as status,
  'engagement_history table created with proper constraints and indexes' as description; 
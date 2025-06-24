-- Simple engagement_history table creation (no conflicts)
CREATE TABLE IF NOT EXISTS engagement_history (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(20) NOT NULL,
  tweet_id VARCHAR(50),
  user_id VARCHAR(50),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- Add constraint after table creation
ALTER TABLE engagement_history 
DROP CONSTRAINT IF EXISTS engagement_history_action_type_check;

ALTER TABLE engagement_history 
ADD CONSTRAINT engagement_history_action_type_check 
CHECK (action_type IN ('like', 'reply', 'follow', 'retweet'));

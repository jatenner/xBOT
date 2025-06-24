-- Create engagement_history table to track all bot engagement actions
CREATE TABLE IF NOT EXISTS engagement_history (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('like', 'reply', 'follow', 'retweet')),
  tweet_id VARCHAR(50),
  user_id VARCHAR(50),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_action_type ON engagement_history(action_type);
CREATE INDEX IF NOT EXISTS idx_engagement_created_at ON engagement_history(created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_tweet_id ON engagement_history(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_user_id ON engagement_history(user_id);

-- Add comments for documentation
COMMENT ON TABLE engagement_history IS 'Tracks all bot engagement actions (likes, replies, follows, retweets)';
COMMENT ON COLUMN engagement_history.action_type IS 'Type of engagement: like, reply, follow, retweet';
COMMENT ON COLUMN engagement_history.tweet_id IS 'Twitter tweet ID (null for follows)';
COMMENT ON COLUMN engagement_history.user_id IS 'Twitter user ID being engaged with';
COMMENT ON COLUMN engagement_history.content IS 'Content of reply (null for likes/follows/retweets)';
COMMENT ON COLUMN engagement_history.success IS 'Whether the engagement action succeeded';
COMMENT ON COLUMN engagement_history.error_message IS 'Error message if action failed'; 
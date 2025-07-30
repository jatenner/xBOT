-- ===================================================================
-- 🔧 FIX REMAINING DATABASE COLUMNS - COMPLETE SOLUTION
-- ===================================================================
-- Adds the missing has_call_to_action and tweet_data columns
-- ===================================================================

-- Add missing has_call_to_action column to learning_posts table
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS has_call_to_action BOOLEAN DEFAULT FALSE;

-- Add missing tweet_data column to tweets table
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_data JSONB DEFAULT '{}';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_learning_posts_has_call_to_action ON learning_posts(has_call_to_action);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_data ON tweets USING GIN(tweet_data);

-- Add comments for documentation
COMMENT ON COLUMN learning_posts.has_call_to_action IS 'Whether the tweet contains a call to action';
COMMENT ON COLUMN tweets.tweet_data IS 'Complete tweet metadata and performance data as JSON';

-- Success message
SELECT 
  'All missing database columns fixed!' as status,
  'has_call_to_action and tweet_data columns added' as details,
  NOW() as fixed_at;
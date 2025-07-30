-- ===================================================================
-- 🔧 FIX MISSING DATABASE COLUMNS - WORKING VERSION
-- ===================================================================
-- Adds missing bandit_confidence and posted columns (fixed to work with your exact system)
-- ===================================================================

-- Add missing bandit_confidence column to learning_posts table
ALTER TABLE learning_posts ADD COLUMN IF NOT EXISTS bandit_confidence REAL DEFAULT 0.5;

-- Add missing posted column to tweets table  
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted BOOLEAN DEFAULT TRUE;

-- Update existing tweets to have posted=true where null
UPDATE tweets SET posted = TRUE WHERE posted IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweets_posted ON tweets(posted);
CREATE INDEX IF NOT EXISTS idx_learning_posts_bandit_confidence ON learning_posts(bandit_confidence);

-- Add comments for documentation
COMMENT ON COLUMN learning_posts.bandit_confidence IS 'Confidence score from bandit learning algorithm (0.0-1.0)';
COMMENT ON COLUMN tweets.posted IS 'Whether the tweet was successfully posted to Twitter';

-- Success message
SELECT 
  'Missing columns fix completed successfully!' as status,
  'bandit_confidence and posted columns added' as details,
  NOW() as fixed_at;
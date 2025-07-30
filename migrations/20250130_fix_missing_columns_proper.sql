-- ===================================================================
-- 🔧 FIX MISSING DATABASE COLUMNS - PROPER MIGRATION 
-- ===================================================================
-- Adds missing bandit_confidence and posted columns using your established pattern
-- Date: 2025-01-30
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

-- Log the migration
INSERT INTO system_logs (action, source, data) VALUES 
('missing_columns_fix', 'migration_20250130', jsonb_build_object(
  'columns_added', ARRAY['learning_posts.bandit_confidence', 'tweets.posted'],
  'indexes_created', ARRAY['idx_tweets_posted', 'idx_learning_posts_bandit_confidence'],
  'migration_date', NOW()::text
))
ON CONFLICT DO NOTHING;

-- Success message
SELECT 
  'Missing columns fix completed successfully!' as status,
  'bandit_confidence and posted columns added' as details;
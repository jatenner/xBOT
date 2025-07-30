-- Fix missing database columns causing storage errors
-- Date: 2025-01-30

-- Add missing bandit_confidence column to learning_posts table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_posts' AND column_name = 'bandit_confidence'
    ) THEN
        ALTER TABLE learning_posts ADD COLUMN bandit_confidence REAL DEFAULT 0.5;
        COMMENT ON COLUMN learning_posts.bandit_confidence IS 'Confidence score from bandit learning algorithm';
    END IF;
END $$;

-- Add missing posted column to tweets table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'posted'
    ) THEN
        ALTER TABLE tweets ADD COLUMN posted BOOLEAN DEFAULT TRUE;
        COMMENT ON COLUMN tweets.posted IS 'Whether the tweet was successfully posted to Twitter';
    END IF;
END $$;

-- Update existing tweets to have posted=true if they don't have the column yet
UPDATE tweets SET posted = TRUE WHERE posted IS NULL;

-- Create index for better performance on posted column
CREATE INDEX IF NOT EXISTS idx_tweets_posted ON tweets(posted);
CREATE INDEX IF NOT EXISTS idx_learning_posts_bandit_confidence ON learning_posts(bandit_confidence);

-- Log the changes
INSERT INTO migrations_log (migration_name, executed_at, description) 
VALUES ('20250130_fix_missing_columns', NOW(), 'Added missing bandit_confidence and posted columns')
ON CONFLICT (migration_name) DO NOTHING;
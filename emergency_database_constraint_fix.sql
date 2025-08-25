-- EMERGENCY DATABASE CONSTRAINT FIX
-- Fixes: "there is no unique or exclusion constraint matching the ON CONFLICT specification"

-- Add unique constraint to tweet_analytics table for ON CONFLICT handling
ALTER TABLE tweet_analytics 
ADD CONSTRAINT IF NOT EXISTS unique_tweet_id UNIQUE (tweet_id);

-- Add unique constraint to tweet_metrics table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tweet_metrics') THEN
        ALTER TABLE tweet_metrics 
        ADD CONSTRAINT IF NOT EXISTS unique_tweet_metrics_id UNIQUE (tweet_id);
    END IF;
END $$;

-- Add unique constraint to learning_posts table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_posts') THEN
        ALTER TABLE learning_posts 
        ADD CONSTRAINT IF NOT EXISTS unique_learning_post_id UNIQUE (tweet_id);
    END IF;
END $$;

-- Verify constraints were added
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name IN ('tweet_analytics', 'tweet_metrics', 'learning_posts')
AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name;
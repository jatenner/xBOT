-- Fix missing predicted_engagement column in learning_posts table
-- Date: 2025-02-01
-- Purpose: Add predicted_engagement column that the adaptive posting system requires

-- Add the missing predicted_engagement column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_posts' 
        AND column_name = 'predicted_engagement'
    ) THEN
        ALTER TABLE learning_posts ADD COLUMN predicted_engagement DECIMAL(5,4) DEFAULT 0;
        COMMENT ON COLUMN learning_posts.predicted_engagement IS 'AI-predicted engagement rate (0.0-1.0)';
    END IF;
END $$;

-- Also add decision_trace column if missing (for debugging)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_posts' 
        AND column_name = 'decision_trace'
    ) THEN
        ALTER TABLE learning_posts ADD COLUMN decision_trace JSONB DEFAULT '{}';
        COMMENT ON COLUMN learning_posts.decision_trace IS 'Detailed decision-making trace for debugging';
    END IF;
END $$;

-- Fix tweets table to accept string tweet IDs instead of integers
DO $$ 
BEGIN
    -- Check if tweet_id is currently integer type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' 
        AND column_name = 'tweet_id' 
        AND data_type = 'integer'
    ) THEN
        -- Drop the primary key constraint first
        ALTER TABLE tweets DROP CONSTRAINT IF EXISTS tweets_pkey;
        
        -- Change tweet_id to VARCHAR to handle string IDs like composer_reset_*
        ALTER TABLE tweets ALTER COLUMN tweet_id TYPE VARCHAR(255);
        
        -- Re-add primary key constraint
        ALTER TABLE tweets ADD PRIMARY KEY (tweet_id);
        
        COMMENT ON COLUMN tweets.tweet_id IS 'Tweet ID - can be numeric or string (e.g., composer_reset_*)';
    END IF;
END $$;

-- Update migration history
INSERT INTO migration_history (filename, applied_at, notes) 
VALUES (
    '20250201_fix_learning_posts_column.sql',
    NOW(),
    'Added predicted_engagement column and fixed tweet_id type'
) ON CONFLICT (filename) DO NOTHING;
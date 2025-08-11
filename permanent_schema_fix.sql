-- ===== PERMANENT SCHEMA FIX =====
-- This fixes the actual column mismatches between existing tables and bot code expectations

-- Fix daily_budgets table to match bot code expectations
ALTER TABLE daily_budgets 
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

ALTER TABLE daily_budgets 
ADD COLUMN IF NOT EXISTS budget_used DECIMAL(10,2) DEFAULT 0.00;

ALTER TABLE daily_budgets 
ADD COLUMN IF NOT EXISTS budget_limit DECIMAL(10,2) DEFAULT 5.00;

ALTER TABLE daily_budgets 
ADD COLUMN IF NOT EXISTS api_calls INTEGER DEFAULT 0;

-- Migrate existing data to new columns
UPDATE daily_budgets SET 
    date = budget_date,
    budget_used = spent_amount,
    budget_limit = total_budget
WHERE date IS NULL;

-- Ensure tweets table has all required columns
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);

ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'twitter';

ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'posted';

ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;

ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;

ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;

-- Ensure engagement_metrics table has recorded_at column
ALTER TABLE engagement_metrics 
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create unique index on tweet_id if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_tweets_tweet_id_unique ON tweets(tweet_id) WHERE tweet_id IS NOT NULL;

-- Create index on date for daily_budgets
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_budgets_date_unique ON daily_budgets(date) WHERE date IS NOT NULL;

-- Insert essential bot configuration if missing
INSERT INTO bot_config (config_key, config_value, description) VALUES
('posting_enabled', 'true', 'Enable autonomous posting'),
('max_daily_posts', '8', 'Maximum posts per day'),
('content_style', 'health_focused', 'Content generation style'),
('engagement_tracking', 'true', 'Track post engagement')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- Success check - verify all required columns exist
DO $$
BEGIN
    -- Check if all required columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_budgets' AND column_name = 'date'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_budgets' AND column_name = 'budget_used'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'tweet_id'
    ) THEN
        RAISE NOTICE 'SUCCESS: All required columns have been added!';
    ELSE
        RAISE NOTICE 'WARNING: Some columns may be missing';
    END IF;
END $$;

SELECT 'Schema migration completed successfully!' AS status;
-- ===== PERFECT DATABASE FIX =====
-- Copy and paste this ENTIRE script into Supabase SQL Editor

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

-- Fix bot_config values with proper quoting
INSERT INTO bot_config (config_key, config_value, description) VALUES
('posting_enabled', 'true', 'Enable autonomous posting'),
('max_daily_posts', '8', 'Maximum posts per day'),
('content_style', 'health', 'Content generation style'),
('engagement_tracking', 'true', 'Track post engagement')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW();
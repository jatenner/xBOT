-- ===== BULLETPROOF DATABASE FIX =====
-- Copy EXACTLY this into Supabase SQL Editor

-- Add missing columns to daily_budgets
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS budget_used DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS budget_limit DECIMAL(10,2) DEFAULT 5.00;
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS api_calls INTEGER DEFAULT 0;

-- Migrate existing data
UPDATE daily_budgets SET date = budget_date WHERE date IS NULL;
UPDATE daily_budgets SET budget_used = spent_amount WHERE budget_used = 0;
UPDATE daily_budgets SET budget_limit = total_budget WHERE budget_limit = 5.00;

-- Add missing columns to tweets
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'twitter';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'posted';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;

-- Add missing column to engagement_metrics
ALTER TABLE engagement_metrics ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Fix bot_config one by one to avoid JSON errors
DELETE FROM bot_config WHERE config_key = 'content_style';
INSERT INTO bot_config (config_key, config_value, description) VALUES ('content_style', 'health_focused', 'Content generation style');

DELETE FROM bot_config WHERE config_key = 'posting_enabled';
INSERT INTO bot_config (config_key, config_value, description) VALUES ('posting_enabled', 'true', 'Enable autonomous posting');

DELETE FROM bot_config WHERE config_key = 'max_daily_posts';
INSERT INTO bot_config (config_key, config_value, description) VALUES ('max_daily_posts', '8', 'Maximum posts per day');

DELETE FROM bot_config WHERE config_key = 'engagement_tracking';
INSERT INTO bot_config (config_key, config_value, description) VALUES ('engagement_tracking', 'true', 'Track post engagement');

-- Success message
SELECT 'Database schema fixed successfully!' AS result;
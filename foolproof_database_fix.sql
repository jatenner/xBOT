-- FOOLPROOF DATABASE FIX - Creates everything from scratch if needed

-- Fix daily_budgets table
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS budget_used DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS budget_limit DECIMAL(10,2) DEFAULT 5.00;
ALTER TABLE daily_budgets ADD COLUMN IF NOT EXISTS api_calls INTEGER DEFAULT 0;

-- Fix tweets table  
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_id VARCHAR(255);
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'twitter';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'posted';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;

-- Fix engagement_metrics table
ALTER TABLE engagement_metrics ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Recreate bot_config table completely
DROP TABLE IF EXISTS bot_config;
CREATE TABLE bot_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert basic config
INSERT INTO bot_config (config_key, config_value, description) VALUES 
('content_style', 'health', 'Content generation style'),
('posting_enabled', 'true', 'Enable autonomous posting'),
('max_daily_posts', '8', 'Maximum posts per day'),
('engagement_tracking', 'true', 'Track post engagement');

SELECT 'Database completely fixed!' AS result;
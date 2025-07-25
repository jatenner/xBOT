-- 🚀 ADD ESSENTIAL COLUMNS - STEP BY STEP
-- =======================================
-- Building on our working foundation

-- Step 1: Add essential columns to tweets table
ALTER TABLE tweets ADD COLUMN tweet_type TEXT DEFAULT 'original';
ALTER TABLE tweets ADD COLUMN content_type TEXT DEFAULT 'health_content';
ALTER TABLE tweets ADD COLUMN engagement_score INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN likes INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN retweets INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN replies INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN impressions INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN viral_score INTEGER DEFAULT 5;
ALTER TABLE tweets ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Add essential columns to twitter_quota_tracking
ALTER TABLE twitter_quota_tracking ADD COLUMN is_exhausted BOOLEAN DEFAULT FALSE;
ALTER TABLE twitter_quota_tracking ADD COLUMN reset_time TIMESTAMPTZ;
ALTER TABLE twitter_quota_tracking ADD COLUMN current_strategy TEXT DEFAULT 'balanced';
ALTER TABLE twitter_quota_tracking ADD COLUMN utilization_rate DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE twitter_quota_tracking ADD COLUMN last_updated TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Add essential columns to bot_config
ALTER TABLE bot_config ADD COLUMN description TEXT;
ALTER TABLE bot_config ADD COLUMN category TEXT DEFAULT 'general';
ALTER TABLE bot_config ADD COLUMN is_critical BOOLEAN DEFAULT FALSE;
ALTER TABLE bot_config ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 4: Add essential columns to system_logs
ALTER TABLE system_logs ADD COLUMN data JSONB DEFAULT '{}';
ALTER TABLE system_logs ADD COLUMN source TEXT DEFAULT 'system';
ALTER TABLE system_logs ADD COLUMN success BOOLEAN DEFAULT TRUE;

-- Step 5: Create missing tables that your code expects
CREATE TABLE IF NOT EXISTS monthly_api_usage (
    id SERIAL PRIMARY KEY,
    month TEXT UNIQUE NOT NULL,
    total_tweets INTEGER DEFAULT 0,
    total_reads INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage_tracker (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    api_type TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, api_type)
);

-- Step 6: Add more essential bot config
INSERT INTO bot_config (key, value, description, category, is_critical) VALUES
('intelligent_quota_enabled', 'true', 'Enable intelligent quota management', 'quota', true),
('quota_reset_monitoring', 'true', 'Enable automatic quota reset detection', 'quota', true),
('max_retries', '3', 'Maximum retry attempts for failed operations', 'reliability', false),
('engagement_check_interval', '3600', 'Seconds between engagement checks', 'monitoring', false),
('viral_threshold', '100', 'Minimum engagement for viral classification', 'analytics', false),
('budget_limit_daily', '2.00', 'Daily budget limit in USD', 'budget', true),
('emergency_mode_enabled', 'false', 'Emergency mode flag', 'emergency', true),
('performance_monitoring', 'true', 'Enable performance monitoring', 'monitoring', false),
('bulletproof_mode', 'true', 'Enable bulletproof error handling', 'system', true)
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_critical = EXCLUDED.is_critical,
    updated_at = NOW();

-- Step 7: Initialize new tables with today's data
INSERT INTO monthly_api_usage (month, total_tweets, total_reads, total_cost)
VALUES (TO_CHAR(NOW(), 'YYYY-MM'), 0, 0, 0.00)
ON CONFLICT (month) DO NOTHING;

INSERT INTO api_usage_tracker (date, api_type, count, cost, success_rate) VALUES
(CURRENT_DATE, 'twitter', 0, 0.00, 100.00),
(CURRENT_DATE, 'openai', 0, 0.00, 100.00),
(CURRENT_DATE, 'news_api', 0, 0.00, 100.00),
(CURRENT_DATE, 'pexels', 0, 0.00, 100.00)
ON CONFLICT (date, api_type) DO NOTHING;

-- Step 8: Update today's quota tracking with new fields
UPDATE twitter_quota_tracking 
SET 
    reset_time = (CURRENT_DATE + INTERVAL '1 day'),
    last_updated = NOW()
WHERE date = CURRENT_DATE;

-- Success message
SELECT 'ESSENTIAL COLUMNS ADDED SUCCESSFULLY' as status; 
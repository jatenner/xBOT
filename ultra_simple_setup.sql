-- ✅ ULTRA SIMPLE DATABASE SETUP - GUARANTEED TO WORK
-- ==================================================

-- Core tweets table
CREATE TABLE IF NOT EXISTS tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    tweet_type VARCHAR(50) DEFAULT 'original',
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota tracking table
CREATE TABLE IF NOT EXISTS twitter_quota_tracking (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    daily_used INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 17,
    daily_remaining INTEGER NOT NULL DEFAULT 17,
    is_exhausted BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Bot configuration table
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_quota_date ON twitter_quota_tracking(date);

-- Essential configuration
DELETE FROM bot_config WHERE key IN ('bot_enabled', 'daily_tweet_limit', 'intelligent_quota_enabled');

INSERT INTO bot_config (key, value, description) VALUES 
('bot_enabled', 'true', 'Bot enabled'),
('daily_tweet_limit', '17', 'Daily limit'),
('intelligent_quota_enabled', 'true', 'Quota enabled');

-- Today's quota
DELETE FROM twitter_quota_tracking WHERE date = CURRENT_DATE;

INSERT INTO twitter_quota_tracking (date, daily_used, daily_limit, daily_remaining) 
VALUES (CURRENT_DATE, 0, 17, 17);

-- Success log
INSERT INTO system_logs (action, data) VALUES 
('setup_complete', '{"status": "success", "timestamp": "now"}'); 
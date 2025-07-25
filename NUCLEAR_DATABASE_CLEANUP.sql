-- 🔥 NUCLEAR DATABASE CLEANUP
-- ===========================
-- This will DROP EVERYTHING and rebuild ONLY what your bot needs
-- Clean slate = reliable, fast, maintainable database

-- 🗑️ STEP 1: DROP ALL THE CLUTTER (BE BRAVE!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 🎯 STEP 2: CREATE ONLY THE 5 CORE TABLES YOUR CODE NEEDS

-- 1️⃣ BOT CONFIG (key-value store for settings)
CREATE TABLE bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2️⃣ TWEETS (all tweet data and metrics)
CREATE TABLE tweets (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    tweet_type VARCHAR(50) DEFAULT 'original',
    content_type VARCHAR(50) DEFAULT 'general',
    content_category VARCHAR(50) DEFAULT 'health_tech',
    source_attribution VARCHAR(100) DEFAULT 'AI Generated',
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    has_snap2health_cta BOOLEAN DEFAULT false,
    new_followers INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3️⃣ TWITTER QUOTA TRACKING (17 tweets/day limit)
CREATE TABLE twitter_quota_tracking (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    daily_used INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 17,
    daily_remaining INTEGER DEFAULT 17,
    reset_time TIMESTAMP WITH TIME ZONE,
    is_exhausted BOOLEAN DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4️⃣ ENGAGEMENT HISTORY (track all engagement actions)
CREATE TABLE engagement_history (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(20) NOT NULL,
    target_id VARCHAR(50) NOT NULL,
    target_type VARCHAR(10) NOT NULL,
    content TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    response_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5️⃣ BUDGET TRACKING (daily AI cost management)
CREATE TABLE daily_budget_status (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    budget_limit DECIMAL(8,2) DEFAULT 3.00,
    total_spent DECIMAL(8,6) DEFAULT 0,
    remaining_budget DECIMAL(8,6) DEFAULT 3.00,
    transactions_count INTEGER DEFAULT 0,
    emergency_brake_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6️⃣ SYSTEM LOGS (errors, events, debugging)
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    component VARCHAR(50),
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ⚡ STEP 3: ADD ESSENTIAL INDEXES ONLY
CREATE INDEX idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX idx_tweets_created_at ON tweets(created_at);
CREATE INDEX idx_twitter_quota_date ON twitter_quota_tracking(date);
CREATE INDEX idx_engagement_created_at ON engagement_history(created_at);
CREATE INDEX idx_bot_config_key ON bot_config(key);
CREATE INDEX idx_budget_date ON daily_budget_status(date);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);

-- 🎯 STEP 4: INITIALIZE ESSENTIAL DATA
INSERT INTO bot_config (key, value) VALUES 
('mode', 'production'),
('posting_enabled', 'true'),
('engagement_enabled', 'true'),
('viral_mode', 'true'),
('debug_mode', 'false');

-- Initialize today's quota
INSERT INTO twitter_quota_tracking (
    date, daily_used, daily_limit, daily_remaining, 
    reset_time, is_exhausted, last_updated
) VALUES (
    CURRENT_DATE, 0, 17, 17,
    (CURRENT_DATE + INTERVAL '1 day')::timestamp with time zone,
    false, NOW()
);

-- Initialize today's budget
INSERT INTO daily_budget_status (
    date, budget_limit, total_spent, remaining_budget, 
    transactions_count, emergency_brake_active
) VALUES (
    CURRENT_DATE, 3.00, 0.00, 3.00, 0, false
);

-- ✅ VERIFICATION
SELECT '🎯 NUCLEAR CLEANUP COMPLETE!' as status;
SELECT 'Your database now has exactly what your bot needs:' as message;

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name AND table_schema = 'public') as columns,
    CASE table_name
        WHEN 'bot_config' THEN '⚙️ Settings & Configuration'
        WHEN 'tweets' THEN '🐦 All Tweet Data & Metrics'
        WHEN 'twitter_quota_tracking' THEN '📊 Daily 17-Tweet Limit Tracking'
        WHEN 'engagement_history' THEN '❤️ Likes, Retweets, Replies Log'
        WHEN 'daily_budget_status' THEN '💰 AI Cost Budget Management'
        WHEN 'system_logs' THEN '🔍 Errors & Debug Information'
        ELSE '❓ Unknown'
    END as purpose
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name; 
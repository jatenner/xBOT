-- 🔥 SIMPLE WORKING DATABASE - NO COMPLEXITY
-- ============================================
-- FORGET EVERYTHING ELSE - THIS WILL WORK

-- Step 1: Drop everything that's causing problems
DROP TABLE IF EXISTS bot_config CASCADE;
DROP TABLE IF EXISTS tweets CASCADE;
DROP TABLE IF EXISTS twitter_quota_tracking CASCADE;
DROP TABLE IF EXISTS api_usage CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;

-- Step 2: Create ONLY the essential tables with SIMPLE structures
CREATE TABLE bot_config (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE twitter_quota_tracking (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    daily_used INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 17,
    daily_remaining INTEGER DEFAULT 17,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_usage (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    writes INTEGER DEFAULT 0,
    reads INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Insert BASIC configuration with NO fancy columns
INSERT INTO bot_config (key, value) VALUES
('bot_enabled', 'true'),
('daily_tweet_limit', '17'),
('current_tier', 'free');

-- Step 4: Initialize today's data
INSERT INTO twitter_quota_tracking (date, daily_used, daily_limit, daily_remaining) 
VALUES (CURRENT_DATE, 0, 17, 17);

INSERT INTO api_usage (date, writes, reads) 
VALUES (CURRENT_DATE, 0, 0);

-- Success message
SELECT 'SIMPLE DATABASE SETUP COMPLETE' as status; 
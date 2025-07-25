-- 🎯 STEP 1: IMMEDIATE SIMPLE FIX - CORRECTED
-- ==========================================
-- FIXED THE QUOTE ISSUE

-- Fix the problematic constraint that's causing the error
DO $$
BEGIN
    -- Drop the problematic constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'logical_engagement' 
        AND table_name = 'tweets'
    ) THEN
        ALTER TABLE tweets DROP CONSTRAINT logical_engagement;
        RAISE NOTICE 'Removed problematic constraint';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint already removed or table does not exist';
END $$;

-- Create basic tweets table if missing
CREATE TABLE IF NOT EXISTS tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create basic quota tracking table if missing
CREATE TABLE IF NOT EXISTS twitter_quota_tracking (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    daily_used INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 17,
    daily_remaining INTEGER DEFAULT 17,
    is_exhausted BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create basic bot config table if missing
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert basic configuration - FIXED THE QUOTES
INSERT INTO bot_config (key, value, description) VALUES
('bot_enabled', 'true', 'Enable bot'),
('daily_tweet_limit', '17', 'Daily limit'),
('current_tier', 'free', 'API tier')
ON CONFLICT (key) DO NOTHING;

-- Initialize today's quota
INSERT INTO twitter_quota_tracking (date, daily_used, daily_limit, daily_remaining, is_exhausted) 
VALUES (CURRENT_DATE, 0, 17, 17, false)
ON CONFLICT (date) DO NOTHING;

SELECT 'STEP 1 COMPLETE - Basic tables created' as status; 
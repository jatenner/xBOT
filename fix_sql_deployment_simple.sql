-- 🚀 SIMPLIFIED 30-75 TWEETS/DAY SYSTEM FIX
-- Direct SQL to run in Supabase dashboard

-- 1. Create twitter_api_limits table (fixed version)
CREATE TABLE IF NOT EXISTS twitter_api_limits (
    id SERIAL PRIMARY KEY,
    tweets_this_month INTEGER DEFAULT 0,
    monthly_tweet_cap INTEGER DEFAULT 1500,
    daily_posts_count INTEGER DEFAULT 0,
    daily_post_limit INTEGER DEFAULT 75,
    reads_this_month INTEGER DEFAULT 0,
    monthly_read_cap INTEGER DEFAULT 50000,
    emergency_monthly_cap_mode BOOLEAN DEFAULT false,
    last_daily_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_monthly_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial data
INSERT INTO twitter_api_limits (
    id, 
    tweets_this_month, 
    monthly_tweet_cap, 
    daily_posts_count, 
    daily_post_limit,
    reads_this_month,
    monthly_read_cap,
    emergency_monthly_cap_mode,
    last_daily_reset,
    last_monthly_reset,
    last_updated
) VALUES (
    1,
    0,
    1500,
    0,
    75,
    0,
    50000,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    emergency_monthly_cap_mode = false,
    daily_post_limit = 75,
    last_updated = CURRENT_TIMESTAMP;

-- 2. Create bot_configuration table
CREATE TABLE IF NOT EXISTS bot_configuration (
    id SERIAL PRIMARY KEY,
    strategy VARCHAR(100) DEFAULT 'intelligent_monthly_budget',
    mode VARCHAR(50) DEFAULT 'production',
    auto_posting_enabled BOOLEAN DEFAULT true,
    quality_threshold INTEGER DEFAULT 60,
    posting_interval_minutes INTEGER DEFAULT 15,
    max_daily_tweets INTEGER DEFAULT 75,
    min_daily_tweets INTEGER DEFAULT 30,
    baseline_daily_target INTEGER DEFAULT 50,
    emergency_mode BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert bot configuration
INSERT INTO bot_configuration (
    id,
    strategy,
    mode,
    auto_posting_enabled,
    quality_threshold,
    posting_interval_minutes,
    max_daily_tweets,
    min_daily_tweets,
    baseline_daily_target,
    emergency_mode,
    last_updated
) VALUES (
    1,
    'intelligent_monthly_budget',
    'production',
    true,
    60,
    15,
    75,
    30,
    50,
    false,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    auto_posting_enabled = true,
    posting_interval_minutes = 15,
    max_daily_tweets = 75,
    min_daily_tweets = 30,
    baseline_daily_target = 50,
    emergency_mode = false,
    last_updated = CURRENT_TIMESTAMP;

-- 3. Create simplified monthly_budget_state (without trending_boost)
CREATE TABLE IF NOT EXISTS monthly_budget_state (
    month VARCHAR(7) PRIMARY KEY,
    tweets_used INTEGER DEFAULT 0,
    tweets_budget INTEGER DEFAULT 1500,
    days_remaining INTEGER DEFAULT 30,
    daily_targets JSONB DEFAULT '{}',
    strategic_reserves INTEGER DEFAULT 225,
    performance_multiplier DECIMAL(3,2) DEFAULT 1.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert July 2025 budget (simplified)
INSERT INTO monthly_budget_state (
    month,
    tweets_used,
    tweets_budget,
    days_remaining,
    daily_targets,
    strategic_reserves,
    performance_multiplier,
    last_updated
) VALUES (
    '2025-07',
    0,
    1500,
    31 - EXTRACT(DAY FROM CURRENT_DATE) + 1,
    '{}',
    225,
    1.00,
    CURRENT_TIMESTAMP
) ON CONFLICT (month) DO UPDATE SET
    last_updated = CURRENT_TIMESTAMP;

-- ✅ SIMPLIFIED SETUP COMPLETE 
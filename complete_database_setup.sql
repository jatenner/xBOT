-- 🚀 COMPLETE DATABASE SETUP - ALL SYSTEMS
-- ==========================================
-- Ensures everything is properly configured for the intelligent quota bot

-- 1. CORE TWEETS TABLE
-- ====================
CREATE TABLE IF NOT EXISTS tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    tweet_type VARCHAR(50) DEFAULT 'original',
    content_type VARCHAR(50) DEFAULT 'health_content',
    content_category VARCHAR(50) DEFAULT 'health_tech',
    source_attribution VARCHAR(100) DEFAULT 'AI Generated',
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    has_snap2health_cta BOOLEAN DEFAULT false,
    viral_score INTEGER DEFAULT 5,
    ai_growth_prediction INTEGER DEFAULT 5,
    ai_optimized BOOLEAN DEFAULT true,
    generation_method VARCHAR(100) DEFAULT 'ai_enhanced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TWITTER QUOTA TRACKING
-- =========================
CREATE TABLE IF NOT EXISTS twitter_quota_tracking (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    daily_used INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 17,
    daily_remaining INTEGER NOT NULL DEFAULT 17,
    reset_time TIMESTAMP WITH TIME ZONE,
    is_exhausted BOOLEAN DEFAULT FALSE,
    current_strategy VARCHAR(20) DEFAULT 'balanced',
    optimal_interval INTEGER DEFAULT 60,
    next_optimal_post TIMESTAMP WITH TIME ZONE,
    utilization_rate DECIMAL(5,2) DEFAULT 0.00,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. QUOTA RESET LOG
-- ==================
CREATE TABLE IF NOT EXISTS quota_reset_log (
    id SERIAL PRIMARY KEY,
    reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
    new_quota_limit INTEGER NOT NULL DEFAULT 17,
    new_quota_remaining INTEGER NOT NULL DEFAULT 17,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_quota_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. QUOTA UTILIZATION LOG
-- ========================
CREATE TABLE IF NOT EXISTS quota_utilization_log (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    hour INTEGER NOT NULL,
    tweets_posted INTEGER DEFAULT 0,
    utilization_rate DECIMAL(5,2) DEFAULT 0.00,
    strategy_used VARCHAR(20) DEFAULT 'balanced',
    active_hours_remaining DECIMAL(4,2) DEFAULT 0.00,
    quota_remaining INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- 5. BOT CONFIGURATION
-- ====================
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. API USAGE TRACKING
-- =====================
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    api_type VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 0,
    cost DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, api_type)
);

-- 7. SYSTEM LOGS
-- ==============
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    data JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'system'
);

-- INDEXES FOR PERFORMANCE
-- =======================
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_twitter_quota_date ON twitter_quota_tracking(date);
CREATE INDEX IF NOT EXISTS idx_quota_reset_log_reset_time ON quota_reset_log(reset_time);
CREATE INDEX IF NOT EXISTS idx_quota_reset_log_detected_at ON quota_reset_log(detected_at);
CREATE INDEX IF NOT EXISTS idx_quota_utilization_date_hour ON quota_utilization_log(date, hour);
CREATE INDEX IF NOT EXISTS idx_api_usage_date_api ON api_usage_tracking(date, api_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);

-- QUOTA UTILIZATION FUNCTION
-- ==========================
CREATE OR REPLACE FUNCTION log_quota_utilization()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO quota_utilization_log (
        date, 
        hour, 
        tweets_posted, 
        utilization_rate,
        strategy_used,
        quota_remaining
    ) VALUES (
        CURRENT_DATE,
        EXTRACT(HOUR FROM NOW()),
        NEW.daily_used,
        (NEW.daily_used::decimal / NEW.daily_limit::decimal * 100),
        COALESCE(NEW.current_strategy, 'balanced'),
        NEW.daily_remaining
    ) ON CONFLICT (date, hour) DO UPDATE SET
        tweets_posted = EXCLUDED.tweets_posted,
        utilization_rate = EXCLUDED.utilization_rate,
        strategy_used = EXCLUDED.strategy_used,
        quota_remaining = EXCLUDED.quota_remaining,
        created_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AUTO-TRACKING TRIGGER
-- =====================
DROP TRIGGER IF EXISTS trigger_quota_utilization ON twitter_quota_tracking;
CREATE TRIGGER trigger_quota_utilization
    AFTER UPDATE ON twitter_quota_tracking
    FOR EACH ROW
    EXECUTE FUNCTION log_quota_utilization();

-- QUOTA ANALYTICS VIEW
-- ===================
CREATE OR REPLACE VIEW quota_analytics AS
SELECT 
    date,
    MAX(tweets_posted) as daily_tweets,
    MAX(utilization_rate) as final_utilization_rate,
    COUNT(DISTINCT hour) as active_hours,
    AVG(utilization_rate) as avg_hourly_utilization,
    STRING_AGG(DISTINCT strategy_used, ', ') as strategies_used
FROM quota_utilization_log
GROUP BY date
ORDER BY date DESC;

-- ESSENTIAL BOT CONFIG
-- ===================
INSERT INTO bot_config (key, value, description) VALUES
    ('bot_enabled', 'true', 'Master bot enable/disable switch'),
    ('daily_tweet_limit', '17', 'Free tier daily tweet limit'),
    ('intelligent_quota_enabled', 'true', 'Enable intelligent quota management'),
    ('quota_reset_monitoring', 'true', 'Enable automatic quota reset detection'),
    ('current_tier', 'free', 'Twitter API tier (free/paid)')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- INITIALIZE TODAY'S QUOTA TRACKING
-- =================================
INSERT INTO twitter_quota_tracking (
    date,
    daily_used,
    daily_limit,
    daily_remaining,
    reset_time,
    is_exhausted,
    current_strategy,
    last_updated
) VALUES (
    CURRENT_DATE,
    0,
    17,
    17,
    (CURRENT_DATE + INTERVAL '1 day')::timestamp,
    FALSE,
    'balanced',
    NOW()
) ON CONFLICT (date) DO UPDATE SET
    daily_limit = 17,
    current_strategy = 'balanced',
    last_updated = NOW();

-- INITIALIZE API USAGE TRACKING
-- =============================
INSERT INTO api_usage_tracking (date, api_type, count) VALUES
    (CURRENT_DATE, 'twitter', 0),
    (CURRENT_DATE, 'openai', 0),
    (CURRENT_DATE, 'news_api', 0)
ON CONFLICT (date, api_type) DO NOTHING;

-- SETUP COMPLETION LOG
-- ====================
INSERT INTO system_logs (action, data, source) VALUES
    ('complete_database_setup', 
     jsonb_build_object(
         'setup_date', NOW(),
         'tables_configured', 7,
         'intelligent_quota_enabled', true,
         'daily_tweet_limit', 17,
         'status', 'operational'
     ), 
     'setup_script');

-- TABLE COMMENTS
-- ==============
COMMENT ON TABLE tweets IS 'Core table storing all bot tweets with engagement metrics';
COMMENT ON TABLE twitter_quota_tracking IS 'Real-time Twitter quota tracking and strategy management';
COMMENT ON TABLE quota_reset_log IS 'Log of detected quota resets for automatic recovery';
COMMENT ON TABLE quota_utilization_log IS 'Hourly quota utilization tracking for analytics';
COMMENT ON TABLE bot_config IS 'Bot configuration and feature toggles';
COMMENT ON TABLE api_usage_tracking IS 'Daily API usage tracking across all services';
COMMENT ON VIEW quota_analytics IS 'Daily quota analytics for performance monitoring';

-- SUCCESS MESSAGE
-- ===============
SELECT 
    'DATABASE SETUP COMPLETE' as status,
    COUNT(*) as tables_configured,
    'All systems operational' as message
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'tweets', 
    'twitter_quota_tracking', 
    'quota_reset_log', 
    'quota_utilization_log', 
    'bot_config', 
    'api_usage_tracking',
    'system_logs'
); 
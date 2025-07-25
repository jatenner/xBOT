-- 🎯 STEP 3: ADD ADVANCED FEATURES
-- ================================
-- ONLY RUN AFTER STEP 1 & 2 WORK

-- Create quota logs
CREATE TABLE IF NOT EXISTS quota_reset_log (
    id SERIAL PRIMARY KEY,
    reset_time TIMESTAMPTZ NOT NULL,
    new_quota_limit INTEGER DEFAULT 17,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quota_utilization_log (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    hour INTEGER NOT NULL,
    tweets_posted INTEGER DEFAULT 0,
    utilization_rate DECIMAL(5,2) DEFAULT 0.00,
    strategy_used VARCHAR(20) DEFAULT 'balanced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_quota_tracking_date ON twitter_quota_tracking(date);

-- Simple quota tracking function
CREATE OR REPLACE FUNCTION simple_quota_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO quota_utilization_log (date, hour, tweets_posted, utilization_rate, strategy_used)
    VALUES (
        CURRENT_DATE,
        EXTRACT(HOUR FROM NOW()),
        NEW.daily_used,
        COALESCE(NEW.utilization_rate, 0),
        COALESCE(NEW.current_strategy, 'balanced')
    ) ON CONFLICT (date, hour) DO UPDATE SET
        tweets_posted = EXCLUDED.tweets_posted,
        utilization_rate = EXCLUDED.utilization_rate;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NEW; -- Don't break if logging fails
END;
$$ LANGUAGE plpgsql;

-- Create simple trigger
CREATE TRIGGER simple_quota_trigger
    AFTER UPDATE ON twitter_quota_tracking
    FOR EACH ROW
    EXECUTE FUNCTION simple_quota_log();

-- Initialize API tracking for today
INSERT INTO api_usage_tracking (date, api_type, count, cost) VALUES
(CURRENT_DATE, 'twitter', 0, 0.00),
(CURRENT_DATE, 'openai', 0, 0.00)
ON CONFLICT (date, api_type) DO NOTHING;

SELECT 'STEP 3 COMPLETE - Advanced features added' as status; 
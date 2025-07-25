-- Intelligent Quota Management Migration
-- Enhanced quota tracking and reset detection

-- Quota reset log table
CREATE TABLE IF NOT EXISTS quota_reset_log (
    id SERIAL PRIMARY KEY,
    reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
    new_quota_limit INTEGER NOT NULL DEFAULT 17,
    new_quota_remaining INTEGER NOT NULL DEFAULT 17,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_quota_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_quota_reset_log_reset_time ON quota_reset_log(reset_time);
CREATE INDEX IF NOT EXISTS idx_quota_reset_log_detected_at ON quota_reset_log(detected_at);

-- Quota utilization tracking
CREATE TABLE IF NOT EXISTS quota_utilization_log (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    hour INTEGER NOT NULL, -- 0-23 
    tweets_posted INTEGER DEFAULT 0,
    utilization_rate DECIMAL(5,2) DEFAULT 0.00, -- percentage
    strategy_used VARCHAR(20) DEFAULT 'balanced',
    active_hours_remaining DECIMAL(4,2) DEFAULT 0.00,
    quota_remaining INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, hour)
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_quota_utilization_date_hour ON quota_utilization_log(date, hour);

-- Update twitter_quota_tracking to include strategy info
ALTER TABLE twitter_quota_tracking 
ADD COLUMN IF NOT EXISTS current_strategy VARCHAR(20) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS optimal_interval INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS next_optimal_post TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS utilization_rate DECIMAL(5,2) DEFAULT 0.00;

-- Function to log quota utilization
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

-- Trigger to automatically log utilization
DROP TRIGGER IF EXISTS trigger_quota_utilization ON twitter_quota_tracking;
CREATE TRIGGER trigger_quota_utilization
    AFTER UPDATE ON twitter_quota_tracking
    FOR EACH ROW
    EXECUTE FUNCTION log_quota_utilization();

-- View for quota analytics
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

-- Comments for documentation
COMMENT ON TABLE quota_reset_log IS 'Tracks when Twitter quota resets are detected for automatic recovery';
COMMENT ON TABLE quota_utilization_log IS 'Hourly quota utilization tracking for analytics and optimization';
COMMENT ON VIEW quota_analytics IS 'Daily quota analytics for performance monitoring';

-- Insert initial quota reset detection
INSERT INTO quota_reset_log (
    reset_time,
    new_quota_limit,
    new_quota_remaining,
    detected_at,
    previous_quota_used
) VALUES (
    CURRENT_DATE + INTERVAL '1 day',
    17,
    17,
    NOW(),
    17
) ON CONFLICT DO NOTHING; 
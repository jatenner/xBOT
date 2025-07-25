-- Twitter Quota Tracking Migration
-- Tracks daily Twitter API quota usage and reset times

CREATE TABLE IF NOT EXISTS twitter_quota_tracking (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    daily_used INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 17,
    daily_remaining INTEGER NOT NULL DEFAULT 17,
    reset_time TIMESTAMP WITH TIME ZONE,
    is_exhausted BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient date lookups
CREATE INDEX IF NOT EXISTS idx_twitter_quota_date ON twitter_quota_tracking(date);

-- Insert today's initial record
INSERT INTO twitter_quota_tracking (
    date,
    daily_used,
    daily_limit,
    daily_remaining,
    reset_time,
    is_exhausted,
    last_updated
) VALUES (
    CURRENT_DATE,
    0,
    17,
    17,
    (CURRENT_DATE + INTERVAL '1 day')::timestamp,
    FALSE,
    NOW()
) ON CONFLICT (date) DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE twitter_quota_tracking IS 'Tracks daily Twitter API quota usage to prevent rate limit exhaustion';
COMMENT ON COLUMN twitter_quota_tracking.daily_used IS 'Number of tweets posted today';
COMMENT ON COLUMN twitter_quota_tracking.daily_limit IS 'Daily posting limit (17 for free tier)';
COMMENT ON COLUMN twitter_quota_tracking.daily_remaining IS 'Remaining posts for today';
COMMENT ON COLUMN twitter_quota_tracking.reset_time IS 'When the quota resets (next midnight UTC)';
COMMENT ON COLUMN twitter_quota_tracking.is_exhausted IS 'Whether daily quota is exhausted'; 
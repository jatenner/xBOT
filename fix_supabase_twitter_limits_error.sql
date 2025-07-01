-- 🔧 SUPABASE TWITTER API LIMITS ERROR FIX
-- Fixes the "column updated_at does not exist" error

-- Drop any problematic indexes that might exist
DROP INDEX IF EXISTS idx_twitter_api_limits_updated_at;
DROP INDEX IF EXISTS idx_twitter_limits_updated_at;

-- Drop and recreate the twitter_api_limits table with correct schema
DROP TABLE IF EXISTS twitter_api_limits CASCADE;

-- Create the twitter_api_limits table with correct column names
CREATE TABLE twitter_api_limits (
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
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Correct column name!
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the correct index on the existing column
CREATE INDEX idx_twitter_api_limits_last_updated ON twitter_api_limits(last_updated);

-- Initialize with proper data
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
    0,              -- Reset tweets count  
    1500,           -- Twitter API free tier limit
    0,              -- Reset daily count
    75,             -- Your target max per day
    0,              -- Reset reads
    50000,          -- Twitter API read limit  
    false,          -- Disable emergency mode
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    emergency_monthly_cap_mode = false,
    daily_post_limit = 75,
    last_updated = CURRENT_TIMESTAMP;

SELECT 'Twitter API limits table fixed successfully!' as status; 
-- Quick fix for database schema issues
-- Run this in Supabase SQL Editor

-- Drop existing tables if they exist (in reverse dependency order)
DROP VIEW IF EXISTS image_usage_analytics;
DROP VIEW IF EXISTS api_usage_status;
DROP FUNCTION IF EXISTS increment_api_usage(VARCHAR, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS reset_daily_api_usage();
DROP FUNCTION IF EXISTS get_least_used_images(VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS update_image_usage(VARCHAR, TEXT, VARCHAR, TEXT[], VARCHAR);
DROP TABLE IF EXISTS image_usage_history;
DROP TABLE IF EXISTS news_source_health;

-- Create image usage tracking table with proper constraints
CREATE TABLE image_usage_history (
    id SERIAL PRIMARY KEY,
    image_id VARCHAR(255) NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_terms TEXT[],
    tweet_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_image_usage_last_used ON image_usage_history(last_used_at);
CREATE INDEX idx_image_usage_source ON image_usage_history(source);
CREATE INDEX idx_image_usage_count ON image_usage_history(usage_count);

-- Create news sources health table  
CREATE TABLE news_source_health (
    id SERIAL PRIMARY KEY,
    api_name VARCHAR(50) NOT NULL UNIQUE,
    daily_usage_count INTEGER DEFAULT 0,
    daily_limit INTEGER NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    last_successful_call TIMESTAMP WITH TIME ZONE,
    last_error_message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial API configurations
INSERT INTO news_source_health (api_name, daily_limit) VALUES 
    ('newsapi', 90),
    ('guardian', 1000),
    ('mediastack', 900),
    ('newsdata', 180);

-- Create functions
CREATE OR REPLACE FUNCTION update_image_usage(
    p_image_id VARCHAR(255),
    p_image_url TEXT,
    p_source VARCHAR(50),
    p_search_terms TEXT[] DEFAULT NULL,
    p_tweet_id VARCHAR(255) DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO image_usage_history (
        image_id, image_url, source, usage_count, search_terms, tweet_id, last_used_at, first_used_at
    ) VALUES (
        p_image_id, p_image_url, p_source, 1, p_search_terms, p_tweet_id, NOW(), NOW()
    )
    ON CONFLICT (image_id) DO UPDATE SET
        usage_count = image_usage_history.usage_count + 1,
        last_used_at = NOW(),
        search_terms = COALESCE(p_search_terms, image_usage_history.search_terms),
        tweet_id = COALESCE(p_tweet_id, image_usage_history.tweet_id),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Database schema fixed successfully!' as status; 
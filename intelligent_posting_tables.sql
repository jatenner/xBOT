-- INTELLIGENT POSTING SYSTEM TABLES
-- Run this in Supabase to add tables for the intelligent posting system

-- Intelligent posting data for learning and optimization
CREATE TABLE IF NOT EXISTS intelligent_posts (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    opportunity_score DECIMAL(5,2) NOT NULL,
    urgency VARCHAR(20) NOT NULL,
    posting_reason TEXT,
    content_hints TEXT,
    content TEXT NOT NULL,
    engagement_score INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    retweets_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    performance_updated_at TIMESTAMP WITH TIME ZONE
);

-- Trending topics analysis
CREATE TABLE IF NOT EXISTS trending_topics (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    momentum DECIMAL(3,2) DEFAULT 0.5,
    competition DECIMAL(3,2) DEFAULT 0.7,
    health_relevance DECIMAL(3,2) DEFAULT 0.1,
    viral_potential DECIMAL(3,2) DEFAULT 0.3,
    opportunity_score DECIMAL(3,2) DEFAULT 0.2,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Posting strategy performance tracking
CREATE TABLE IF NOT EXISTS posting_strategies (
    id SERIAL PRIMARY KEY,
    strategy_name VARCHAR(100) NOT NULL,
    success_rate DECIMAL(5,2) DEFAULT 0,
    average_engagement DECIMAL(5,2) DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    performance_score DECIMAL(5,2) DEFAULT 0
);

-- Real-time engagement windows
CREATE TABLE IF NOT EXISTS engagement_windows (
    id SERIAL PRIMARY KEY,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    average_engagement DECIMAL(5,2) DEFAULT 0,
    follower_activity DECIMAL(5,2) DEFAULT 0,
    optimal_frequency DECIMAL(3,1) DEFAULT 0.33,
    sample_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(day_of_week, hour_of_day)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_intelligent_posts_tweet_id ON intelligent_posts(tweet_id);
CREATE INDEX IF NOT EXISTS idx_intelligent_posts_posted_at ON intelligent_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_intelligent_posts_opportunity_score ON intelligent_posts(opportunity_score);

CREATE INDEX IF NOT EXISTS idx_trending_topics_detected_at ON trending_topics(detected_at);
CREATE INDEX IF NOT EXISTS idx_trending_topics_opportunity_score ON trending_topics(opportunity_score);

CREATE INDEX IF NOT EXISTS idx_engagement_windows_day_hour ON engagement_windows(day_of_week, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_engagement_windows_optimal_frequency ON engagement_windows(optimal_frequency);

-- Insert default engagement windows (peak times)
INSERT INTO engagement_windows (day_of_week, hour_of_day, average_engagement, follower_activity, optimal_frequency) VALUES
-- Monday peak times
(1, 9, 0.7, 0.8, 2.0),   -- 9 AM
(1, 13, 0.6, 0.7, 1.5),  -- 1 PM
(1, 19, 0.8, 0.9, 2.5),  -- 7 PM

-- Tuesday-Thursday (consistent)
(2, 9, 0.7, 0.8, 2.0), (3, 9, 0.7, 0.8, 2.0), (4, 9, 0.7, 0.8, 2.0),
(2, 13, 0.6, 0.7, 1.5), (3, 13, 0.6, 0.7, 1.5), (4, 13, 0.6, 0.7, 1.5),
(2, 19, 0.8, 0.9, 2.5), (3, 19, 0.8, 0.9, 2.5), (4, 19, 0.8, 0.9, 2.5),

-- Friday (slightly different pattern)
(5, 9, 0.6, 0.7, 1.5),   -- 9 AM
(5, 17, 0.7, 0.8, 2.0),  -- 5 PM
(5, 20, 0.5, 0.6, 1.0),  -- 8 PM

-- Weekend (different patterns)
(6, 10, 0.5, 0.6, 1.0),  -- Saturday 10 AM
(6, 14, 0.6, 0.7, 1.5),  -- Saturday 2 PM
(0, 11, 0.4, 0.5, 0.8),  -- Sunday 11 AM
(0, 18, 0.5, 0.6, 1.0)   -- Sunday 6 PM

ON CONFLICT (day_of_week, hour_of_day) DO NOTHING;

-- Insert default posting strategies
INSERT INTO posting_strategies (strategy_name, success_rate, average_engagement, performance_score) VALUES
('trending_reactive', 0.75, 0.65, 0.70),
('engagement_window', 0.80, 0.55, 0.68),
('breaking_news', 0.85, 0.75, 0.80),
('routine_posting', 0.60, 0.45, 0.53)
ON CONFLICT DO NOTHING;

SELECT 'Intelligent posting system tables created successfully!' AS result;
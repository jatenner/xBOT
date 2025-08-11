-- BULLETPROOF INTELLIGENT POSTING SYSTEM TABLES
-- This version eliminates all potential SQL conflicts

-- Drop existing tables if they exist to avoid conflicts
DROP TABLE IF EXISTS intelligent_posts CASCADE;
DROP TABLE IF EXISTS trending_topics CASCADE;
DROP TABLE IF EXISTS posting_strategies CASCADE;
DROP TABLE IF EXISTS engagement_windows CASCADE;

-- 1. Intelligent posting data for learning and optimization
CREATE TABLE intelligent_posts (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    score_value DECIMAL(5,2) NOT NULL,
    urgency_level VARCHAR(20) NOT NULL,
    reason_text TEXT,
    content_hints TEXT,
    tweet_content TEXT NOT NULL,
    engagement_count INTEGER DEFAULT 0,
    likes_total INTEGER DEFAULT 0,
    retweets_total INTEGER DEFAULT 0,
    replies_total INTEGER DEFAULT 0,
    posted_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_timestamp TIMESTAMP WITH TIME ZONE
);

-- 2. Trending topics analysis
CREATE TABLE trending_topics (
    id SERIAL PRIMARY KEY,
    topic_name VARCHAR(255) NOT NULL,
    momentum_score DECIMAL(3,2) DEFAULT 0.5,
    competition_level DECIMAL(3,2) DEFAULT 0.7,
    health_relevance DECIMAL(3,2) DEFAULT 0.1,
    viral_potential DECIMAL(3,2) DEFAULT 0.3,
    final_score DECIMAL(3,2) DEFAULT 0.2,
    created_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_timestamp TIMESTAMP WITH TIME ZONE
);

-- 3. Posting strategy performance tracking
CREATE TABLE posting_strategies (
    id SERIAL PRIMARY KEY,
    strategy_name VARCHAR(100) NOT NULL,
    success_percentage DECIMAL(5,2) DEFAULT 0,
    avg_engagement DECIMAL(5,2) DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    last_used_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    performance_rating DECIMAL(5,2) DEFAULT 0
);

-- 4. Real-time engagement windows
CREATE TABLE engagement_windows (
    id SERIAL PRIMARY KEY,
    weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
    hour_24 INTEGER NOT NULL CHECK (hour_24 >= 0 AND hour_24 <= 23),
    avg_engagement DECIMAL(5,2) DEFAULT 0,
    follower_activity DECIMAL(5,2) DEFAULT 0,
    optimal_frequency DECIMAL(3,1) DEFAULT 0.33,
    sample_size INTEGER DEFAULT 0,
    updated_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(weekday, hour_24)
);

-- Create indexes for performance
CREATE INDEX idx_intelligent_posts_tweet_id ON intelligent_posts(tweet_id);
CREATE INDEX idx_intelligent_posts_posted ON intelligent_posts(posted_timestamp);
CREATE INDEX idx_intelligent_posts_score ON intelligent_posts(score_value);

CREATE INDEX idx_trending_topics_created ON trending_topics(created_timestamp);
CREATE INDEX idx_trending_topics_score ON trending_topics(final_score);

CREATE INDEX idx_engagement_windows_time ON engagement_windows(weekday, hour_24);
CREATE INDEX idx_engagement_windows_frequency ON engagement_windows(optimal_frequency);

-- Insert default engagement windows (peak times)
INSERT INTO engagement_windows (weekday, hour_24, avg_engagement, follower_activity, optimal_frequency) VALUES
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
(0, 18, 0.5, 0.6, 1.0);  -- Sunday 6 PM

-- Insert default posting strategies
INSERT INTO posting_strategies (strategy_name, success_percentage, avg_engagement, performance_rating) VALUES
('trending_reactive', 75.0, 65.0, 70.0),
('engagement_window', 80.0, 55.0, 68.0),
('breaking_news', 85.0, 75.0, 80.0),
('routine_posting', 60.0, 45.0, 53.0);

-- Insert sample trending topics for testing
INSERT INTO trending_topics (topic_name, momentum_score, health_relevance, viral_potential, final_score) VALUES
('morning meditation', 0.8, 0.9, 0.7, 0.8),
('vitamin D benefits', 0.6, 0.8, 0.5, 0.6),
('sleep hygiene tips', 0.7, 0.9, 0.6, 0.7),
('hydration myths', 0.5, 0.7, 0.4, 0.5),
('mental health awareness', 0.9, 0.9, 0.8, 0.9);

SELECT 'Bulletproof intelligent posting system tables created successfully!' AS result;
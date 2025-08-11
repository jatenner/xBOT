-- AI SYSTEMS DATABASE TABLES
-- Run this in Supabase to add tables for the AI learning systems

-- Content generation tracking
CREATE TABLE IF NOT EXISTS content_generations (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL,
    topic VARCHAR(255),
    mood VARCHAR(50),
    content TEXT NOT NULL,
    engagement_score INTEGER DEFAULT 0,
    content_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Engagement analysis storage
CREATE TABLE IF NOT EXISTS engagement_analysis (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    content_type VARCHAR(50),
    topics TEXT, -- JSON array of topics
    sentiment_score INTEGER DEFAULT 0,
    viral_score INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    performance_rating VARCHAR(20),
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Topic performance tracking
CREATE TABLE IF NOT EXISTS topic_performance (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(255) UNIQUE NOT NULL,
    viral_score DECIMAL(5,2) DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    performance_rating VARCHAR(20),
    sample_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Time-based performance tracking
CREATE TABLE IF NOT EXISTS time_performance (
    id SERIAL PRIMARY KEY,
    hour_of_day INTEGER UNIQUE NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    viral_score DECIMAL(5,2) DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    sample_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_generations_created_at ON content_generations(created_at);
CREATE INDEX IF NOT EXISTS idx_content_generations_topic ON content_generations(topic);
CREATE INDEX IF NOT EXISTS idx_engagement_analysis_tweet_id ON engagement_analysis(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_analysis_performance ON engagement_analysis(performance_rating);
CREATE INDEX IF NOT EXISTS idx_topic_performance_topic ON topic_performance(topic);
CREATE INDEX IF NOT EXISTS idx_time_performance_hour ON time_performance(hour_of_day);

SELECT 'AI systems database tables created successfully!' AS result;
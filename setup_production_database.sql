-- 🚀 PRODUCTION DATABASE SETUP FOR AUTONOMOUS TWITTER BOT
-- This creates all required tables for full bot operation

-- ===== TWEETS TABLE =====
-- Stores all posted tweets with metadata
CREATE TABLE IF NOT EXISTS tweets (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    tweet_id VARCHAR(50) UNIQUE,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    platform VARCHAR(20) DEFAULT 'twitter',
    status VARCHAR(20) DEFAULT 'posted',
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== BOT CONFIGURATION TABLE =====
-- Stores runtime configuration and state
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    type VARCHAR(20) DEFAULT 'string',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== CONTENT PERFORMANCE TABLE =====
-- Tracks content performance for learning
CREATE TABLE IF NOT EXISTS content_performance (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50) REFERENCES tweets(tweet_id),
    content_type VARCHAR(50),
    topic VARCHAR(100),
    engagement_rate DECIMAL(5,4),
    viral_score INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== POSTING SCHEDULE TABLE =====
-- Tracks posting times and patterns
CREATE TABLE IF NOT EXISTS posting_schedule (
    id SERIAL PRIMARY KEY,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    posted_time TIMESTAMP WITH TIME ZONE,
    content TEXT,
    status VARCHAR(20) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== LEARNING DATA TABLE =====
-- Stores AI learning insights and patterns
CREATE TABLE IF NOT EXISTS learning_data (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    content JSONB,
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ANALYTICS TABLE =====
-- Comprehensive analytics for growth tracking
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_date DATE DEFAULT CURRENT_DATE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== INDEXES FOR PERFORMANCE =====
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
CREATE INDEX IF NOT EXISTS idx_tweets_platform ON tweets(platform);
CREATE INDEX IF NOT EXISTS idx_tweets_status ON tweets(status);
CREATE INDEX IF NOT EXISTS idx_content_performance_tweet_id ON content_performance(tweet_id);
CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_name ON analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_date ON analytics(metric_date);

-- ===== INITIAL CONFIGURATION DATA =====
INSERT INTO bot_config (key, value, type) VALUES 
    ('bot_status', 'active', 'string'),
    ('last_post_time', '', 'datetime'),
    ('total_posts', '0', 'integer'),
    ('daily_post_limit', '8', 'integer'),
    ('current_daily_posts', '0', 'integer'),
    ('posting_enabled', 'true', 'boolean'),
    ('learning_mode', 'active', 'string'),
    ('content_strategy', 'health_focused', 'string')
ON CONFLICT (key) DO NOTHING;

-- ===== ROW LEVEL SECURITY (RLS) =====
-- Enable RLS for security
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- ===== FUNCTIONS =====
-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_tweets_updated_at BEFORE UPDATE ON tweets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_config_updated_at BEFORE UPDATE ON bot_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== VERIFICATION QUERIES =====
-- These will be run after setup to verify everything works
-- SELECT 'tweets' as table_name, count(*) as row_count FROM tweets
-- UNION ALL
-- SELECT 'bot_config', count(*) FROM bot_config
-- UNION ALL  
-- SELECT 'content_performance', count(*) FROM content_performance
-- UNION ALL
-- SELECT 'posting_schedule', count(*) FROM posting_schedule
-- UNION ALL
-- SELECT 'learning_data', count(*) FROM learning_data
-- UNION ALL
-- SELECT 'analytics', count(*) FROM analytics;

-- ===== SUCCESS MESSAGE =====
-- If this runs without error, the database is ready for production use
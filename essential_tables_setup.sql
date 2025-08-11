-- ===== ESSENTIAL TABLES FOR AUTONOMOUS TWITTER BOT =====
-- Run this in your Supabase SQL editor to create the required tables

-- Core tweets table for storing posted content
CREATE TABLE IF NOT EXISTS tweets (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    tweet_id VARCHAR(255) UNIQUE,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    platform VARCHAR(50) DEFAULT 'twitter',
    status VARCHAR(50) DEFAULT 'posted',
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bot configuration table
CREATE TABLE IF NOT EXISTS bot_config (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily budget tracking
CREATE TABLE IF NOT EXISTS daily_budgets (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    budget_used DECIMAL(10,2) DEFAULT 0.00,
    budget_limit DECIMAL(10,2) DEFAULT 5.00,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning posts for AI improvement
CREATE TABLE IF NOT EXISTS learning_posts (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    performance_score DECIMAL(5,2),
    engagement_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Engagement metrics tracking
CREATE TABLE IF NOT EXISTS engagement_metrics (
    id BIGSERIAL PRIMARY KEY,
    tweet_id VARCHAR(255),
    metric_type VARCHAR(100),
    metric_value INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default bot configuration
INSERT INTO bot_config (config_key, config_value, description) VALUES
('posting_enabled', 'true', 'Enable or disable autonomous posting'),
('posting_interval_hours', '3', 'Hours between autonomous posts'),
('max_daily_posts', '8', 'Maximum posts per day'),
('content_style', 'health_focused', 'Style of content to generate'),
('engagement_tracking', 'true', 'Track engagement metrics')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(config_key);
CREATE INDEX IF NOT EXISTS idx_daily_budgets_date ON daily_budgets(date);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_tweet_id ON engagement_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_recorded_at ON engagement_metrics(recorded_at);

-- Enable Row Level Security (RLS) for security
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (adjust as needed)
CREATE POLICY IF NOT EXISTS "Service role can manage tweets" ON tweets
    FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Service role can manage bot_config" ON bot_config
    FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Service role can manage daily_budgets" ON daily_budgets
    FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Service role can manage learning_posts" ON learning_posts
    FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Service role can manage engagement_metrics" ON engagement_metrics
    FOR ALL USING (true);

-- Success message
SELECT 'Essential tables created successfully! Your bot can now operate.' AS status;
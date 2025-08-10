-- ===== NUCLEAR DATABASE RESET =====
-- This will completely reset and rebuild your database
-- RUN THIS IN PARTS - DO NOT RUN ALL AT ONCE

-- ===== PART 1: COMPLETE CLEANUP =====
-- Copy and run this section first:

DROP TABLE IF EXISTS engagement_metrics CASCADE;
DROP TABLE IF EXISTS learning_posts CASCADE;
DROP TABLE IF EXISTS daily_budgets CASCADE;
DROP TABLE IF EXISTS bot_config CASCADE;
DROP TABLE IF EXISTS tweets CASCADE;
DROP TABLE IF EXISTS analytics CASCADE;
DROP TABLE IF EXISTS posting_schedule CASCADE;
DROP TABLE IF EXISTS content_performance CASCADE;
DROP TABLE IF EXISTS migration_locks CASCADE;
DROP TABLE IF EXISTS schema_versions CASCADE;

-- ===== PART 2: CORE TABLES CREATION =====
-- After Part 1 succeeds, copy and run this section:

-- Core tweets table (MINIMAL - just what the bot needs)
CREATE TABLE tweets (
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

-- Bot configuration
CREATE TABLE bot_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning data for AI
CREATE TABLE learning_posts (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50),
    content TEXT,
    engagement_data JSONB,
    performance_score DECIMAL(3,2),
    learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily budget tracking
CREATE TABLE daily_budgets (
    id SERIAL PRIMARY KEY,
    budget_date DATE DEFAULT CURRENT_DATE,
    total_budget DECIMAL(10,2) DEFAULT 50.00,
    spent_amount DECIMAL(10,2) DEFAULT 0.00,
    remaining_amount DECIMAL(10,2) DEFAULT 50.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Engagement metrics
CREATE TABLE engagement_metrics (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50),
    metric_type VARCHAR(50),
    metric_value INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== PART 3: ESSENTIAL INDEXES =====
-- After Part 2 succeeds, copy and run this section:

CREATE INDEX idx_tweets_posted_at ON tweets(posted_at);
CREATE INDEX idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX idx_tweets_status ON tweets(status);
CREATE INDEX idx_engagement_metrics_tweet_id ON engagement_metrics(tweet_id);
CREATE INDEX idx_learning_posts_tweet_id ON learning_posts(tweet_id);
CREATE INDEX idx_bot_config_key ON bot_config(config_key);

-- ===== PART 4: DEFAULT DATA =====
-- After Part 3 succeeds, copy and run this section:

INSERT INTO bot_config (config_key, config_value, description) VALUES
('posting_schedule', '{"hours": [9, 13, 17, 21]}', 'Hours when bot should post (UTC)'),
('content_themes', '["health", "nutrition", "fitness", "wellness"]', 'Content themes for the bot'),
('max_daily_posts', '4', 'Maximum posts per day'),
('enable_threads', 'true', 'Whether to enable thread posting');

INSERT INTO daily_budgets (budget_date, total_budget, spent_amount, remaining_amount) VALUES
(CURRENT_DATE, 50.00, 0.00, 50.00);

-- ===== PART 5: VERIFICATION =====
-- After Part 4 succeeds, copy and run this section:

SELECT 
    'tweets' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as latest_entry
FROM tweets
UNION ALL
SELECT 
    'bot_config' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as latest_entry
FROM bot_config
UNION ALL
SELECT 
    'learning_posts' as table_name, 
    COUNT(*) as row_count,
    MAX(learned_at) as latest_entry
FROM learning_posts
UNION ALL
SELECT 
    'daily_budgets' as table_name, 
    COUNT(*) as row_count,
    MAX(created_at) as latest_entry
FROM daily_budgets
UNION ALL
SELECT 
    'engagement_metrics' as table_name, 
    COUNT(*) as row_count,
    MAX(recorded_at) as latest_entry
FROM engagement_metrics;
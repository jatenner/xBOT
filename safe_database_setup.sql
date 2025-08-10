-- ===== SAFE DATABASE SETUP FOR xBOT =====
-- This script safely creates tables without conflicts

-- First, let's see what exists
SELECT 
  table_name,
  column_name,
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;

-- ===== STEP 1: SAFE TWEETS TABLE =====
-- Create tweets table if it doesn't exist, or add missing columns if it does

DO $$ 
BEGIN
    -- Create tweets table if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tweets') THEN
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
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created tweets table';
    ELSE
        -- Add missing columns to existing tweets table
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'status') THEN
            ALTER TABLE tweets ADD COLUMN status VARCHAR(20) DEFAULT 'posted';
            RAISE NOTICE 'Added status column to tweets';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'engagement_score') THEN
            ALTER TABLE tweets ADD COLUMN engagement_score INTEGER DEFAULT 0;
            RAISE NOTICE 'Added engagement_score column to tweets';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'likes') THEN
            ALTER TABLE tweets ADD COLUMN likes INTEGER DEFAULT 0;
            RAISE NOTICE 'Added likes column to tweets';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'retweets') THEN
            ALTER TABLE tweets ADD COLUMN retweets INTEGER DEFAULT 0;
            RAISE NOTICE 'Added retweets column to tweets';
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tweets' AND column_name = 'replies') THEN
            ALTER TABLE tweets ADD COLUMN replies INTEGER DEFAULT 0;
            RAISE NOTICE 'Added replies column to tweets';
        END IF;
    END IF;
END $$;

-- ===== STEP 2: BOT CONFIG TABLE =====
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== STEP 3: LEARNING DATA TABLE =====
CREATE TABLE IF NOT EXISTS learning_posts (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50),
    content TEXT,
    engagement_data JSONB,
    performance_score DECIMAL(3,2),
    learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== STEP 4: DAILY BUDGETS TABLE =====
CREATE TABLE IF NOT EXISTS daily_budgets (
    id SERIAL PRIMARY KEY,
    budget_date DATE DEFAULT CURRENT_DATE,
    total_budget DECIMAL(10,2) DEFAULT 50.00,
    spent_amount DECIMAL(10,2) DEFAULT 0.00,
    remaining_amount DECIMAL(10,2) DEFAULT 50.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== STEP 5: ENGAGEMENT METRICS TABLE =====
CREATE TABLE IF NOT EXISTS engagement_metrics (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50),
    metric_type VARCHAR(50), -- 'likes', 'retweets', 'replies', 'impressions'
    metric_value INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default bot configuration
INSERT INTO bot_config (config_key, config_value, description) 
VALUES 
    ('posting_schedule', '{"hours": [9, 13, 17, 21]}', 'Hours when bot should post (UTC)')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO bot_config (config_key, config_value, description) 
VALUES 
    ('content_themes', '["health", "nutrition", "fitness", "wellness"]', 'Content themes for the bot')
ON CONFLICT (config_key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_status ON tweets(status);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_tweet_id ON engagement_metrics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_posts_tweet_id ON learning_posts(tweet_id);

-- Final verification
SELECT 'tweets' as table_name, COUNT(*) as row_count FROM tweets
UNION ALL
SELECT 'bot_config' as table_name, COUNT(*) as row_count FROM bot_config
UNION ALL
SELECT 'learning_posts' as table_name, COUNT(*) as row_count FROM learning_posts
UNION ALL
SELECT 'daily_budgets' as table_name, COUNT(*) as row_count FROM daily_budgets
UNION ALL
SELECT 'engagement_metrics' as table_name, COUNT(*) as row_count FROM engagement_metrics;

-- Success message
SELECT 'DATABASE SETUP COMPLETE! All tables created safely.' as status;
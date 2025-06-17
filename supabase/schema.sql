-- Supabase Schema for Snap2Health X-Bot

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing original tweets posted by the bot
CREATE TABLE IF NOT EXISTS tweets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    tweet_type VARCHAR(50) DEFAULT 'original',
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    has_snap2health_cta BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    embedding vector(1536),
    style text DEFAULT 'DEFAULT'
);

-- Table for storing replies posted by the bot
CREATE TABLE IF NOT EXISTS replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reply_id VARCHAR(255) UNIQUE NOT NULL,
    parent_tweet_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing target tweets we want to reply to
CREATE TABLE IF NOT EXISTS target_tweets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    author_username VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    engagement_score INTEGER DEFAULT 0,
    reply_potential_score DECIMAL(3,2) DEFAULT 0,
    has_replied BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing engagement metrics and learning data
CREATE TABLE IF NOT EXISTS engagement_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(50) NOT NULL, -- 'tweet' or 'reply'
    content_id UUID NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly'
    engagement_score INTEGER DEFAULT 0,
    reach_score INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing learning insights
CREATE TABLE IF NOT EXISTS learning_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_type VARCHAR(50) NOT NULL, -- 'content_theme', 'timing', 'style', 'engagement_pattern'
    insight_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 0,
    performance_impact DECIMAL(3,2) DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Table for storing content theme performance
CREATE TABLE IF NOT EXISTS content_themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme_name VARCHAR(255) NOT NULL,
    keywords TEXT[], -- Array of keywords associated with this theme
    avg_engagement DECIMAL(5,2) DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    best_performing_tweet_id VARCHAR(255),
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing optimal timing insights
CREATE TABLE IF NOT EXISTS timing_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    avg_engagement DECIMAL(5,2) DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    confidence_level DECIMAL(3,2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing style preferences based on performance
CREATE TABLE IF NOT EXISTS style_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    style_type VARCHAR(50) NOT NULL, -- 'educational', 'humorous', 'thought-provoking', 'technical'
    avg_engagement DECIMAL(5,2) DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0, -- Percentage of posts above engagement threshold
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for bot configuration and kill switches
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO bot_config (key, value, description) VALUES
('enabled', 'true', 'Master kill switch for the bot'),
('max_tweets_per_hour', '4', 'Maximum tweets per hour rate limit'),
('max_replies_per_hour', '6', 'Maximum replies per hour rate limit'),
('min_engagement_threshold', '5', 'Minimum engagement score to consider successful'),
('snap2health_cta_frequency', '999', 'Tweet every Nth tweet with Snap2Health CTA (999 = disabled)'),
('preferred_posting_hours', '9,14,18', 'Comma-separated list of optimal posting hours'),
('preferred_content_style', 'educational', 'Current best-performing content style'),
('learning_enabled', 'true', 'Whether to use learning insights for content generation'),
('style_weights', '{"BREAKING_NEWS": 1.0, "HOT_TAKE": 1.0, "EDUCATION": 1.0, "CULTURAL_REFERENCE": 1.0, "DATA_STORY": 1.0, "PREDICTION": 1.0, "COMPARISON": 1.0, "QUESTION_STARTER": 1.0, "DEFAULT": 1.0}', 'Style performance weights for content generation')
ON CONFLICT (key) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_tweets_engagement_score ON tweets(engagement_score);
CREATE INDEX IF NOT EXISTS idx_replies_created_at ON replies(created_at);
CREATE INDEX IF NOT EXISTS idx_target_tweets_reply_potential ON target_tweets(reply_potential_score);
CREATE INDEX IF NOT EXISTS idx_engagement_analytics_content ON engagement_analytics(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_learning_insights_type ON learning_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_learning_insights_expires ON learning_insights(expires_at);
CREATE INDEX IF NOT EXISTS idx_content_themes_engagement ON content_themes(avg_engagement);
CREATE INDEX IF NOT EXISTS idx_timing_insights_hour_day ON timing_insights(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_style_performance_success ON style_performance(success_rate);
CREATE INDEX IF NOT EXISTS tweets_embedding_idx ON tweets 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Row Level Security (optional, but recommended)
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE timing_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth setup)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tweets' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON tweets FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'replies' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON replies FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'target_tweets' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON target_tweets FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'engagement_analytics' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON engagement_analytics FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'learning_insights' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON learning_insights FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_themes' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON content_themes FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'timing_insights' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON timing_insights FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'style_performance' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON style_performance FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bot_config' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON bot_config FOR ALL USING (true);
    END IF;
END $$;

-- Kill switch and API quota management
CREATE TABLE IF NOT EXISTS control_flags (
    id TEXT PRIMARY KEY,
    value BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage (
    date DATE PRIMARY KEY,
    writes INT DEFAULT 0,
    reads INT DEFAULT 0
);

-- Helper functions for API tracking
CREATE OR REPLACE FUNCTION incr_write() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO api_usage (date, writes) VALUES (current_date, 1)
    ON CONFLICT (date) DO UPDATE SET writes = api_usage.writes + 1;
END $$;

CREATE OR REPLACE FUNCTION incr_read() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO api_usage (date, reads) VALUES (current_date, 1)
    ON CONFLICT (date) DO UPDATE SET reads = api_usage.reads + 1;
END $$;

-- Insert initial control flags
INSERT INTO control_flags (id, value) VALUES ('DISABLE_BOT', false)
ON CONFLICT (id) DO NOTHING;

-- Content recycling for evergreen tweets
CREATE TABLE IF NOT EXISTS content_recycling (
    id SERIAL PRIMARY KEY,
    original_tweet_id TEXT NOT NULL,
    last_recycled TIMESTAMPTZ DEFAULT NOW(),
    recycle_count INT DEFAULT 1,
    UNIQUE(original_tweet_id)
);

-- Helper function to increment image usage
CREATE OR REPLACE FUNCTION increment_image_usage(image_url TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE media_history 
    SET used_count = used_count + 1, last_used = NOW()
    WHERE url = image_url;
END $$;

-- RLS policies for new tables
ALTER TABLE control_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;  
ALTER TABLE content_recycling ENABLE ROW LEVEL SECURITY;

-- Enable all operations for service role on new tables
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'control_flags' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON control_flags FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_usage' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON api_usage FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content_recycling' AND policyname = 'Enable all operations for service role') THEN
        CREATE POLICY "Enable all operations for service role" ON content_recycling FOR ALL USING (true);
    END IF;
END $$;

-- Media history table for image tracking
CREATE TABLE IF NOT EXISTS media_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    url text NOT NULL,
    caption text,
    source text DEFAULT 'unsplash',
    used_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

-- Index for efficient image lookup
CREATE INDEX IF NOT EXISTS media_history_url_idx ON media_history(url);
CREATE INDEX IF NOT EXISTS media_history_used_at_idx ON media_history(used_at DESC);

-- News cache table for PubMed articles (if not exists)
CREATE TABLE IF NOT EXISTS news_cache (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    url text NOT NULL,
    source text NOT NULL,
    content text,
    cached_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Index for news cache lookups
CREATE INDEX IF NOT EXISTS news_cache_source_idx ON news_cache(source);
CREATE INDEX IF NOT EXISTS news_cache_cached_at_idx ON news_cache(cached_at DESC);

-- Add engagement score column to tweets if not exists
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS eng_score integer DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE media_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables
CREATE POLICY "Enable all operations for service role" ON media_history
FOR ALL USING (true);

CREATE POLICY "Enable all operations for service role" ON news_cache
FOR ALL USING (true);
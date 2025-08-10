/**
 * @version 1.0.0
 * @name Enhanced Production Schema
 * @description Complete enterprise database schema with advanced features
 * @dependencies none
 */

-- ===== CORE TWEETS TABLE =====
-- Enhanced tweets table with advanced analytics
CREATE TABLE IF NOT EXISTS tweets (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    tweet_id VARCHAR(50) UNIQUE,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    platform VARCHAR(20) DEFAULT 'twitter',
    status VARCHAR(20) DEFAULT 'posted',
    
    -- Engagement metrics
    engagement_score INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    
    -- Content analysis
    content_type VARCHAR(50), -- 'single', 'thread', 'reply', 'quote'
    content_category VARCHAR(100), -- 'health', 'nutrition', 'fitness', etc.
    hashtags TEXT[], -- Array of hashtags used
    mentions TEXT[], -- Array of mentions
    media_urls TEXT[], -- Array of media URLs
    
    -- AI metadata
    ai_model_used VARCHAR(100),
    ai_prompt_version VARCHAR(50),
    generation_time_ms INTEGER,
    content_confidence DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Performance tracking
    viral_potential_score DECIMAL(3,2),
    actual_performance_score DECIMAL(3,2),
    predicted_vs_actual_diff DECIMAL(4,2),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for tweets table
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);
CREATE INDEX IF NOT EXISTS idx_tweets_status ON tweets(status);
CREATE INDEX IF NOT EXISTS idx_tweets_platform ON tweets(platform);
CREATE INDEX IF NOT EXISTS idx_tweets_content_type ON tweets(content_type);
CREATE INDEX IF NOT EXISTS idx_tweets_engagement_score ON tweets(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_viral_potential ON tweets(viral_potential_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_hashtags ON tweets USING GIN(hashtags);

-- ===== BOT CONFIGURATION =====
-- Advanced bot configuration with version control
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    config_type VARCHAR(50) NOT NULL, -- 'posting', 'ai', 'schedule', 'limits'
    environment VARCHAR(20) DEFAULT 'production', -- 'dev', 'staging', 'production'
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(config_key, environment, version)
);

-- Insert default configuration
INSERT INTO bot_config (config_key, config_value, config_type) VALUES
('posting_schedule', '{"intervals": [9, 12, 15, 18], "timezone": "UTC", "enabled": true}', 'posting'),
('ai_model_config', '{"model": "gpt-4", "temperature": 0.7, "max_tokens": 280}', 'ai'),
('engagement_targets', '{"min_likes": 5, "min_retweets": 1, "target_engagement_rate": 0.03}', 'limits'),
('content_categories', '["hydration", "sleep", "exercise", "nutrition", "mental_health", "wellness"]', 'posting')
ON CONFLICT (config_key, environment, version) DO NOTHING;

-- ===== CONTENT PERFORMANCE ANALYTICS =====
-- Detailed content performance tracking
CREATE TABLE IF NOT EXISTS content_performance (
    id SERIAL PRIMARY KEY,
    tweet_id INTEGER REFERENCES tweets(id) ON DELETE CASCADE,
    
    -- Time-series metrics (hourly snapshots)
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    likes_count INTEGER DEFAULT 0,
    retweets_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    impressions_count INTEGER DEFAULT 0,
    
    -- Advanced metrics
    engagement_rate DECIMAL(5,4), -- Engagement / Impressions
    viral_coefficient DECIMAL(5,4), -- Retweets / Likes
    conversation_rate DECIMAL(5,4), -- Replies / Impressions
    amplification_rate DECIMAL(5,4), -- Retweets / Impressions
    
    -- Audience analysis
    audience_reach INTEGER,
    follower_growth_attribution INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance tracking
CREATE INDEX IF NOT EXISTS idx_content_performance_tweet_id ON content_performance(tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_snapshot_time ON content_performance(snapshot_time);
CREATE INDEX IF NOT EXISTS idx_content_performance_engagement_rate ON content_performance(engagement_rate DESC);

-- ===== POSTING SCHEDULE =====
-- Advanced scheduling system
CREATE TABLE IF NOT EXISTS posting_schedule (
    id SERIAL PRIMARY KEY,
    schedule_name VARCHAR(100) NOT NULL,
    schedule_type VARCHAR(50) NOT NULL, -- 'regular', 'campaign', 'experimental'
    
    -- Schedule configuration
    cron_expression VARCHAR(100), -- For complex schedules
    timezone VARCHAR(50) DEFAULT 'UTC',
    posting_hours INTEGER[], -- Array of hours (0-23)
    posting_days INTEGER[], -- Array of weekdays (0-6, 0=Sunday)
    
    -- Content constraints
    content_categories TEXT[],
    max_posts_per_day INTEGER DEFAULT 4,
    min_interval_hours INTEGER DEFAULT 3,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1, -- Higher priority schedules override lower
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Schedule effectiveness tracking
    posts_generated INTEGER DEFAULT 0,
    avg_engagement_score DECIMAL(5,2),
    success_rate DECIMAL(3,2)
);

-- Insert default schedule
INSERT INTO posting_schedule (schedule_name, schedule_type, posting_hours, posting_days, content_categories) VALUES
('Default Health Schedule', 'regular', ARRAY[9, 12, 15, 18], ARRAY[1,2,3,4,5,6,0], 
 ARRAY['hydration', 'sleep', 'exercise', 'nutrition', 'mental_health'])
ON CONFLICT DO NOTHING;

-- ===== LEARNING DATA =====
-- AI learning and optimization data
CREATE TABLE IF NOT EXISTS learning_data (
    id SERIAL PRIMARY KEY,
    
    -- Learning context
    learning_type VARCHAR(50) NOT NULL, -- 'content_optimization', 'timing_optimization', 'engagement_prediction'
    input_data JSONB NOT NULL, -- Raw input for learning
    output_data JSONB, -- Model output/prediction
    actual_result JSONB, -- Actual outcome for comparison
    
    -- Model metadata
    model_version VARCHAR(50),
    confidence_score DECIMAL(3,2),
    processing_time_ms INTEGER,
    
    -- Learning effectiveness
    accuracy_score DECIMAL(3,2), -- How accurate was the prediction
    learning_weight DECIMAL(3,2) DEFAULT 1.0, -- How much to weight this data point
    
    -- Context
    tweet_id INTEGER REFERENCES tweets(id) ON DELETE SET NULL,
    experiment_id VARCHAR(100), -- For A/B testing
    feature_flags TEXT[], -- Which features were enabled
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for learning data
CREATE INDEX IF NOT EXISTS idx_learning_data_type ON learning_data(learning_type);
CREATE INDEX IF NOT EXISTS idx_learning_data_tweet_id ON learning_data(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_data_experiment ON learning_data(experiment_id);
CREATE INDEX IF NOT EXISTS idx_learning_data_created_at ON learning_data(created_at);

-- ===== ANALYTICS AND REPORTING =====
-- Comprehensive analytics dashboard data
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    
    -- Analytics period
    period_type VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Aggregate metrics
    total_posts INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_retweets INTEGER DEFAULT 0,
    total_replies INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    
    -- Calculated metrics
    avg_engagement_rate DECIMAL(5,4),
    follower_growth INTEGER DEFAULT 0,
    top_performing_category VARCHAR(100),
    optimal_posting_hour INTEGER,
    
    -- AI performance
    ai_accuracy_score DECIMAL(3,2),
    prediction_errors INTEGER DEFAULT 0,
    model_improvements INTEGER DEFAULT 0,
    
    -- System health
    uptime_percentage DECIMAL(5,2),
    error_count INTEGER DEFAULT 0,
    successful_posts INTEGER DEFAULT 0,
    failed_posts INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(period_type, period_start)
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_period ON analytics(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_analytics_engagement ON analytics(avg_engagement_rate DESC);

-- ===== ENTERPRISE FEATURES =====

-- Database migration tracking (for automated migrations)
CREATE TABLE IF NOT EXISTS schema_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    migration_id VARCHAR(100) UNIQUE NOT NULL,
    migration_name VARCHAR(255) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    rollback_sql TEXT,
    is_rolled_back BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration locks (for concurrent migration protection)
CREATE TABLE IF NOT EXISTS migration_locks (
    lock_id VARCHAR(100) PRIMARY KEY,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    process_info TEXT
);

-- System health monitoring
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'healthy', 'degraded', 'critical', 'offline'
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    
    service_name VARCHAR(100),
    metric_name VARCHAR(100),
    metric_value DECIMAL(10,4),
    threshold_value DECIMAL(10,4),
    
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== VIEWS FOR COMMON QUERIES =====

-- Recent performance view
CREATE OR REPLACE VIEW recent_performance AS
SELECT 
    t.id,
    t.content,
    t.posted_at,
    t.engagement_score,
    t.viral_potential_score,
    t.actual_performance_score,
    (t.likes + t.retweets + t.replies) as total_engagement,
    CASE 
        WHEN t.impressions > 0 THEN (t.likes + t.retweets + t.replies)::DECIMAL / t.impressions 
        ELSE 0 
    END as engagement_rate
FROM tweets t
WHERE t.posted_at > NOW() - INTERVAL '7 days'
AND t.status = 'posted'
ORDER BY t.posted_at DESC;

-- Top performing content view
CREATE OR REPLACE VIEW top_performing_content AS
SELECT 
    t.content_category,
    COUNT(*) as post_count,
    AVG(t.engagement_score) as avg_engagement,
    AVG(t.likes) as avg_likes,
    AVG(t.retweets) as avg_retweets,
    MAX(t.engagement_score) as max_engagement
FROM tweets t
WHERE t.posted_at > NOW() - INTERVAL '30 days'
AND t.status = 'posted'
GROUP BY t.content_category
ORDER BY avg_engagement DESC;

-- ===== TRIGGERS FOR AUTO-UPDATES =====

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply auto-update triggers
CREATE TRIGGER update_tweets_updated_at BEFORE UPDATE ON tweets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_config_updated_at BEFORE UPDATE ON bot_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posting_schedule_updated_at BEFORE UPDATE ON posting_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== ROLLBACK INSTRUCTIONS =====
-- ROLLBACK --

-- Remove triggers
DROP TRIGGER IF EXISTS update_tweets_updated_at ON tweets;
DROP TRIGGER IF EXISTS update_bot_config_updated_at ON bot_config;
DROP TRIGGER IF EXISTS update_posting_schedule_updated_at ON posting_schedule;

-- Remove trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Remove views
DROP VIEW IF EXISTS recent_performance;
DROP VIEW IF EXISTS top_performing_content;

-- Remove tables (in reverse dependency order)
DROP TABLE IF EXISTS alert_history;
DROP TABLE IF EXISTS system_health;
DROP TABLE IF EXISTS migration_locks;
DROP TABLE IF EXISTS schema_versions;
DROP TABLE IF EXISTS analytics;
DROP TABLE IF EXISTS learning_data;
DROP TABLE IF EXISTS posting_schedule;
DROP TABLE IF EXISTS content_performance;
DROP TABLE IF EXISTS bot_config;
DROP TABLE IF EXISTS tweets;
-- =====================================================================================
-- 🚀 SUPABASE COMPATIBLE DATABASE SCHEMA FIX - ENTERPRISE GRADE
-- =====================================================================================
-- 
-- PURPOSE: Complete database schema rebuild compatible with Supabase SQL Editor
-- FIXES: Removed CONCURRENTLY from CREATE INDEX commands for transaction compatibility
-- SAFETY: Includes existence checks and conflict resolution
-- =====================================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================================================
-- 1. CORE TWEETS TABLE - ENHANCED PRODUCTION SCHEMA
-- =====================================================================================

-- Drop and recreate tweets table with complete schema
DROP TABLE IF EXISTS tweets CASCADE;

CREATE TABLE tweets (
    -- Primary identifiers
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    
    -- Platform and status
    platform VARCHAR(20) DEFAULT 'twitter' NOT NULL,
    status VARCHAR(20) DEFAULT 'posted' NOT NULL,
    posting_method VARCHAR(50) DEFAULT 'autonomous' NOT NULL,
    
    -- Timing information
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Engagement metrics (real-time updated)
    likes INTEGER DEFAULT 0 NOT NULL,
    retweets INTEGER DEFAULT 0 NOT NULL,
    replies INTEGER DEFAULT 0 NOT NULL,
    quotes INTEGER DEFAULT 0 NOT NULL,
    bookmarks INTEGER DEFAULT 0 NOT NULL,
    impressions INTEGER DEFAULT 0 NOT NULL,
    profile_clicks INTEGER DEFAULT 0 NOT NULL,
    url_clicks INTEGER DEFAULT 0 NOT NULL,
    detail_expands INTEGER DEFAULT 0 NOT NULL,
    
    -- Calculated engagement metrics
    engagement_score INTEGER DEFAULT 0 NOT NULL,
    engagement_rate DECIMAL(5,4) DEFAULT 0.0000 NOT NULL,
    viral_coefficient DECIMAL(5,4) DEFAULT 0.0000 NOT NULL,
    
    -- Content classification
    content_type VARCHAR(50) DEFAULT 'single' NOT NULL,
    content_category VARCHAR(100) NOT NULL,
    content_theme VARCHAR(100),
    content_tone VARCHAR(50),
    
    -- Content structure
    hashtags TEXT[] DEFAULT '{}' NOT NULL,
    mentions TEXT[] DEFAULT '{}' NOT NULL,
    urls TEXT[] DEFAULT '{}' NOT NULL,
    media_urls TEXT[] DEFAULT '{}' NOT NULL,
    media_type VARCHAR(20),
    
    -- AI generation metadata
    ai_model_used VARCHAR(100) NOT NULL,
    ai_prompt_version VARCHAR(50) NOT NULL,
    ai_temperature DECIMAL(3,2),
    generation_time_ms INTEGER,
    content_confidence DECIMAL(3,2),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    
    -- Performance prediction vs reality
    predicted_engagement_score INTEGER,
    predicted_viral_potential DECIMAL(3,2),
    actual_performance_score DECIMAL(3,2),
    prediction_accuracy DECIMAL(4,2),
    
    -- Content quality metrics
    readability_score DECIMAL(3,2),
    sentiment_score DECIMAL(3,2),
    urgency_score DECIMAL(3,2),
    uniqueness_score DECIMAL(3,2),
    
    -- Scheduling and optimization
    optimal_time_score DECIMAL(3,2),
    audience_activity_score DECIMAL(3,2),
    trending_topic_alignment DECIMAL(3,2),
    competitive_timing_score DECIMAL(3,2),
    
    -- Error tracking
    posting_errors JSONB DEFAULT '[]' NOT NULL,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Additional metadata
    user_agent VARCHAR(200),
    ip_address INET,
    source_inspiration TEXT,
    editorial_notes TEXT
);

-- Standard indexes for tweets table (removed CONCURRENTLY for Supabase compatibility)
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_status ON tweets(status);
CREATE INDEX IF NOT EXISTS idx_tweets_platform ON tweets(platform);
CREATE INDEX IF NOT EXISTS idx_tweets_content_type ON tweets(content_type);
CREATE INDEX IF NOT EXISTS idx_tweets_content_category ON tweets(content_category);
CREATE INDEX IF NOT EXISTS idx_tweets_engagement_score ON tweets(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_viral_coefficient ON tweets(viral_coefficient DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_ai_model ON tweets(ai_model_used);
CREATE INDEX IF NOT EXISTS idx_tweets_hashtags ON tweets USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_tweets_mentions ON tweets USING GIN(mentions);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_deleted_at ON tweets(deleted_at) WHERE deleted_at IS NOT NULL;

-- =====================================================================================
-- 2. BOT CONFIGURATION - UNIFIED SYSTEM
-- =====================================================================================

-- Drop and recreate bot_config with proper schema
DROP TABLE IF EXISTS bot_config CASCADE;

CREATE TABLE bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    config_type VARCHAR(50) NOT NULL DEFAULT 'general',
    environment VARCHAR(20) DEFAULT 'production' NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT,
    created_by VARCHAR(100) DEFAULT 'system' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    UNIQUE(key, environment)
);

-- Essential bot configuration data
INSERT INTO bot_config (key, value, config_type, description) VALUES

-- Twitter Authentication Configuration
('twitter_auth', '{
    "api_key_env": "TWITTER_API_KEY",
    "api_secret_env": "TWITTER_API_SECRET", 
    "access_token_env": "TWITTER_ACCESS_TOKEN",
    "access_token_secret_env": "TWITTER_ACCESS_TOKEN_SECRET",
    "bearer_token_env": "TWITTER_BEARER_TOKEN",
    "user_id_env": "TWITTER_USER_ID",
    "auth_method": "oauth1",
    "rate_limit_window": 900,
    "rate_limit_tweets": 300
}', 'authentication', 'Twitter API authentication configuration'),

-- Rate Limiting - UNIFIED SYSTEM
('unified_rate_limits', '{
    "daily_tweet_limit": 17,
    "hourly_tweet_limit": 4,
    "tweets_posted_today": 0,
    "last_reset_date": null,
    "emergency_mode": false,
    "burst_mode_enabled": false,
    "respect_twitter_limits": true,
    "track_real_posts": true
}', 'limits', 'Unified rate limiting system'),

-- AI Budget Management
('ai_budget_control', '{
    "daily_budget_limit": 7.50,
    "current_daily_spend": 0.00,
    "emergency_budget_limit": 7.25,
    "budget_lockdown_threshold": 7.00,
    "enable_emergency_lockdown": true,
    "track_token_usage": true,
    "cost_per_1k_tokens": 0.002
}', 'budget', 'AI usage budget controls'),

-- Content Generation Settings
('content_generation', '{
    "ai_model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 280,
    "content_categories": ["hydration", "sleep", "exercise", "nutrition", "mental_health", "wellness"],
    "content_tones": ["educational", "motivational", "humorous", "scientific"],
    "avoid_repetition_days": 7,
    "uniqueness_threshold": 0.8,
    "quality_threshold": 0.7
}', 'content', 'AI content generation parameters'),

-- Posting Schedule
('posting_schedule', '{
    "enabled": true,
    "timezone": "UTC",
    "optimal_hours": [9, 12, 15, 18, 21],
    "min_interval_minutes": 30,
    "max_interval_hours": 6,
    "adaptive_timing": true,
    "respect_audience_activity": true,
    "avoid_competitive_windows": true
}', 'schedule', 'Intelligent posting schedule'),

-- Engagement Optimization
('engagement_optimization', '{
    "target_engagement_rate": 0.03,
    "min_likes_threshold": 5,
    "min_retweets_threshold": 1,
    "viral_potential_threshold": 0.7,
    "learn_from_performance": true,
    "adapt_content_strategy": true,
    "track_competitor_timing": false
}', 'engagement', 'Engagement optimization settings'),

-- System Health Monitoring
('system_health', '{
    "enabled": true,
    "health_check_interval": 300,
    "alert_thresholds": {
        "error_rate": 0.1,
        "response_time_ms": 5000,
        "memory_usage_mb": 512,
        "cpu_usage_percent": 80
    },
    "auto_recovery": true,
    "graceful_degradation": true
}', 'monitoring', 'System health monitoring configuration')

ON CONFLICT (key, environment) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Indexes for bot_config
CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key);
CREATE INDEX IF NOT EXISTS idx_bot_config_type ON bot_config(config_type);
CREATE INDEX IF NOT EXISTS idx_bot_config_active ON bot_config(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_config_env ON bot_config(environment);

-- =====================================================================================
-- 3. TWITTER AUTHENTICATION SYSTEM
-- =====================================================================================

-- Twitter authentication sessions and tokens
CREATE TABLE IF NOT EXISTS twitter_auth_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    
    -- Authentication status
    auth_status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    auth_method VARCHAR(20) DEFAULT 'oauth1' NOT NULL,
    
    -- Token information (encrypted)
    access_token_hash VARCHAR(64),
    token_expires_at TIMESTAMP WITH TIME ZONE,
    refresh_token_hash VARCHAR(64),
    
    -- User information
    twitter_user_id VARCHAR(50),
    twitter_username VARCHAR(50),
    twitter_display_name VARCHAR(100),
    
    -- Session metadata
    user_agent VARCHAR(500),
    ip_address INET,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days') NOT NULL
);

-- Indexes for auth sessions
CREATE INDEX IF NOT EXISTS idx_auth_sessions_status ON twitter_auth_sessions(auth_status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON twitter_auth_sessions(twitter_user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON twitter_auth_sessions(expires_at);

-- =====================================================================================
-- 4. ANALYTICS AND PERFORMANCE TRACKING
-- =====================================================================================

-- Comprehensive content performance analytics
CREATE TABLE IF NOT EXISTS content_analytics (
    id SERIAL PRIMARY KEY,
    tweet_id INTEGER NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
    
    -- Time-series data point
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Engagement metrics snapshot
    likes_count INTEGER DEFAULT 0 NOT NULL,
    retweets_count INTEGER DEFAULT 0 NOT NULL,
    replies_count INTEGER DEFAULT 0 NOT NULL,
    quotes_count INTEGER DEFAULT 0 NOT NULL,
    bookmarks_count INTEGER DEFAULT 0 NOT NULL,
    impressions_count INTEGER DEFAULT 0 NOT NULL,
    
    -- Advanced metrics
    engagement_rate DECIMAL(5,4) DEFAULT 0.0000 NOT NULL,
    viral_velocity DECIMAL(5,4) DEFAULT 0.0000 NOT NULL,
    reach_efficiency DECIMAL(5,4) DEFAULT 0.0000 NOT NULL,
    
    -- Time-based analysis
    hours_since_posted DECIMAL(4,2) NOT NULL,
    day_of_week INTEGER NOT NULL,
    hour_of_day INTEGER NOT NULL,
    
    -- Context
    data_source VARCHAR(50) DEFAULT 'twitter_api' NOT NULL,
    collection_method VARCHAR(50) DEFAULT 'automated' NOT NULL
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_analytics_tweet_id ON content_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_analytics_recorded_at ON content_analytics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_hours_since ON content_analytics(hours_since_posted);

-- =====================================================================================
-- 5. AI LEARNING AND OPTIMIZATION SYSTEM
-- =====================================================================================

-- AI learning data for continuous improvement
CREATE TABLE IF NOT EXISTS ai_learning_data (
    id SERIAL PRIMARY KEY,
    
    -- Learning event identification
    event_type VARCHAR(50) NOT NULL,
    learning_category VARCHAR(50) NOT NULL,
    
    -- Input data
    input_features JSONB NOT NULL,
    expected_outcome JSONB,
    actual_outcome JSONB NOT NULL,
    
    -- Learning metrics
    accuracy_score DECIMAL(5,4),
    confidence_score DECIMAL(5,4),
    improvement_potential DECIMAL(5,4),
    
    -- Model information
    model_version VARCHAR(50) NOT NULL,
    algorithm_used VARCHAR(50),
    training_data_size INTEGER,
    
    -- Reference data
    reference_tweet_id INTEGER REFERENCES tweets(id) ON DELETE SET NULL,
    reference_config_version INTEGER,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    applied_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for learning data
CREATE INDEX IF NOT EXISTS idx_learning_event_type ON ai_learning_data(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_category ON ai_learning_data(learning_category);
CREATE INDEX IF NOT EXISTS idx_learning_accuracy ON ai_learning_data(accuracy_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_created_at ON ai_learning_data(created_at DESC);

-- =====================================================================================
-- 6. SYSTEM MONITORING AND HEALTH
-- =====================================================================================

-- System health and performance monitoring
CREATE TABLE IF NOT EXISTS system_monitoring (
    id SERIAL PRIMARY KEY,
    
    -- Monitoring metrics
    check_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    component_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    
    -- Performance metrics
    response_time_ms INTEGER,
    memory_usage_mb INTEGER,
    cpu_usage_percent DECIMAL(5,2),
    disk_usage_percent DECIMAL(5,2),
    network_latency_ms INTEGER,
    
    -- Error tracking
    error_count INTEGER DEFAULT 0 NOT NULL,
    error_rate DECIMAL(5,4) DEFAULT 0.0000 NOT NULL,
    last_error_message TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    
    -- Health scores
    availability_score DECIMAL(5,4) DEFAULT 1.0000 NOT NULL,
    performance_score DECIMAL(5,4) DEFAULT 1.0000 NOT NULL,
    reliability_score DECIMAL(5,4) DEFAULT 1.0000 NOT NULL,
    overall_health_score DECIMAL(5,4) DEFAULT 1.0000 NOT NULL,
    
    -- Additional metadata
    version_info JSONB,
    configuration_hash VARCHAR(64),
    environment VARCHAR(20) DEFAULT 'production' NOT NULL
);

-- Indexes for monitoring
CREATE INDEX IF NOT EXISTS idx_monitoring_timestamp ON system_monitoring(check_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_component ON system_monitoring(component_name);
CREATE INDEX IF NOT EXISTS idx_monitoring_status ON system_monitoring(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_health_score ON system_monitoring(overall_health_score DESC);

-- =====================================================================================
-- 7. CONTENT SCHEDULING AND QUEUE MANAGEMENT
-- =====================================================================================

-- Advanced content scheduling system
CREATE TABLE IF NOT EXISTS content_queue (
    id SERIAL PRIMARY KEY,
    
    -- Content information
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'single' NOT NULL,
    content_category VARCHAR(100) NOT NULL,
    content_priority INTEGER DEFAULT 5 NOT NULL,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' NOT NULL,
    
    -- AI metadata
    ai_generated BOOLEAN DEFAULT TRUE NOT NULL,
    ai_model_used VARCHAR(100),
    generation_prompt TEXT,
    content_confidence DECIMAL(3,2),
    predicted_performance DECIMAL(3,2),
    
    -- Optimization data
    optimal_timing_score DECIMAL(3,2),
    audience_alignment_score DECIMAL(3,2),
    competitive_advantage_score DECIMAL(3,2),
    
    -- Execution tracking
    posted_at TIMESTAMP WITH TIME ZONE,
    posted_tweet_id VARCHAR(50),
    posting_attempt_count INTEGER DEFAULT 0 NOT NULL,
    last_error_message TEXT,
    
    -- Content metadata
    hashtags TEXT[] DEFAULT '{}' NOT NULL,
    mentions TEXT[] DEFAULT '{}' NOT NULL,
    media_attachments JSONB DEFAULT '[]' NOT NULL,
    
    -- Analytics linkage
    actual_tweet_id INTEGER REFERENCES tweets(id) ON DELETE SET NULL
);

-- Indexes for content queue
CREATE INDEX IF NOT EXISTS idx_queue_scheduled_for ON content_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON content_queue(content_priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_category ON content_queue(content_category);

-- =====================================================================================
-- 8. TRIGGERS AND AUTOMATED FUNCTIONS
-- =====================================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_tweets_updated_at BEFORE UPDATE ON tweets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_config_updated_at BEFORE UPDATE ON bot_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Engagement score calculation trigger
CREATE OR REPLACE FUNCTION calculate_engagement_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate engagement score using weighted formula
    NEW.engagement_score = COALESCE(
        (NEW.likes * 1) + 
        (NEW.retweets * 3) + 
        (NEW.replies * 2) + 
        (NEW.quotes * 4) + 
        (NEW.bookmarks * 2),
        0
    );
    
    -- Calculate engagement rate (avoid division by zero)
    IF NEW.impressions > 0 THEN
        NEW.engagement_rate = ROUND(
            (NEW.likes + NEW.retweets + NEW.replies + NEW.quotes + NEW.bookmarks)::DECIMAL / NEW.impressions::DECIMAL,
            4
        );
    ELSE
        NEW.engagement_rate = 0.0000;
    END IF;
    
    -- Calculate viral coefficient (retweets/likes ratio)
    IF NEW.likes > 0 THEN
        NEW.viral_coefficient = ROUND(NEW.retweets::DECIMAL / NEW.likes::DECIMAL, 4);
    ELSE
        NEW.viral_coefficient = 0.0000;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply engagement calculation trigger
CREATE TRIGGER calculate_tweet_engagement BEFORE INSERT OR UPDATE ON tweets FOR EACH ROW EXECUTE FUNCTION calculate_engagement_score();

-- =====================================================================================
-- 9. VIEWS FOR COMMON QUERIES
-- =====================================================================================

-- Performance dashboard view
CREATE OR REPLACE VIEW tweet_performance_dashboard AS
SELECT 
    t.id,
    t.tweet_id,
    t.content,
    t.posted_at,
    t.content_category,
    t.engagement_score,
    t.engagement_rate,
    t.viral_coefficient,
    t.likes,
    t.retweets,
    t.replies,
    t.impressions,
    
    -- Performance rankings
    RANK() OVER (ORDER BY t.engagement_score DESC) as engagement_rank,
    RANK() OVER (ORDER BY t.viral_coefficient DESC) as viral_rank,
    
    -- Time-based metrics
    EXTRACT(HOUR FROM t.posted_at) as hour_posted,
    EXTRACT(DOW FROM t.posted_at) as day_of_week,
    
    -- AI prediction accuracy
    ABS(t.predicted_engagement_score - t.engagement_score) as prediction_error,
    
    -- Recent performance (last 24 hours only)
    CASE 
        WHEN t.posted_at > NOW() - INTERVAL '24 hours' THEN 'recent'
        ELSE 'historical'
    END as recency_category
    
FROM tweets t
WHERE t.deleted_at IS NULL
ORDER BY t.posted_at DESC;

-- Daily summary view
CREATE OR REPLACE VIEW daily_posting_summary AS
SELECT 
    DATE(posted_at) as posting_date,
    COUNT(*) as tweets_posted,
    AVG(engagement_score) as avg_engagement,
    AVG(engagement_rate) as avg_engagement_rate,
    SUM(likes) as total_likes,
    SUM(retweets) as total_retweets,
    SUM(replies) as total_replies,
    SUM(impressions) as total_impressions,
    
    -- Best performing tweet of the day
    MAX(engagement_score) as best_engagement_score,
    
    -- Content category distribution
    array_agg(DISTINCT content_category) as categories_used,
    
    -- AI model usage
    array_agg(DISTINCT ai_model_used) as ai_models_used
    
FROM tweets 
WHERE deleted_at IS NULL
GROUP BY DATE(posted_at)
ORDER BY posting_date DESC;

-- =====================================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================================

-- Enable RLS on sensitive tables
ALTER TABLE twitter_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_monitoring ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (customize based on your auth system)
CREATE POLICY "Allow system access to auth sessions" ON twitter_auth_sessions
    FOR ALL USING (TRUE);

CREATE POLICY "Allow system access to learning data" ON ai_learning_data
    FOR ALL USING (TRUE);

CREATE POLICY "Allow system access to monitoring" ON system_monitoring
    FOR ALL USING (TRUE);

-- =====================================================================================
-- 11. FINAL VALIDATION AND COMPLETION
-- =====================================================================================

-- Analyze tables for query optimization
ANALYZE tweets;
ANALYZE bot_config;
ANALYZE content_analytics;
ANALYZE ai_learning_data;
ANALYZE system_monitoring;
ANALYZE content_queue;
ANALYZE twitter_auth_sessions;

-- Log completion
INSERT INTO system_monitoring (
    component_name, 
    status, 
    overall_health_score, 
    version_info
) VALUES (
    'database_schema',
    'healthy',
    1.0000,
    '{"schema_version": "2.0.0", "migration": "supabase_compatible_fix", "timestamp": "' || NOW()::text || '"}'
);

-- Success notification
SELECT 
    '🚀 SUPABASE COMPATIBLE DATABASE SCHEMA FIX COMPLETED!' as status,
    'Schema is now perfectly mapped and optimized' as message,
    NOW() as completed_at;
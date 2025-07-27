-- 🤖 COMPLETE AUTONOMOUS AI AGENT DATABASE SETUP
-- This creates ALL tables needed for the autonomous Twitter growth master system
-- Run this in your Supabase SQL Editor to fix all missing tables

-- ===============================================
-- 🎯 CORE OPERATIONAL TABLES (Already exist)
-- ===============================================

-- tweets table should already exist
-- bot_config table should already exist  
-- system_logs table should already exist

-- ===============================================
-- 🚨 MISSING CRITICAL TABLES FOR AUTONOMOUS SYSTEM
-- ===============================================

-- API Usage Tracking
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,6) DEFAULT 0.000000,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    daily_date DATE DEFAULT CURRENT_DATE
);

-- Bot Usage Tracking  
CREATE TABLE IF NOT EXISTS bot_usage_tracking (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    success BOOLEAN DEFAULT false,
    execution_time_ms INTEGER,
    memory_used_mb DECIMAL(8,2),
    cpu_usage_percent DECIMAL(5,2),
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    daily_date DATE DEFAULT CURRENT_DATE
);

-- Twitter Master Config
CREATE TABLE IF NOT EXISTS twitter_master_config (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    config_type VARCHAR(50) DEFAULT 'general',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    last_updated_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Twitter Master Decisions (Core autonomous decision tracking)
CREATE TABLE IF NOT EXISTS twitter_master_decisions (
    id BIGSERIAL PRIMARY KEY,
    decision_type VARCHAR(50) NOT NULL,
    context JSONB NOT NULL,
    decision JSONB NOT NULL,
    confidence_score DECIMAL(5,4) DEFAULT 0.0000,
    reasoning TEXT,
    execution_status VARCHAR(20) DEFAULT 'pending',
    actual_outcome JSONB,
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 10),
    learning_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- System Health Status
CREATE TABLE IF NOT EXISTS system_health_status (
    id BIGSERIAL PRIMARY KEY,
    component VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'offline')),
    health_score DECIMAL(5,2) DEFAULT 100.00,
    last_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_count INTEGER DEFAULT 0,
    uptime_seconds BIGINT DEFAULT 0,
    performance_metrics JSONB,
    alerts JSONB,
    auto_recovery_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Twitter Platform Intelligence (AI learning about Twitter)
CREATE TABLE IF NOT EXISTS twitter_platform_intelligence (
    id BIGSERIAL PRIMARY KEY,
    intelligence_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL,
    confidence_level DECIMAL(5,4) DEFAULT 0.0000,
    validation_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    last_validated_at TIMESTAMP WITH TIME ZONE,
    impact_score DECIMAL(5,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    learned_from_tweets INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Strategy Decisions
CREATE TABLE IF NOT EXISTS content_strategy_decisions (
    id BIGSERIAL PRIMARY KEY,
    strategy_type VARCHAR(50) NOT NULL,
    content_theme VARCHAR(100),
    decision_data JSONB NOT NULL,
    expected_outcome JSONB,
    actual_outcome JSONB,
    performance_score DECIMAL(5,2),
    audience_segment VARCHAR(100),
    timing_factors JSONB,
    market_conditions JSONB,
    success_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    measured_at TIMESTAMP WITH TIME ZONE
);

-- Twitter Relationships (Following, followers, interactions)
CREATE TABLE IF NOT EXISTS twitter_relationships (
    id BIGSERIAL PRIMARY KEY,
    twitter_user_id VARCHAR(50) NOT NULL,
    username VARCHAR(100),
    relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('following', 'follower', 'mutual', 'targeted')),
    follower_count INTEGER,
    following_count INTEGER,
    engagement_rate DECIMAL(5,4),
    influence_score DECIMAL(5,2),
    content_relevance DECIMAL(5,4),
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    interaction_history JSONB,
    strategic_value VARCHAR(20) DEFAULT 'low',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategic Engagements (AI-planned interactions)
CREATE TABLE IF NOT EXISTS strategic_engagements (
    id BIGSERIAL PRIMARY KEY,
    target_user_id VARCHAR(50) NOT NULL,
    target_username VARCHAR(100),
    engagement_type VARCHAR(30) NOT NULL,
    content_id VARCHAR(50),
    strategy_reasoning TEXT,
    expected_outcome JSONB,
    actual_outcome JSONB,
    engagement_success BOOLEAN,
    response_received BOOLEAN DEFAULT false,
    response_content TEXT,
    strategic_value_realized DECIMAL(5,2),
    follow_up_actions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    measured_at TIMESTAMP WITH TIME ZONE
);

-- Follower Growth Analytics
CREATE TABLE IF NOT EXISTS follower_growth_analytics (
    id BIGSERIAL PRIMARY KEY,
    measurement_date DATE DEFAULT CURRENT_DATE,
    follower_count INTEGER NOT NULL,
    followers_gained_daily INTEGER DEFAULT 0,
    followers_lost_daily INTEGER DEFAULT 0,
    net_growth_daily INTEGER DEFAULT 0,
    growth_rate_percent DECIMAL(5,4) DEFAULT 0.0000,
    growth_attribution JSONB,
    engagement_metrics JSONB,
    quality_metrics JSONB,
    strategic_analysis JSONB,
    ai_insights JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Performance Learning (AI learns what works)
CREATE TABLE IF NOT EXISTS content_performance_learning (
    id BIGSERIAL PRIMARY KEY,
    content_id VARCHAR(50),
    content_type VARCHAR(50),
    content_features JSONB NOT NULL,
    performance_metrics JSONB NOT NULL,
    audience_response JSONB,
    timing_factors JSONB,
    engagement_patterns JSONB,
    viral_indicators JSONB,
    learning_insights JSONB,
    predictive_accuracy DECIMAL(5,4),
    confidence_level DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE
);

-- Trending Opportunities (AI identifies trends to leverage)
CREATE TABLE IF NOT EXISTS trending_opportunities (
    id BIGSERIAL PRIMARY KEY,
    trend_type VARCHAR(50) NOT NULL,
    trend_data JSONB NOT NULL,
    opportunity_score DECIMAL(5,2) DEFAULT 0.00,
    time_sensitivity VARCHAR(20) DEFAULT 'medium',
    target_audience JSONB,
    content_suggestions JSONB,
    competition_analysis JSONB,
    risk_assessment JSONB,
    expected_roi DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'identified',
    exploited_at TIMESTAMP WITH TIME ZONE,
    results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- ===============================================
-- 🎯 AUTONOMOUS GROWTH MASTER SPECIFIC TABLES
-- ===============================================

-- Follower Growth Predictions (Core prediction engine)
CREATE TABLE IF NOT EXISTS follower_growth_predictions (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    
    -- Predictions
    followers_predicted INTEGER DEFAULT 0,
    engagement_rate_predicted DECIMAL(5,4) DEFAULT 0.0000,
    viral_score_predicted DECIMAL(5,4) DEFAULT 0.0000,
    quality_score DECIMAL(5,4) DEFAULT 0.0000,
    boring_score DECIMAL(5,4) DEFAULT 0.0000,
    niche_score DECIMAL(5,4) DEFAULT 0.0000,
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Actual Results
    followers_actual INTEGER,
    engagement_rate_actual DECIMAL(5,4),
    viral_score_actual DECIMAL(5,4),
    prediction_accuracy DECIMAL(5,4),
    
    -- Analysis
    issues JSONB,
    improvements JSONB,
    audience_appeal JSONB,
    optimal_timing TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    validated_at TIMESTAMP WITH TIME ZONE
);

-- Autonomous Decisions (Core decision log)
CREATE TABLE IF NOT EXISTS autonomous_decisions (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64),
    
    -- Decision Details
    action VARCHAR(20) NOT NULL CHECK (action IN ('post', 'improve', 'reject', 'delay')),
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    reasoning JSONB,
    suggested_improvements JSONB,
    
    -- Expected Performance
    expected_followers INTEGER,
    expected_engagement_rate DECIMAL(5,4),
    expected_viral_potential DECIMAL(5,4),
    
    -- Timing
    optimal_timing TIMESTAMP WITH TIME ZONE,
    decision_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Results
    was_posted BOOLEAN DEFAULT false,
    posted_tweet_id BIGINT,
    actual_performance JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Growth Patterns (AI learned patterns)
CREATE TABLE IF NOT EXISTS follower_growth_patterns (
    id BIGSERIAL PRIMARY KEY,
    pattern_identifier VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL,
    
    -- Performance Metrics
    times_used INTEGER DEFAULT 0,
    total_followers_gained INTEGER DEFAULT 0,
    average_followers_gained DECIMAL(8,2) DEFAULT 0.00,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    average_engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Analysis
    content_themes JSONB,
    timing_patterns JSONB,
    audience_segments JSONB,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    confidence_score DECIMAL(5,4) DEFAULT 0.0000,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(pattern_identifier, pattern_type)
);

-- ===============================================
-- 🔧 INDEXES FOR PERFORMANCE
-- ===============================================

-- API Usage Tracking indexes
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_daily_date ON api_usage_tracking(daily_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_endpoint ON api_usage_tracking(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_created_at ON api_usage_tracking(created_at);

-- Bot Usage Tracking indexes
CREATE INDEX IF NOT EXISTS idx_bot_usage_tracking_daily_date ON bot_usage_tracking(daily_date);
CREATE INDEX IF NOT EXISTS idx_bot_usage_tracking_action ON bot_usage_tracking(action);

-- Twitter Master Decisions indexes
CREATE INDEX IF NOT EXISTS idx_twitter_master_decisions_type ON twitter_master_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_twitter_master_decisions_created_at ON twitter_master_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_twitter_master_decisions_status ON twitter_master_decisions(execution_status);

-- System Health Status indexes
CREATE INDEX IF NOT EXISTS idx_system_health_status_component ON system_health_status(component);
CREATE INDEX IF NOT EXISTS idx_system_health_status_status ON system_health_status(status);
CREATE INDEX IF NOT EXISTS idx_system_health_status_updated_at ON system_health_status(updated_at);

-- Growth Predictions indexes
CREATE INDEX IF NOT EXISTS idx_follower_growth_predictions_content_hash ON follower_growth_predictions(content_hash);
CREATE INDEX IF NOT EXISTS idx_follower_growth_predictions_created_at ON follower_growth_predictions(created_at);

-- ===============================================
-- 🚀 INITIAL DATA FOR AUTONOMOUS SYSTEM
-- ===============================================

-- Insert initial Twitter Master configurations
INSERT INTO twitter_master_config (config_key, config_value, config_type, description) VALUES 
('follower_growth_target', '{"daily": 10, "weekly": 70, "monthly": 300}', 'growth', 'Target follower growth rates')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

INSERT INTO twitter_master_config (config_key, config_value, config_type, description) VALUES 
('content_quality_thresholds', '{"viral_score": 0.7, "quality_score": 0.8, "boring_score": 0.3}', 'content', 'Content quality thresholds for posting decisions')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

INSERT INTO twitter_master_config (config_key, config_value, config_type, description) VALUES 
('autonomous_operation', '{"enabled": true, "learning_mode": true, "auto_posting": true}', 'system', 'Autonomous operation settings')
ON CONFLICT (config_key) DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- Insert initial system health status
INSERT INTO system_health_status (component, status, health_score) VALUES 
('autonomous_growth_master', 'healthy', 100.00),
('posting_engine', 'healthy', 100.00),
('learning_system', 'healthy', 100.00),
('prediction_engine', 'healthy', 100.00)
ON CONFLICT (component) DO UPDATE SET 
    status = EXCLUDED.status,
    health_score = EXCLUDED.health_score,
    updated_at = NOW();

-- ===============================================
-- ✅ SETUP COMPLETE
-- ===============================================

-- Verify tables were created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'api_usage_tracking', 'bot_usage_tracking', 'twitter_master_config',
        'twitter_master_decisions', 'system_health_status', 'twitter_platform_intelligence',
        'content_strategy_decisions', 'twitter_relationships', 'strategic_engagements',
        'follower_growth_analytics', 'content_performance_learning', 'trending_opportunities',
        'follower_growth_predictions', 'autonomous_decisions', 'follower_growth_patterns'
    );
    
    RAISE NOTICE '✅ AUTONOMOUS AI AGENT DATABASE SETUP COMPLETE';
    RAISE NOTICE '📊 Created/verified % tables for autonomous operation', table_count;
    RAISE NOTICE '🤖 Your autonomous Twitter growth master is ready!';
END $$; 
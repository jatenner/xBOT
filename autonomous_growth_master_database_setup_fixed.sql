-- 🎯 AUTONOMOUS TWITTER GROWTH MASTER - FIXED DATABASE SETUP
-- This script creates all the necessary tables for the autonomous system
-- Run this in your Supabase SQL Editor

-- ===============================================
-- 🎯 FOLLOWER GROWTH PREDICTIONS TABLE
-- ===============================================
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

-- ===============================================
-- 🤖 AUTONOMOUS DECISION LOG
-- ===============================================
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

-- ===============================================
-- 📈 FOLLOWER GROWTH PATTERNS
-- ===============================================
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
-- 📊 CONTENT QUALITY ANALYSIS
-- ===============================================
CREATE TABLE IF NOT EXISTS content_quality_analysis (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    
    -- Quality Scores
    overall_quality DECIMAL(5,4) DEFAULT 0.0000,
    boring_score DECIMAL(5,4) DEFAULT 0.0000,
    niche_score DECIMAL(5,4) DEFAULT 0.0000,
    engagement_hooks INTEGER DEFAULT 0,
    viral_elements INTEGER DEFAULT 0,
    
    -- Content Features
    has_question BOOLEAN DEFAULT false,
    has_data BOOLEAN DEFAULT false,
    has_controversy BOOLEAN DEFAULT false,
    character_count INTEGER DEFAULT 0,
    
    -- Audience Appeal
    broad_appeal DECIMAL(5,4) DEFAULT 0.0000,
    niche_factor DECIMAL(5,4) DEFAULT 0.0000,
    viral_potential DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Issues and Improvements
    identified_issues JSONB,
    suggested_improvements JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 👥 REAL-TIME FOLLOWER TRACKING
-- ===============================================
CREATE TABLE IF NOT EXISTS follower_tracking (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT,
    
    -- Follower Metrics
    followers_before INTEGER DEFAULT 0,
    followers_after INTEGER DEFAULT 0,
    followers_gained_1h INTEGER DEFAULT 0,
    followers_gained_24h INTEGER DEFAULT 0,
    followers_gained_7d INTEGER DEFAULT 0,
    
    -- Engagement Metrics
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    
    -- Growth Rate Analysis
    growth_rate_1h DECIMAL(8,6) DEFAULT 0.000000,
    growth_rate_24h DECIMAL(8,6) DEFAULT 0.000000,
    growth_rate_7d DECIMAL(8,6) DEFAULT 0.000000,
    
    -- Timing
    tracked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    post_timestamp TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 🔮 PREDICTIVE MODEL PERFORMANCE
-- ===============================================
CREATE TABLE IF NOT EXISTS prediction_model_performance (
    id BIGSERIAL PRIMARY KEY,
    model_type VARCHAR(50) NOT NULL,
    model_version VARCHAR(20) DEFAULT '1.0',
    
    -- Performance Metrics
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    accuracy DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Error Analysis
    average_error DECIMAL(8,4) DEFAULT 0.0000,
    max_error DECIMAL(8,4) DEFAULT 0.0000,
    min_error DECIMAL(8,4) DEFAULT 0.0000,
    
    -- Specific Accuracy Metrics
    follower_prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    engagement_prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    viral_prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Model Data
    model_parameters JSONB,
    training_data_size INTEGER DEFAULT 0,
    last_training_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 🎯 AUTONOMOUS GROWTH STRATEGIES
-- ===============================================
CREATE TABLE IF NOT EXISTS autonomous_growth_strategies (
    id BIGSERIAL PRIMARY KEY,
    strategy_name VARCHAR(100) NOT NULL UNIQUE,
    strategy_type VARCHAR(50) NOT NULL,
    strategy_config JSONB NOT NULL,
    
    -- Performance
    times_used INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    average_followers_gained DECIMAL(8,2) DEFAULT 0.00,
    average_engagement_boost DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    confidence_level DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Learning
    adaptations_made INTEGER DEFAULT 0,
    last_adaptation_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- ✨ CONTENT OPTIMIZATION HISTORY
-- ===============================================
CREATE TABLE IF NOT EXISTS content_optimization_history (
    id BIGSERIAL PRIMARY KEY,
    original_content TEXT NOT NULL,
    optimized_content TEXT NOT NULL,
    optimization_type VARCHAR(50) NOT NULL,
    
    -- Improvements Applied
    improvements_applied JSONB,
    optimization_reasoning TEXT,
    
    -- Performance Comparison
    original_predicted_performance JSONB,
    optimized_predicted_performance JSONB,
    actual_performance JSONB,
    
    -- Success Metrics
    optimization_success BOOLEAN,
    performance_improvement DECIMAL(8,4),
    follower_gain_improvement INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 🛡️ SYSTEM HEALTH METRICS
-- ===============================================
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id BIGSERIAL PRIMARY KEY,
    
    -- Overall Health
    overall_health VARCHAR(20) CHECK (overall_health IN ('healthy', 'degraded', 'critical')),
    
    -- Component Health
    autonomous_growth_master_running BOOLEAN DEFAULT false,
    autonomous_growth_master_learning BOOLEAN DEFAULT false,
    budget_system_active BOOLEAN DEFAULT false,
    database_connected BOOLEAN DEFAULT false,
    
    -- Performance Metrics
    memory_usage_mb INTEGER DEFAULT 0,
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0.00,
    database_response_time_ms INTEGER DEFAULT 0,
    prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Error Counts
    consecutive_errors INTEGER DEFAULT 0,
    recovery_attempts INTEGER DEFAULT 0,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 📈 SYSTEM PERFORMANCE METRICS
-- ===============================================
CREATE TABLE IF NOT EXISTS system_performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    
    -- Activity Metrics
    tweets_posted_24h INTEGER DEFAULT 0,
    followers_gained_24h INTEGER DEFAULT 0,
    engagement_rate_24h DECIMAL(5,4) DEFAULT 0.0000,
    
    -- AI Usage
    ai_calls_made_24h INTEGER DEFAULT 0,
    ai_budget_spent_24h DECIMAL(8,4) DEFAULT 0.0000,
    ai_budget_efficiency DECIMAL(5,4) DEFAULT 0.0000,
    
    -- System Performance
    uptime_hours DECIMAL(8,2) DEFAULT 0.00,
    error_rate_24h DECIMAL(5,4) DEFAULT 0.0000,
    self_healing_actions_24h INTEGER DEFAULT 0,
    
    -- Learning Metrics
    patterns_learned_24h INTEGER DEFAULT 0,
    model_accuracy_improvement DECIMAL(8,6) DEFAULT 0.000000,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- 🚨 SYSTEM ALERTS
-- ===============================================
CREATE TABLE IF NOT EXISTS system_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    alert_severity VARCHAR(20) CHECK (alert_severity IN ('info', 'warning', 'error', 'critical')),
    alert_message TEXT NOT NULL,
    alert_data JSONB,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_action TEXT,
    
    -- Recovery
    recovery_attempts INTEGER DEFAULT 0,
    auto_recovery_successful BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
); 
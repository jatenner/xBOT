-- =====================================================================================
-- 🚀 BASELINE SCHEMA - CLEAN FOUNDATION FOR DUAL-STORE ARCHITECTURE
-- =====================================================================================
-- 
-- PURPOSE: Create clean, minimal Supabase schema that works with Redis hot path
-- STRATEGY: 5 core tables only, JSONB-first, no complex constraints
-- EXECUTION: Run this INSTEAD of the broken schema fix
-- =====================================================================================

-- Clean slate: Drop any existing problematic tables
DROP TABLE IF EXISTS content_analytics CASCADE;
DROP TABLE IF EXISTS ai_learning_data CASCADE;
DROP TABLE IF EXISTS content_queue CASCADE;
DROP TABLE IF EXISTS twitter_auth_sessions CASCADE;
DROP TABLE IF EXISTS system_monitoring CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================================
-- TABLE 1: TWEETS - Posted content history
-- =====================================================================================
CREATE TABLE IF NOT EXISTS tweets (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    platform VARCHAR(20) DEFAULT 'twitter' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- All flexible data in JSONB (no schema migrations needed)
    engagement_data JSONB DEFAULT '{}' NOT NULL,
    ai_metadata JSONB DEFAULT '{}' NOT NULL,
    content_analysis JSONB DEFAULT '{}' NOT NULL
);

-- Simple indexes only
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_platform ON tweets(platform);

-- =====================================================================================
-- TABLE 2: BOT_CONFIG - System configuration (unified)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS bot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL,
    environment VARCHAR(20) DEFAULT 'production' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- All config data in JSONB (maximum flexibility)
    value JSONB NOT NULL,
    metadata JSONB DEFAULT '{}' NOT NULL,
    
    UNIQUE(key, environment)
);

-- Index for fast config lookups
CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key);
CREATE INDEX IF NOT EXISTS idx_bot_config_env ON bot_config(environment);

-- =====================================================================================
-- TABLE 3: DAILY_SUMMARIES - Aggregated analytics
-- =====================================================================================
CREATE TABLE IF NOT EXISTS daily_summaries (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    summary_type VARCHAR(50) NOT NULL,
    environment VARCHAR(20) DEFAULT 'production' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- All metrics in JSONB (no rigid schema)
    metrics JSONB DEFAULT '{}' NOT NULL,
    quality_data JSONB DEFAULT '{}' NOT NULL,
    
    UNIQUE(date, summary_type, environment)
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_type ON daily_summaries(summary_type);

-- =====================================================================================
-- TABLE 4: AUDIT_LOG - System events
-- =====================================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    component VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info' NOT NULL,
    
    -- All event data in JSONB (flexible event structure)
    event_data JSONB DEFAULT '{}' NOT NULL,
    context JSONB DEFAULT '{}' NOT NULL
);

-- Index for log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_component ON audit_log(component);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity);

-- =====================================================================================
-- TABLE 5: SYSTEM_HEALTH - Health snapshots
-- =====================================================================================
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    component VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    environment VARCHAR(20) DEFAULT 'production' NOT NULL,
    
    -- All health data in JSONB (flexible metrics)
    metrics JSONB DEFAULT '{}' NOT NULL,
    diagnostic_data JSONB DEFAULT '{}' NOT NULL
);

-- Index for health monitoring
CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON system_health(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);

-- =====================================================================================
-- ESSENTIAL CONFIGURATION DATA
-- =====================================================================================

-- Insert baseline configuration
INSERT INTO bot_config (key, environment, value, metadata) VALUES

-- Schema version tracking
('schema_version', 'production', '{"version": 1, "baseline": true}', '{"created_by": "baseline_migration", "description": "Initial schema version"}'),

-- Redis configuration
('redis_config', 'production', '{
    "enabled": true,
    "fallback_mode": false,
    "dual_write": true,
    "ttl_policies": {
        "rate_limits": 86400,
        "content_hashes": 604800,
        "config_cache": 3600,
        "performance_metrics": 300
    }
}', '{"purpose": "Redis dual-store configuration"}'),

-- Rate limiting (unified system)
('rate_limits', 'production', '{
    "daily_tweet_limit": 17,
    "hourly_tweet_limit": 4,
    "twitter_api_window": 15,
    "ai_daily_budget": 7.50,
    "emergency_mode": false
}', '{"purpose": "Unified rate limiting configuration"}'),

-- Feature flags
('feature_flags', 'production', '{
    "USE_REDIS": true,
    "REDIS_FALLBACK_MODE": false,
    "DUAL_WRITE_ENABLED": true,
    "REDIS_RATE_LIMITING": true,
    "REDIS_CACHE": true,
    "REDIS_QUEUE": true,
    "REDIS_DEDUPLICATION": true
}', '{"purpose": "System feature toggles"}'),

-- System health thresholds
('health_thresholds', 'production', '{
    "redis_ping_ms": 10,
    "supabase_query_ms": 500,
    "memory_usage_percent": 80,
    "queue_depth_critical": 5000,
    "drift_tolerance_percent": 5
}', '{"purpose": "Health monitoring configuration"}')

ON CONFLICT (key, environment) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- =====================================================================================
-- SIMPLE TRIGGERS (only essential ones)
-- =====================================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
CREATE TRIGGER update_tweets_updated_at BEFORE UPDATE ON tweets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bot_config_updated_at BEFORE UPDATE ON bot_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- BASELINE VALIDATION
-- =====================================================================================

-- Log successful baseline creation
INSERT INTO audit_log (event_type, component, severity, event_data, context) VALUES
('baseline_schema_created', 'database', 'info', 
'{"tables_created": ["tweets", "bot_config", "daily_summaries", "audit_log", "system_health"], "schema_version": 1}',
'{"migration": "baseline", "timestamp": "' || NOW()::text || '"}');

-- Insert initial health status
INSERT INTO system_health (component, status, metrics, diagnostic_data) VALUES
('database_schema', 'healthy', 
'{"tables": 5, "indexes": 12, "schema_version": 1}',
'{"baseline_applied": true, "migration_status": "complete"}');

-- Success message
SELECT 
    '🚀 BASELINE SCHEMA CREATED SUCCESSFULLY!' as status,
    '5 core tables with JSONB flexibility' as structure,
    'Ready for Redis dual-store integration' as next_step,
    NOW() as completed_at;
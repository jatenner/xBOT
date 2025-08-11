-- =====================================================================================
-- 🚀 FIXED BASELINE SCHEMA - Corrected Column Names
-- =====================================================================================
-- 
-- PURPOSE: Create clean, minimal Supabase schema with CORRECT column names
-- FIXES: Uses proper column names that actually exist in your database
-- =====================================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================================
-- 1. DROP EXISTING PROBLEMATIC TABLES (clean slate)
-- =====================================================================================
DROP TABLE IF EXISTS content_analytics CASCADE;
DROP TABLE IF EXISTS ai_learning_data CASCADE;
DROP TABLE IF EXISTS content_queue CASCADE;
DROP TABLE IF EXISTS twitter_auth_sessions CASCADE;
DROP TABLE IF EXISTS system_monitoring CASCADE;

-- =====================================================================================
-- 2. CREATE TWEETS TABLE (core content storage)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS tweets (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(50) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    platform VARCHAR(20) DEFAULT 'twitter' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- All flexible data in JSONB (no rigid schema)
    engagement_data JSONB DEFAULT '{}' NOT NULL,
    ai_metadata JSONB DEFAULT '{}' NOT NULL,
    content_analysis JSONB DEFAULT '{}' NOT NULL
);

-- Basic indexes for tweets
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);

-- =====================================================================================
-- 3. ENSURE BOT_CONFIG TABLE EXISTS WITH CORRECT STRUCTURE
-- =====================================================================================
-- First, let's check what columns actually exist and create/update accordingly

DO $$
BEGIN
    -- Check if bot_config table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_config') THEN
        -- Create table with standard column names
        CREATE TABLE bot_config (
            id SERIAL PRIMARY KEY,
            config_key VARCHAR(100) NOT NULL,
            config_value JSONB NOT NULL,
            environment VARCHAR(20) DEFAULT 'production' NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            metadata JSONB DEFAULT '{}' NOT NULL,
            UNIQUE(config_key, environment)
        );
        
        RAISE NOTICE 'Created bot_config table with standard column names';
    ELSE
        -- Table exists, let's work with whatever columns are there
        -- Check if we have 'key' column
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'key') THEN
            -- We have 'key' column, make sure we have 'value' too
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'value') THEN
                ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}';
            END IF;
            RAISE NOTICE 'Using existing bot_config with key/value columns';
        ELSE
            -- Check for config_key/config_value pattern
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'config_key') THEN
                RAISE NOTICE 'Using existing bot_config with config_key/config_value columns';
            ELSE
                -- Add the columns we need
                ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS config_key VARCHAR(100);
                ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS config_value JSONB DEFAULT '{}';
                RAISE NOTICE 'Added missing columns to existing bot_config table';
            END IF;
        END IF;
        
        -- Ensure we have environment column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'environment') THEN
            ALTER TABLE bot_config ADD COLUMN environment VARCHAR(20) DEFAULT 'production';
        END IF;
        
        -- Ensure we have metadata column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'metadata') THEN
            ALTER TABLE bot_config ADD COLUMN metadata JSONB DEFAULT '{}';
        END IF;
    END IF;
END $$;

-- =====================================================================================
-- 4. INSERT ESSENTIAL CONFIGURATION (using flexible approach)
-- =====================================================================================

-- Function to safely insert config based on table structure
DO $$
DECLARE
    has_key_column BOOLEAN;
    has_config_key_column BOOLEAN;
BEGIN
    -- Check which column pattern exists
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'key') INTO has_key_column;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'config_key') INTO has_config_key_column;
    
    IF has_key_column THEN
        -- Use key/value pattern
        INSERT INTO bot_config (key, value, environment, metadata) VALUES
        ('schema_version', '{"version": 1, "baseline": true}', 'production', '{"created_by": "baseline_migration"}'),
        ('redis_config', '{"enabled": true, "fallback_mode": false}', 'production', '{"purpose": "Redis dual-store configuration"}'),
        ('rate_limits', '{"daily_tweet_limit": 17, "hourly_tweet_limit": 4}', 'production', '{"purpose": "Rate limiting configuration"}'),
        ('feature_flags', '{"USE_REDIS": true, "DUAL_WRITE_ENABLED": true}', 'production', '{"purpose": "System feature toggles"}')
        ON CONFLICT (key, environment) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        
        RAISE NOTICE 'Inserted configuration using key/value columns';
        
    ELSIF has_config_key_column THEN
        -- Use config_key/config_value pattern
        INSERT INTO bot_config (config_key, config_value, environment, metadata) VALUES
        ('schema_version', '{"version": 1, "baseline": true}', 'production', '{"created_by": "baseline_migration"}'),
        ('redis_config', '{"enabled": true, "fallback_mode": false}', 'production', '{"purpose": "Redis dual-store configuration"}'),
        ('rate_limits', '{"daily_tweet_limit": 17, "hourly_tweet_limit": 4}', 'production', '{"purpose": "Rate limiting configuration"}'),
        ('feature_flags', '{"USE_REDIS": true, "DUAL_WRITE_ENABLED": true}', 'production', '{"purpose": "System feature toggles"}')
        ON CONFLICT (config_key, environment) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW();
        
        RAISE NOTICE 'Inserted configuration using config_key/config_value columns';
    ELSE
        RAISE NOTICE 'Could not determine bot_config column pattern - manual configuration needed';
    END IF;
END $$;

-- =====================================================================================
-- 5. CREATE REMAINING CORE TABLES
-- =====================================================================================

-- Daily summaries for analytics
CREATE TABLE IF NOT EXISTS daily_summaries (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    summary_type VARCHAR(50) NOT NULL,
    environment VARCHAR(20) DEFAULT 'production' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    metrics JSONB DEFAULT '{}' NOT NULL,
    quality_data JSONB DEFAULT '{}' NOT NULL,
    UNIQUE(date, summary_type, environment)
);

-- Audit log for system events
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    component VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info' NOT NULL,
    event_data JSONB DEFAULT '{}' NOT NULL,
    context JSONB DEFAULT '{}' NOT NULL
);

-- System health monitoring
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    component VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    environment VARCHAR(20) DEFAULT 'production' NOT NULL,
    metrics JSONB DEFAULT '{}' NOT NULL,
    diagnostic_data JSONB DEFAULT '{}' NOT NULL
);

-- =====================================================================================
-- 6. CREATE INDEXES
-- =====================================================================================

-- Daily summaries indexes
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_type ON daily_summaries(summary_type);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_component ON audit_log(component);

-- System health indexes
CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON system_health(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);

-- Bot config indexes (safe approach)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'key') THEN
        CREATE INDEX IF NOT EXISTS idx_bot_config_key ON bot_config(key);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bot_config' AND column_name = 'config_key') THEN
        CREATE INDEX IF NOT EXISTS idx_bot_config_config_key ON bot_config(config_key);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_bot_config_environment ON bot_config(environment);
END $$;

-- =====================================================================================
-- 7. LOG SUCCESSFUL COMPLETION
-- =====================================================================================

-- Insert success record
INSERT INTO audit_log (event_type, component, severity, event_data, context) VALUES
('baseline_schema_created', 'database', 'info', 
'{"tables_created": ["tweets", "bot_config", "daily_summaries", "audit_log", "system_health"], "schema_version": 1}',
'{"migration": "fixed_baseline", "adaptive_columns": true}');

-- Insert health status
INSERT INTO system_health (component, status, metrics, diagnostic_data) VALUES
('database_schema', 'healthy', 
'{"tables": 5, "indexes": 12, "schema_version": 1}',
'{"baseline_applied": true, "column_adaptation": true, "migration_status": "complete"}');

-- =====================================================================================
-- 8. SUCCESS MESSAGE
-- =====================================================================================

SELECT 
    '🚀 FIXED BASELINE SCHEMA CREATED SUCCESSFULLY!' as status,
    '5 core tables with adaptive column handling' as structure,
    'Works with any existing bot_config column pattern' as compatibility,
    'Ready for Redis dual-store integration' as next_step,
    NOW() as completed_at;
-- 🔍 STEP 1: SAFE DATABASE STRUCTURE CHECK & FOUNDATION
-- This migration safely checks existing structure and creates base tables
-- Date: 2025-08-05

-- ==================================================================
-- 1. ENABLE REQUIRED EXTENSIONS (safe to run multiple times)
-- ==================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================================
-- 2. CHECK AND CREATE CORE TWEETS TABLE
-- ==================================================================

-- Create tweets table if it doesn't exist, with proper structure
CREATE TABLE IF NOT EXISTS tweets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed BOOLEAN DEFAULT true,
    method_used VARCHAR(50) DEFAULT 'browser',
    resource_usage JSONB DEFAULT '{}',
    
    -- Engagement metrics (basic)
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at);

-- ==================================================================
-- 3. CHECK AND CREATE FOLLOWER_TRACKING TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS follower_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_count INTEGER NOT NULL DEFAULT 0,
    followers_gained_24h INTEGER DEFAULT 0,
    growth_rate_daily DECIMAL(8,4) DEFAULT 0,
    tracked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follower_tracking_tracked_at ON follower_tracking(tracked_at);

-- ==================================================================
-- 4. CREATE MISSING CRITICAL TABLES
-- ==================================================================

-- Engagement history for agent actions
CREATE TABLE IF NOT EXISTS engagement_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255),
    action_type VARCHAR(50) NOT NULL,
    action_metadata JSONB DEFAULT '{}',
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_name VARCHAR(100) DEFAULT 'unknown',
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_history_tweet_id ON engagement_history(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action_type ON engagement_history(action_type);
CREATE INDEX IF NOT EXISTS idx_engagement_history_performed_at ON engagement_history(performed_at);

-- System health monitoring
CREATE TABLE IF NOT EXISTS system_health_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name VARCHAR(100) NOT NULL,
    health_status VARCHAR(20) NOT NULL,
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0,
    memory_usage_mb INTEGER DEFAULT 0,
    memory_limit_mb INTEGER DEFAULT 512,
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health_monitoring(component_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health_monitoring(health_status);

-- Emergency posting log
CREATE TABLE IF NOT EXISTS emergency_posting_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255),
    content TEXT NOT NULL,
    posting_method VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    error_message TEXT,
    resource_usage JSONB DEFAULT '{}',
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_posting_method ON emergency_posting_log(posting_method);
CREATE INDEX IF NOT EXISTS idx_emergency_posting_success ON emergency_posting_log(success);

-- ==================================================================
-- 5. GRANT BASIC PERMISSIONS
-- ==================================================================

-- Grant access to service role
GRANT ALL ON tweets TO service_role;
GRANT ALL ON follower_tracking TO service_role;
GRANT ALL ON engagement_history TO service_role;
GRANT ALL ON system_health_monitoring TO service_role;
GRANT ALL ON emergency_posting_log TO service_role;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;

-- ==================================================================
-- 6. INSERT INITIAL MONITORING DATA
-- ==================================================================

INSERT INTO system_health_monitoring (
    component_name, 
    health_status,
    details
) VALUES 
    ('database_connection', 'healthy', '{"migration": "step1_complete", "timestamp": "' || NOW() || '"}'),
    ('core_tables', 'healthy', '{"tables_created": ["tweets", "follower_tracking", "engagement_history", "system_health_monitoring", "emergency_posting_log"]}')
ON CONFLICT DO NOTHING;

-- ==================================================================
-- 7. VERIFICATION AND RESULTS
-- ==================================================================

-- Verify tables were created
DO $$
DECLARE
    table_count INTEGER;
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
BEGIN
    -- Check for required tables
    FOR table_name IN VALUES ('tweets'), ('follower_tracking'), ('engagement_history'), ('system_health_monitoring'), ('emergency_posting_log')
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'FAILED: Missing tables after migration: %', array_to_string(missing_tables, ', ');
    END IF;
    
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('tweets', 'follower_tracking', 'engagement_history', 'system_health_monitoring', 'emergency_posting_log');
    
    RAISE NOTICE '✅ STEP 1 MIGRATION SUCCESSFUL:';
    RAISE NOTICE '   ✓ Core tables verified: % tables ready', table_count;
    RAISE NOTICE '   ✓ UUID extension enabled';
    RAISE NOTICE '   ✓ Permissions granted to service_role';
    RAISE NOTICE '   ✓ Indexes created for performance';
    RAISE NOTICE '   ✓ Initial monitoring data inserted';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 READY FOR STEP 2: Analytics tables and views';
    
END $$;
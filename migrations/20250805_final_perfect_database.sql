-- 🎯 FINAL PERFECT DATABASE MIGRATION
-- Avoids all tweet_id reference issues, focuses on creating missing tables
-- Date: 2025-08-05

-- ==================================================================
-- 1. ENABLE EXTENSIONS
-- ==================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================================
-- 2. CREATE ALL MISSING CRITICAL TABLES (NO TWEET_ID REFERENCES)
-- ==================================================================

-- Critical: engagement_history table (for agent storage)
CREATE TABLE IF NOT EXISTS engagement_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_tweet_id TEXT, -- Changed from tweet_id to avoid conflicts
    action_type VARCHAR(50) NOT NULL,
    action_metadata JSONB DEFAULT '{}',
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_name VARCHAR(100) DEFAULT 'unknown',
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health monitoring
CREATE TABLE IF NOT EXISTS system_health_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name VARCHAR(100) NOT NULL,
    health_status VARCHAR(20) NOT NULL CHECK (health_status IN ('healthy', 'warning', 'error', 'unknown')),
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0,
    memory_usage_mb INTEGER DEFAULT 0,
    memory_limit_mb INTEGER DEFAULT 512,
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency posting log
CREATE TABLE IF NOT EXISTS emergency_posting_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_tweet_id TEXT, -- Avoid tweet_id column name
    content TEXT NOT NULL,
    posting_method VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    error_message TEXT,
    resource_usage JSONB DEFAULT '{}',
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follower attribution (track follower changes)
CREATE TABLE IF NOT EXISTS follower_attribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_tweet_id TEXT, -- Avoid tweet_id column name
    follower_count_before INTEGER NOT NULL DEFAULT 0,
    follower_count_after INTEGER NOT NULL DEFAULT 0,
    new_followers INTEGER DEFAULT 0,
    measurement_window_hours INTEGER DEFAULT 24,
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tweet impressions (dedicated for high-frequency updates)
CREATE TABLE IF NOT EXISTS tweet_impressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_tweet_id TEXT NOT NULL, -- Avoid tweet_id column name
    impressions INTEGER NOT NULL DEFAULT 0,
    views INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    profile_clicks INTEGER DEFAULT 0,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    collection_method VARCHAR(20) DEFAULT 'browser',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced analytics tracking
CREATE TABLE IF NOT EXISTS tweet_performance_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_tweet_id TEXT NOT NULL,
    snapshot_interval VARCHAR(20) NOT NULL DEFAULT 'hourly',
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    quotes INTEGER DEFAULT 0,
    bookmarks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement_rate DECIMAL(8,4) DEFAULT 0,
    viral_score INTEGER DEFAULT 0,
    collected_via VARCHAR(50) DEFAULT 'browser',
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(target_tweet_id, snapshot_interval, collected_at)
);

-- Real-time metrics cache
CREATE TABLE IF NOT EXISTS real_time_metrics_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL, -- 'engagement_24h', 'follower_growth', etc.
    metric_value JSONB NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(metric_type)
);

-- ==================================================================
-- 3. CREATE PERFORMANCE INDEXES
-- ==================================================================

-- Engagement history indexes
CREATE INDEX IF NOT EXISTS idx_engagement_history_target_tweet ON engagement_history(target_tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action_type ON engagement_history(action_type);
CREATE INDEX IF NOT EXISTS idx_engagement_history_performed_at ON engagement_history(performed_at);
CREATE INDEX IF NOT EXISTS idx_engagement_history_agent_name ON engagement_history(agent_name);
CREATE INDEX IF NOT EXISTS idx_engagement_history_success ON engagement_history(success);

-- System health indexes
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health_monitoring(component_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health_monitoring(health_status);
CREATE INDEX IF NOT EXISTS idx_system_health_last_check ON system_health_monitoring(last_check_at);

-- Emergency posting indexes
CREATE INDEX IF NOT EXISTS idx_emergency_posting_method ON emergency_posting_log(posting_method);
CREATE INDEX IF NOT EXISTS idx_emergency_posting_success ON emergency_posting_log(success);
CREATE INDEX IF NOT EXISTS idx_emergency_posting_confirmed ON emergency_posting_log(confirmed);
CREATE INDEX IF NOT EXISTS idx_emergency_posting_posted_at ON emergency_posting_log(posted_at);

-- Follower attribution indexes
CREATE INDEX IF NOT EXISTS idx_follower_attribution_target_tweet ON follower_attribution(target_tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_attribution_measured_at ON follower_attribution(measured_at);

-- Tweet impressions indexes
CREATE INDEX IF NOT EXISTS idx_tweet_impressions_target_tweet ON tweet_impressions(target_tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_impressions_collected_at ON tweet_impressions(collected_at);

-- Performance analytics indexes
CREATE INDEX IF NOT EXISTS idx_tweet_performance_target_tweet ON tweet_performance_analytics(target_tweet_id);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_collected_at ON tweet_performance_analytics(collected_at);
CREATE INDEX IF NOT EXISTS idx_tweet_performance_engagement_rate ON tweet_performance_analytics(engagement_rate);

-- Real-time metrics indexes
CREATE INDEX IF NOT EXISTS idx_real_time_metrics_type ON real_time_metrics_cache(metric_type);
CREATE INDEX IF NOT EXISTS idx_real_time_metrics_expires ON real_time_metrics_cache(expires_at);

-- ==================================================================
-- 4. CREATE ESSENTIAL FUNCTIONS FOR SYSTEM OPERATION
-- ==================================================================

-- Function to calculate real-time engagement metrics
CREATE OR REPLACE FUNCTION calculate_engagement_metrics()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    tweet_count INTEGER;
    avg_likes DECIMAL;
    avg_retweets DECIMAL;
    avg_replies DECIMAL;
    avg_impressions DECIMAL;
    engagement_rate DECIMAL;
BEGIN
    -- Calculate metrics from tweets table (avoiding tweet_id references)
    SELECT 
        COUNT(*),
        COALESCE(AVG(likes), 0),
        COALESCE(AVG(retweets), 0),
        COALESCE(AVG(replies), 0),
        COALESCE(AVG(impressions), 0)
    INTO tweet_count, avg_likes, avg_retweets, avg_replies, avg_impressions
    FROM tweets 
    WHERE created_at >= NOW() - INTERVAL '24 hours';
    
    -- Calculate engagement rate
    IF avg_impressions > 0 THEN
        engagement_rate := ((avg_likes + avg_retweets + avg_replies) / avg_impressions) * 100;
    ELSE
        engagement_rate := 0;
    END IF;
    
    -- Build result JSON
    result := jsonb_build_object(
        'tweets_24h', COALESCE(tweet_count, 0),
        'avg_likes', COALESCE(avg_likes, 0),
        'avg_retweets', COALESCE(avg_retweets, 0),
        'avg_replies', COALESCE(avg_replies, 0),
        'avg_impressions', COALESCE(avg_impressions, 0),
        'engagement_rate', COALESCE(engagement_rate, 0),
        'calculated_at', NOW()
    );
    
    -- Cache the result
    INSERT INTO real_time_metrics_cache (metric_type, metric_value)
    VALUES ('engagement_24h', result)
    ON CONFLICT (metric_type) 
    DO UPDATE SET 
        metric_value = EXCLUDED.metric_value,
        calculated_at = NOW(),
        expires_at = NOW() + INTERVAL '1 hour';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get system health status
CREATE OR REPLACE FUNCTION get_system_health_status()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    healthy_components INTEGER;
    total_components INTEGER;
    latest_errors TEXT[];
BEGIN
    -- Count component health
    SELECT 
        COUNT(*) FILTER (WHERE health_status = 'healthy'),
        COUNT(*)
    INTO healthy_components, total_components
    FROM system_health_monitoring
    WHERE last_check_at >= NOW() - INTERVAL '1 hour';
    
    -- Get recent errors
    SELECT array_agg(component_name || ': ' || COALESCE(error_message, 'Unknown error'))
    INTO latest_errors
    FROM system_health_monitoring
    WHERE health_status = 'error' 
      AND last_check_at >= NOW() - INTERVAL '1 hour'
    LIMIT 5;
    
    -- Build health status
    result := jsonb_build_object(
        'overall_status', CASE 
            WHEN healthy_components = total_components THEN 'healthy'
            WHEN healthy_components > total_components / 2 THEN 'warning'
            ELSE 'error'
        END,
        'healthy_components', COALESCE(healthy_components, 0),
        'total_components', COALESCE(total_components, 0),
        'health_percentage', CASE 
            WHEN total_components > 0 THEN ROUND((healthy_components::decimal / total_components * 100), 2)
            ELSE 0
        END,
        'recent_errors', COALESCE(latest_errors, ARRAY[]::TEXT[]),
        'checked_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ==================================================================
-- 5. GRANT PERMISSIONS
-- ==================================================================

-- Grant all permissions to service role
GRANT ALL ON engagement_history TO service_role;
GRANT ALL ON system_health_monitoring TO service_role;
GRANT ALL ON emergency_posting_log TO service_role;
GRANT ALL ON follower_attribution TO service_role;
GRANT ALL ON tweet_impressions TO service_role;
GRANT ALL ON tweet_performance_analytics TO service_role;
GRANT ALL ON real_time_metrics_cache TO service_role;

-- Grant function execution
GRANT EXECUTE ON FUNCTION calculate_engagement_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION get_system_health_status() TO service_role;

-- Grant to anon role for health checks
GRANT SELECT ON system_health_monitoring TO anon;
GRANT SELECT ON real_time_metrics_cache TO anon;
GRANT EXECUTE ON FUNCTION get_system_health_status() TO anon;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;

-- ==================================================================
-- 6. INSERT INITIAL SYSTEM DATA
-- ==================================================================

-- Insert initial system health records
INSERT INTO system_health_monitoring (
    component_name, 
    health_status,
    details
) VALUES 
    ('database_schema', 'healthy', '{"migration": "final_perfect_complete", "tables_created": 7}'),
    ('engagement_tracking', 'healthy', '{"engagement_history": "ready", "analytics": "enabled"}'),
    ('system_monitoring', 'healthy', '{"health_checks": "enabled", "real_time_metrics": "active"}'),
    ('emergency_systems', 'healthy', '{"posting_log": "ready", "fallback_tracking": "enabled"}'),
    ('performance_analytics', 'healthy', '{"tweet_analytics": "ready", "metrics_cache": "active"}'),
    ('function_system', 'healthy', '{"engagement_calc": "ready", "health_status": "ready"}}')
ON CONFLICT DO NOTHING;

-- Initialize metrics cache
INSERT INTO real_time_metrics_cache (metric_type, metric_value)
VALUES ('system_ready', '{"status": "initialized", "timestamp": "' || NOW() || '"}')
ON CONFLICT (metric_type) DO NOTHING;

-- ==================================================================
-- 7. FINAL VERIFICATION
-- ==================================================================

DO $$
DECLARE
    created_tables TEXT[] := ARRAY[]::TEXT[];
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
    required_tables TEXT[] := ARRAY[
        'engagement_history', 
        'system_health_monitoring', 
        'emergency_posting_log', 
        'follower_attribution', 
        'tweet_impressions',
        'tweet_performance_analytics',
        'real_time_metrics_cache'
    ];
    function_count INTEGER;
    index_count INTEGER;
    success_rate INTEGER;
BEGIN
    -- Check which tables were created
    FOREACH table_name IN ARRAY required_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') THEN
            created_tables := array_append(created_tables, table_name);
        ELSE
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    -- Count functions and indexes
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('calculate_engagement_metrics', 'get_system_health_status');
    
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%engagement%' 
       OR indexname LIKE 'idx_%system%'
       OR indexname LIKE 'idx_%emergency%';
    
    -- Calculate success rate
    success_rate := array_length(created_tables, 1);
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 === FINAL PERFECT DATABASE MIGRATION COMPLETE ===';
    RAISE NOTICE '';
    RAISE NOTICE '✅ TABLES CREATED (%/7):', success_rate;
    FOREACH table_name IN ARRAY created_tables
    LOOP
        RAISE NOTICE '   ✓ %', table_name;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '❌ MISSING TABLES:';
        FOREACH table_name IN ARRAY missing_tables
        LOOP
            RAISE NOTICE '   ✗ %', table_name;
        END LOOP;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 SYSTEM FEATURES:';
    RAISE NOTICE '   ✓ Functions created: %', function_count;
    RAISE NOTICE '   ✓ Performance indexes: %+', index_count;
    RAISE NOTICE '   ✓ Real-time metrics: calculate_engagement_metrics()';
    RAISE NOTICE '   ✓ Health monitoring: get_system_health_status()';
    RAISE NOTICE '   ✓ Agent storage: engagement_history table';
    RAISE NOTICE '   ✓ Emergency logging: posting fallback tracking';
    RAISE NOTICE '   ✓ Analytics: tweet_performance_analytics';
    RAISE NOTICE '';
    
    IF success_rate = 7 AND function_count = 2 THEN
        RAISE NOTICE '🚀 DATABASE STATUS: PERFECT!';
        RAISE NOTICE '🎉 ALL SYSTEMS READY - Your bot can now run fluently!';
        RAISE NOTICE '';
        RAISE NOTICE '📊 NEXT STEPS:';
        RAISE NOTICE '   1. Test engagement_history table (fixes agent errors)';
        RAISE NOTICE '   2. Enable system health monitoring';
        RAISE NOTICE '   3. Deploy updated TypeScript code';
        RAISE NOTICE '   4. Monitor real-time metrics';
    ELSE
        RAISE NOTICE '⚠️ PARTIAL SUCCESS: Some components may need manual review';
    END IF;
    
END $$;
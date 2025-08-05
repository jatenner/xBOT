-- 🚀 COMPREHENSIVE SYSTEM AUDIT FIXES
-- Implements all critical fixes identified in system audit
-- Date: 2025-08-05

-- ==================================================================
-- 1. CREATE ENGAGEMENT_HISTORY TABLE (missing and breaking agent storage)
-- ==================================================================

CREATE TABLE IF NOT EXISTS engagement_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'like', 'reply', 'retweet', 'follow', 'view'
    action_metadata JSONB DEFAULT '{}', -- Store flexible metadata
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_name VARCHAR(100) DEFAULT 'unknown',
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_engagement_history_tweet_id ON engagement_history(tweet_id);
CREATE INDEX idx_engagement_history_action_type ON engagement_history(action_type);
CREATE INDEX idx_engagement_history_performed_at ON engagement_history(performed_at);
CREATE INDEX idx_engagement_history_agent_name ON engagement_history(agent_name);

-- ==================================================================
-- 2. ADD SYSTEM HEALTH MONITORING TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS system_health_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_name VARCHAR(100) NOT NULL,
    health_status VARCHAR(20) NOT NULL, -- 'healthy', 'warning', 'error', 'unknown'
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0,
    memory_usage_mb INTEGER DEFAULT 0,
    memory_limit_mb INTEGER DEFAULT 512,
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_health_component ON system_health_monitoring(component_name);
CREATE INDEX idx_system_health_status ON system_health_monitoring(health_status);
CREATE INDEX idx_system_health_last_check ON system_health_monitoring(last_check_at);

-- ==================================================================
-- 3. CREATE EMERGENCY_POSTING_LOG TABLE (track fallback modes)
-- ==================================================================

CREATE TABLE IF NOT EXISTS emergency_posting_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255),
    content TEXT NOT NULL,
    posting_method VARCHAR(50) NOT NULL, -- 'browser_primary', 'browser_fallback', 'emergency_text_only', 'simple_retry'
    success BOOLEAN NOT NULL,
    confirmed BOOLEAN DEFAULT false, -- Whether tweet was confirmed posted
    error_message TEXT,
    resource_usage JSONB DEFAULT '{}', -- Memory, CPU at time of posting
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emergency_posting_method ON emergency_posting_log(posting_method);
CREATE INDEX idx_emergency_posting_success ON emergency_posting_log(success);
CREATE INDEX idx_emergency_posting_confirmed ON emergency_posting_log(confirmed);
CREATE INDEX idx_emergency_posting_posted_at ON emergency_posting_log(posted_at);

-- ==================================================================
-- 4. CREATE ANALYTICS CALCULATION VIEWS (for real-time metrics)
-- ==================================================================

-- Real-time engagement rate calculation
CREATE OR REPLACE VIEW current_engagement_metrics AS
SELECT 
    -- Daily metrics (last 24 hours)
    COUNT(*) as tweets_24h,
    COALESCE(AVG(ta.likes), 0) as avg_likes_24h,
    COALESCE(AVG(ta.retweets), 0) as avg_retweets_24h,
    COALESCE(AVG(ta.replies), 0) as avg_replies_24h,
    COALESCE(AVG(ta.impressions), 0) as avg_impressions_24h,
    
    -- Engagement rate calculation
    CASE 
        WHEN AVG(ta.impressions) > 0 
        THEN ROUND(((AVG(ta.likes) + AVG(ta.retweets) + AVG(ta.replies)) / AVG(ta.impressions) * 100)::numeric, 4)
        ELSE 0 
    END as engagement_rate_24h,
    
    -- Viral content detection (tweets with >2x average likes)
    COUNT(*) FILTER (WHERE ta.likes > (
        SELECT AVG(likes) * 2 FROM tweet_analytics 
        WHERE collected_at >= NOW() - INTERVAL '7 days'
    )) as viral_tweets_24h
    
FROM tweets t
JOIN tweet_analytics ta ON t.tweet_id = ta.tweet_id
WHERE t.posted_at >= NOW() - INTERVAL '24 hours'
  AND ta.snapshot_interval = 'latest';

-- Follower growth calculation
CREATE OR REPLACE VIEW current_follower_metrics AS
SELECT 
    -- Get latest follower count
    (SELECT follower_count FROM follower_tracking 
     ORDER BY tracked_at DESC LIMIT 1) as current_followers,
    
    -- Calculate 24h growth
    COALESCE((
        SELECT follower_count FROM follower_tracking 
        ORDER BY tracked_at DESC LIMIT 1
    ) - (
        SELECT follower_count FROM follower_tracking 
        WHERE tracked_at <= NOW() - INTERVAL '24 hours'
        ORDER BY tracked_at DESC LIMIT 1
    ), 0) as followers_gained_24h,
    
    -- Calculate growth rate
    CASE 
        WHEN (SELECT follower_count FROM follower_tracking 
              WHERE tracked_at <= NOW() - INTERVAL '24 hours'
              ORDER BY tracked_at DESC LIMIT 1) > 0
        THEN ROUND((
            (SELECT follower_count FROM follower_tracking ORDER BY tracked_at DESC LIMIT 1) -
            (SELECT follower_count FROM follower_tracking 
             WHERE tracked_at <= NOW() - INTERVAL '24 hours'
             ORDER BY tracked_at DESC LIMIT 1)
        )::numeric / (
            SELECT follower_count FROM follower_tracking 
            WHERE tracked_at <= NOW() - INTERVAL '24 hours'
            ORDER BY tracked_at DESC LIMIT 1
        ) * 100, 4)
        ELSE 0
    END as follower_growth_rate_24h;

-- ==================================================================
-- 5. CREATE REAL-TIME METRICS FUNCTION (for runtimeConfigManager)
-- ==================================================================

CREATE OR REPLACE FUNCTION get_real_time_metrics()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'engagement_rate', COALESCE(engagement_rate_24h, 0),
        'avg_likes', COALESCE(avg_likes_24h, 0),
        'avg_impressions', COALESCE(avg_impressions_24h, 0),
        'tweets_count', COALESCE(tweets_24h, 0),
        'viral_tweets', COALESCE(viral_tweets_24h, 0),
        'follower_growth_24h', (
            SELECT COALESCE(followers_gained_24h, 0) 
            FROM current_follower_metrics
        ),
        'current_followers', (
            SELECT COALESCE(current_followers, 0) 
            FROM current_follower_metrics
        ),
        'follower_growth_rate', (
            SELECT COALESCE(follower_growth_rate_24h, 0) 
            FROM current_follower_metrics
        ),
        'last_updated', NOW()
    ) INTO result
    FROM current_engagement_metrics;
    
    -- Fallback if no data
    IF result IS NULL THEN
        result := jsonb_build_object(
            'engagement_rate', 0,
            'avg_likes', 0,
            'avg_impressions', 0,
            'tweets_count', 0,
            'viral_tweets', 0,
            'follower_growth_24h', 0,
            'current_followers', 0,
            'follower_growth_rate', 0,
            'last_updated', NOW()
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ==================================================================
-- 6. UPDATE EXISTING TABLES WITH MISSING COLUMNS
-- ==================================================================

-- Add confirmed column to tweets table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='tweets' AND column_name='confirmed'
    ) THEN
        ALTER TABLE tweets ADD COLUMN confirmed BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added confirmed column to tweets table';
    END IF;
END $$;

-- Add method_used column to tweets table if missing  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='tweets' AND column_name='method_used'
    ) THEN
        ALTER TABLE tweets ADD COLUMN method_used VARCHAR(50) DEFAULT 'browser';
        RAISE NOTICE 'Added method_used column to tweets table';
    END IF;
END $$;

-- Add resource_usage column to tweets table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='tweets' AND column_name='resource_usage'
    ) THEN
        ALTER TABLE tweets ADD COLUMN resource_usage JSONB DEFAULT '{}';
        RAISE NOTICE 'Added resource_usage column to tweets table';
    END IF;
END $$;

-- ==================================================================
-- 7. GRANT PERMISSIONS
-- ==================================================================

-- Grant access to all new tables and views
GRANT ALL ON engagement_history TO service_role;
GRANT ALL ON system_health_monitoring TO service_role;
GRANT ALL ON emergency_posting_log TO service_role;
GRANT SELECT ON current_engagement_metrics TO service_role;
GRANT SELECT ON current_follower_metrics TO service_role;
GRANT EXECUTE ON FUNCTION get_real_time_metrics() TO service_role;

-- Grant to anon role for health checks
GRANT SELECT ON system_health_monitoring TO anon;
GRANT SELECT ON current_engagement_metrics TO anon;
GRANT EXECUTE ON FUNCTION get_real_time_metrics() TO anon;

-- ==================================================================
-- 8. INSERT INITIAL SYSTEM HEALTH DATA
-- ==================================================================

INSERT INTO system_health_monitoring (
    component_name, 
    health_status,
    details
) VALUES 
    ('browser_poster', 'unknown', '{"last_check": null, "note": "Needs initial health check"}'),
    ('supabase_connection', 'healthy', '{"connection": "active", "permissions": "granted"}'),
    ('content_generator', 'unknown', '{"last_generation": null}'),
    ('engagement_collector', 'unknown', '{"last_collection": null}'),
    ('thread_parser', 'unknown', '{"last_parse": null}'),
    ('posting_engine', 'unknown', '{"last_post": null}')
ON CONFLICT DO NOTHING;

-- ==================================================================
-- 9. VERIFICATION AND SUCCESS MESSAGE
-- ==================================================================

-- Verify all tables exist
DO $$
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
BEGIN
    -- Check for required tables
    FOR table_name IN VALUES ('engagement_history'), ('system_health_monitoring'), ('emergency_posting_log'), ('tweet_analytics'), ('tweets'), ('follower_tracking')
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(missing_tables, ', ');
    END IF;
    
    -- Test the real-time metrics function
    PERFORM get_real_time_metrics();
    
    RAISE NOTICE '✅ COMPREHENSIVE SYSTEM FIXES APPLIED SUCCESSFULLY:';
    RAISE NOTICE '';
    RAISE NOTICE '📊 DATABASE FIXES:';
    RAISE NOTICE '   ✓ engagement_history table created (fixes agent storage)';
    RAISE NOTICE '   ✓ system_health_monitoring table created';
    RAISE NOTICE '   ✓ emergency_posting_log table created';
    RAISE NOTICE '   ✓ Real-time analytics views created';
    RAISE NOTICE '   ✓ get_real_time_metrics() function created';
    RAISE NOTICE '   ✓ Missing columns added to existing tables';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 SYSTEM CAPABILITIES ENABLED:';
    RAISE NOTICE '   ✓ Real-time engagement_rate calculation';
    RAISE NOTICE '   ✓ Real-time follower_growth_24h tracking';
    RAISE NOTICE '   ✓ Emergency posting mode tracking';
    RAISE NOTICE '   ✓ System health monitoring';
    RAISE NOTICE '   ✓ Agent engagement action logging';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 NEXT: Update TypeScript code to use these new capabilities!';
    
END $$;
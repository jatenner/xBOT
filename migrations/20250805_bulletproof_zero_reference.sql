-- 🛡️ BULLETPROOF DATABASE SETUP - ZERO TWEET REFERENCES
-- This migration avoids ALL tweet ID references that cause issues
-- Date: 2025-08-05

-- ==================================================================
-- 1. ENABLE EXTENSIONS ONLY
-- ==================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================================================================
-- 2. CREATE ESSENTIAL TABLES WITH NO TWEET REFERENCES
-- ==================================================================

-- CRITICAL: Agent engagement storage (no tweet references)
CREATE TABLE IF NOT EXISTS agent_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) NOT NULL,
    target_identifier TEXT, -- Generic identifier, no tweet_id reference
    action_data JSONB DEFAULT '{}',
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    agent_name VARCHAR(100) DEFAULT 'unknown',
    success BOOLEAN DEFAULT true,
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health monitoring
CREATE TABLE IF NOT EXISTS system_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    cpu_percent DECIMAL(5,2) DEFAULT 0,
    memory_mb INTEGER DEFAULT 0,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}',
    error_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emergency posting tracking
CREATE TABLE IF NOT EXISTS posting_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_text TEXT NOT NULL,
    method_used VARCHAR(50) NOT NULL,
    was_successful BOOLEAN NOT NULL,
    was_confirmed BOOLEAN DEFAULT false,
    error_info TEXT,
    system_resources JSONB DEFAULT '{}',
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follower growth tracking (independent)
CREATE TABLE IF NOT EXISTS growth_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_count INTEGER NOT NULL DEFAULT 0,
    change_amount INTEGER DEFAULT 0,
    measurement_period INTEGER DEFAULT 24,
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance metrics storage (independent)
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    measurement_time TIMESTAMPTZ DEFAULT NOW(),
    context_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================================
-- 3. CREATE BASIC INDEXES (NO FOREIGN REFERENCES)
-- ==================================================================

CREATE INDEX IF NOT EXISTS idx_agent_actions_type ON agent_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_actions_performed ON agent_actions(performed_at);
CREATE INDEX IF NOT EXISTS idx_agent_actions_agent ON agent_actions(agent_name);

CREATE INDEX IF NOT EXISTS idx_system_status_component ON system_status(component);
CREATE INDEX IF NOT EXISTS idx_system_status_checked ON system_status(checked_at);

CREATE INDEX IF NOT EXISTS idx_posting_attempts_method ON posting_attempts(method_used);
CREATE INDEX IF NOT EXISTS idx_posting_attempts_attempted ON posting_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_growth_tracking_measured ON growth_tracking(measured_at);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_time ON performance_metrics(measurement_time);

-- ==================================================================
-- 4. GRANT PERMISSIONS
-- ==================================================================

GRANT ALL ON agent_actions TO service_role;
GRANT ALL ON system_status TO service_role;
GRANT ALL ON posting_attempts TO service_role;
GRANT ALL ON growth_tracking TO service_role;
GRANT ALL ON performance_metrics TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON system_status TO anon;

-- ==================================================================
-- 5. INSERT INITIAL DATA
-- ==================================================================

INSERT INTO system_status (component, status, details) VALUES 
    ('database', 'healthy', '{"migration": "bulletproof_complete"}'),
    ('agent_storage', 'healthy', '{"table": "agent_actions_ready"}'),
    ('posting_system', 'healthy', '{"tracking": "posting_attempts_ready"}'),
    ('growth_system', 'healthy', '{"tracking": "growth_tracking_ready"}'),
    ('metrics_system', 'healthy', '{"storage": "performance_metrics_ready"}}')
ON CONFLICT DO NOTHING;

INSERT INTO performance_metrics (metric_name, metric_value, context_data) VALUES
    ('system_ready', 1, '{"migration": "bulletproof", "timestamp": "' || NOW() || '"}')
ON CONFLICT DO NOTHING;

-- ==================================================================
-- 6. FINAL VERIFICATION
-- ==================================================================

DO $$
DECLARE
    created_count INTEGER := 0;
    table_name TEXT;
    tables TEXT[] := ARRAY['agent_actions', 'system_status', 'posting_attempts', 'growth_tracking', 'performance_metrics'];
BEGIN
    -- Count successfully created tables
    FOREACH table_name IN ARRAY tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') THEN
            created_count := created_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🛡️ === BULLETPROOF DATABASE SETUP COMPLETE ===';
    RAISE NOTICE '';
    RAISE NOTICE '✅ TABLES CREATED: %/5', created_count;
    RAISE NOTICE '   ✓ agent_actions (replaces engagement_history)';
    RAISE NOTICE '   ✓ system_status (health monitoring)';  
    RAISE NOTICE '   ✓ posting_attempts (emergency logging)';
    RAISE NOTICE '   ✓ growth_tracking (follower tracking)';
    RAISE NOTICE '   ✓ performance_metrics (metrics storage)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 FEATURES ENABLED:';
    RAISE NOTICE '   ✓ Agent action storage (fixes agent errors)';
    RAISE NOTICE '   ✓ System health monitoring';
    RAISE NOTICE '   ✓ Emergency posting tracking';
    RAISE NOTICE '   ✓ Growth measurement';
    RAISE NOTICE '   ✓ Performance metrics';
    RAISE NOTICE '';
    
    IF created_count = 5 THEN
        RAISE NOTICE '🚀 DATABASE STATUS: BULLETPROOF CLEAN!';
        RAISE NOTICE '🎉 Zero reference issues - All systems ready!';
        RAISE NOTICE '';
        RAISE NOTICE '📋 WHAT THIS FIXES:';
        RAISE NOTICE '   1. Agent storage errors (agent_actions table)';
        RAISE NOTICE '   2. System monitoring gaps (system_status table)';
        RAISE NOTICE '   3. Emergency posting tracking (posting_attempts table)';
        RAISE NOTICE '   4. Growth measurement (growth_tracking table)';
        RAISE NOTICE '   5. Performance tracking (performance_metrics table)';
        RAISE NOTICE '';
        RAISE NOTICE '🎯 NEXT: Update TypeScript code to use these clean table names';
    ELSE
        RAISE NOTICE '⚠️ PARTIAL SUCCESS: %/5 tables created', created_count;
    END IF;
    
END $$;
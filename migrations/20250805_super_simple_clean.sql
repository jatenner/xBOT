-- 🧹 SUPER SIMPLE CLEAN DATABASE SETUP
-- No complex JSON, no references, just basic essential tables
-- Date: 2025-08-05

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agent actions table (most critical for fixing agent errors)
CREATE TABLE IF NOT EXISTS agent_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) NOT NULL,
    target_id TEXT,
    agent_name VARCHAR(100) DEFAULT 'unknown',
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system status table
CREATE TABLE IF NOT EXISTS system_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    error_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create posting attempts table
CREATE TABLE IF NOT EXISTS posting_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_text TEXT NOT NULL,
    method_used VARCHAR(50) NOT NULL,
    was_successful BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    error_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create growth tracking table
CREATE TABLE IF NOT EXISTS growth_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_count INTEGER NOT NULL DEFAULT 0,
    change_amount INTEGER DEFAULT 0,
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    measurement_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_agent_actions_type ON agent_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_actions_performed ON agent_actions(performed_at);
CREATE INDEX IF NOT EXISTS idx_system_status_component ON system_status(component);
CREATE INDEX IF NOT EXISTS idx_posting_attempts_method ON posting_attempts(method_used);
CREATE INDEX IF NOT EXISTS idx_growth_tracking_measured ON growth_tracking(measured_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);

-- Grant permissions
GRANT ALL ON agent_actions TO service_role;
GRANT ALL ON system_status TO service_role;
GRANT ALL ON posting_attempts TO service_role;
GRANT ALL ON growth_tracking TO service_role;
GRANT ALL ON performance_metrics TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

-- Insert simple initial data (no complex JSON)
INSERT INTO system_status (component, status) VALUES 
    ('database', 'healthy'),
    ('agent_storage', 'healthy'),
    ('posting_system', 'healthy')
ON CONFLICT DO NOTHING;

INSERT INTO performance_metrics (metric_name, metric_value) VALUES
    ('system_ready', 1)
ON CONFLICT DO NOTHING;

-- Simple verification
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('agent_actions', 'system_status', 'posting_attempts', 'growth_tracking', 'performance_metrics');
    
    RAISE NOTICE 'SUCCESS: Created %/5 essential tables', table_count;
    
    IF table_count = 5 THEN
        RAISE NOTICE 'ALL TABLES READY - Agent errors should be fixed!';
    END IF;
END $$;
-- ULTRA MINIMAL - Just the one critical table to fix agent errors
-- No JSON, no complex features, just the bare minimum

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS agent_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) NOT NULL,
    target_id TEXT,
    agent_name VARCHAR(100),
    success BOOLEAN DEFAULT true,
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON agent_actions TO service_role;
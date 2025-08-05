-- Additional essential tables
CREATE TABLE IF NOT EXISTS system_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    error_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posting_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_text TEXT NOT NULL,
    method_used VARCHAR(50) NOT NULL,
    was_successful BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    error_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON system_status TO service_role;
GRANT ALL ON posting_attempts TO service_role;

-- Insert initial health status
INSERT INTO system_status (component, status) VALUES 
    ('database', 'healthy'),
    ('agent_storage', 'healthy'),
    ('posting_system', 'healthy')
ON CONFLICT DO NOTHING;
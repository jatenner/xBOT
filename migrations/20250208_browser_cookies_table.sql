-- Browser Cookies Table for Twitter Session Persistence
-- Ensures the enhanced Twitter authentication system has required table

CREATE TABLE IF NOT EXISTS browser_cookies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    domain VARCHAR(255) NOT NULL,
    path VARCHAR(255) DEFAULT '/',
    expires_timestamp TIMESTAMP WITH TIME ZONE,
    http_only BOOLEAN DEFAULT FALSE,
    secure BOOLEAN DEFAULT TRUE,
    same_site VARCHAR(10) DEFAULT 'Lax',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient cookie retrieval
CREATE INDEX IF NOT EXISTS idx_browser_cookies_domain ON browser_cookies(domain);
CREATE INDEX IF NOT EXISTS idx_browser_cookies_name ON browser_cookies(name);

-- Enable RLS for security
ALTER TABLE browser_cookies ENABLE ROW LEVEL SECURITY;

-- Policy for service role access
CREATE POLICY "Service role can manage browser_cookies" ON browser_cookies FOR ALL USING (auth.role() = 'service_role');

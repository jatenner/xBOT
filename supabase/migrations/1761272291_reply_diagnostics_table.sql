-- Create table for reply posting diagnostics
CREATE TABLE IF NOT EXISTS reply_diagnostics (
  id BIGSERIAL PRIMARY KEY,
  failure_type TEXT NOT NULL,
  context TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  screenshot_path TEXT,
  dom_structure JSONB,
  page_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent failures
CREATE INDEX IF NOT EXISTS idx_reply_diagnostics_timestamp 
  ON reply_diagnostics(timestamp DESC);

-- Index for analyzing failure types
CREATE INDEX IF NOT EXISTS idx_reply_diagnostics_type 
  ON reply_diagnostics(failure_type);

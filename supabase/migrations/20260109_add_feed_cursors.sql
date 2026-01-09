-- Add feed cursor tracking for incremental fetching
-- Enables rotation through accounts/keywords to prevent timeout

BEGIN;

-- Create feed_cursors table
CREATE TABLE IF NOT EXISTS feed_cursors (
  feed_name TEXT PRIMARY KEY,
  cursor_value TEXT NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Insert initial cursors
INSERT INTO feed_cursors (feed_name, cursor_value, metadata)
VALUES 
  ('curated_accounts', '0', '{"accounts_per_run": 5}'::jsonb),
  ('keyword_search', '0', '{"keywords_per_run": 3}'::jsonb),
  ('viral_watcher', '0', '{"queries_per_run": 1}'::jsonb)
ON CONFLICT (feed_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_feed_cursors_feed_name ON feed_cursors(feed_name);

COMMENT ON TABLE feed_cursors IS 'Tracks cursor position for incremental feed fetching to prevent timeouts';
COMMENT ON COLUMN feed_cursors.cursor_value IS 'Current cursor position (account index, keyword index, etc.)';
COMMENT ON COLUMN feed_cursors.metadata IS 'Feed-specific metadata (accounts_per_run, keywords_per_run, etc.)';

COMMIT;


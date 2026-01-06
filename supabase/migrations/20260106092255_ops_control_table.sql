-- Create ops_control table for controlled window gates
CREATE TABLE IF NOT EXISTS ops_control (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ops_control_key ON ops_control(key);

-- Function to atomically consume a token
CREATE OR REPLACE FUNCTION consume_controlled_token(token_value TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  consumed BOOLEAN;
BEGIN
  UPDATE ops_control
  SET value = 'consumed_' || token_value || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
      updated_at = NOW()
  WHERE key = 'controlled_post_token'
    AND value = token_value
  RETURNING TRUE INTO consumed;
  
  RETURN COALESCE(consumed, FALSE);
END;
$$ LANGUAGE plpgsql;

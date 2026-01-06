-- Add lease fields to ops_control table for controlled window gate
ALTER TABLE ops_control 
ADD COLUMN IF NOT EXISTS lease_owner TEXT,
ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- Index for faster lease expiration queries
CREATE INDEX IF NOT EXISTS idx_ops_control_lease_expires ON ops_control(lease_expires_at) 
WHERE lease_expires_at IS NOT NULL;

-- Function to atomically acquire a controlled token lease
CREATE OR REPLACE FUNCTION acquire_controlled_token(
  token_value TEXT,
  owner_id TEXT,
  ttl_seconds INTEGER DEFAULT 600
)
RETURNS BOOLEAN AS $$
DECLARE
  acquired BOOLEAN;
BEGIN
  UPDATE ops_control
  SET 
    lease_owner = owner_id,
    lease_expires_at = NOW() + (ttl_seconds || ' seconds')::INTERVAL,
    updated_at = NOW()
  WHERE key = 'controlled_post_token'
    AND value = token_value
    AND (
      lease_expires_at IS NULL 
      OR lease_expires_at < NOW()
    )
  RETURNING TRUE INTO acquired;
  
  RETURN COALESCE(acquired, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to finalize (consume) a controlled token after successful post
CREATE OR REPLACE FUNCTION finalize_controlled_token(
  token_value TEXT,
  owner_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  finalized BOOLEAN;
BEGIN
  UPDATE ops_control
  SET 
    value = 'consumed_' || token_value || '_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = NOW()
  WHERE key = 'controlled_post_token'
    AND value = token_value
    AND lease_owner = owner_id
  RETURNING TRUE INTO finalized;
  
  RETURN COALESCE(finalized, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to release a controlled token lease (on failure/retry)
CREATE OR REPLACE FUNCTION release_controlled_token(
  token_value TEXT,
  owner_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  released BOOLEAN;
BEGIN
  UPDATE ops_control
  SET 
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = NOW()
  WHERE key = 'controlled_post_token'
    AND value = token_value
    AND lease_owner = owner_id
  RETURNING TRUE INTO released;
  
  RETURN COALESCE(released, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Keep old consume_controlled_token for backward compatibility (deprecated)
-- It will be removed in a future migration


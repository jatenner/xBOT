-- Advisory Lock Functions for Distributed Reply Rate Limiting
-- These functions wrap Postgres advisory locks for use via Supabase RPC

CREATE OR REPLACE FUNCTION pg_try_advisory_lock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_lock(lock_id);
$$;

CREATE OR REPLACE FUNCTION pg_advisory_unlock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_advisory_unlock(lock_id);
$$;

COMMENT ON FUNCTION pg_try_advisory_lock IS 'Try to acquire advisory lock (non-blocking)';
COMMENT ON FUNCTION pg_advisory_unlock IS 'Release advisory lock';


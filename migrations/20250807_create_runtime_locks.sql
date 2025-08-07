-- Runtime lock table to prevent concurrent posting
CREATE TABLE IF NOT EXISTS runtime_locks (
  lock_id TEXT PRIMARY KEY,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_locks_locked_until
  ON runtime_locks (locked_until);


-- ============================================================
-- REPLY TRUTH INFRASTRUCTURE MIGRATION
-- 
-- Creates required database objects for bulletproof reply posting:
-- 1. Advisory lock wrapper functions (for distributed rate limiting)
-- 2. post_receipts table (for immutable proof-of-posting)
-- 
-- IDEMPOTENT: Safe to run multiple times
-- ============================================================

-- ============================================================
-- PART 1: Advisory Lock Wrapper Functions
-- (Required for distributed reply rate limiting)
-- ============================================================

-- Wrapper for pg_try_advisory_lock (non-blocking lock acquisition)
CREATE OR REPLACE FUNCTION pg_try_advisory_lock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_lock(lock_id);
$$;

COMMENT ON FUNCTION pg_try_advisory_lock IS 'Try to acquire advisory lock (non-blocking). Returns true if acquired, false if already held.';

-- Wrapper for pg_advisory_unlock (lock release)
CREATE OR REPLACE FUNCTION pg_advisory_unlock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_advisory_unlock(lock_id);
$$;

COMMENT ON FUNCTION pg_advisory_unlock IS 'Release advisory lock. Returns true if released, false if not held.';

-- ============================================================
-- PART 2: Post Receipts Table
-- (Immutable proof-of-posting for all content types)
-- ============================================================

CREATE TABLE IF NOT EXISTS post_receipts (
  -- Primary key
  receipt_id BIGSERIAL PRIMARY KEY,
  
  -- Decision linkage (nullable for orphan receipts)
  decision_id UUID,
  
  -- Tweet IDs (JSONB array for flexibility)
  tweet_ids JSONB NOT NULL,
  root_tweet_id TEXT NOT NULL,
  
  -- Post classification
  post_type TEXT NOT NULL CHECK (post_type IN ('single', 'thread', 'reply')),
  
  -- Timestamps
  posted_at TIMESTAMPTZ NOT NULL,
  receipt_created_at TIMESTAMPTZ DEFAULT NOW(),
  reconciled_at TIMESTAMPTZ,
  
  -- Reply-specific: parent tweet ID (for replies)
  parent_tweet_id TEXT,
  
  -- Additional metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT tweet_ids_not_empty CHECK (jsonb_array_length(tweet_ids) > 0),
  CONSTRAINT root_tweet_id_not_empty CHECK (root_tweet_id != '')
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_post_receipts_decision_id ON post_receipts(decision_id);
CREATE INDEX IF NOT EXISTS idx_post_receipts_post_type ON post_receipts(post_type);
CREATE INDEX IF NOT EXISTS idx_post_receipts_posted_at ON post_receipts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_receipts_root_tweet_id ON post_receipts(root_tweet_id);
CREATE INDEX IF NOT EXISTS idx_post_receipts_parent_tweet_id ON post_receipts(parent_tweet_id) WHERE parent_tweet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_receipts_reconciled ON post_receipts(reconciled_at) WHERE reconciled_at IS NULL;

-- Add comments for documentation
COMMENT ON TABLE post_receipts IS 'Immutable receipts for all posted tweets. Written immediately after successful post to X.';
COMMENT ON COLUMN post_receipts.decision_id IS 'Links to content_metadata. NULL for orphan receipts (salvaged tweets).';
COMMENT ON COLUMN post_receipts.tweet_ids IS 'JSONB array of all tweet IDs. Single element for singles/replies, multiple for threads.';
COMMENT ON COLUMN post_receipts.root_tweet_id IS 'Primary tweet ID. For threads: first tweet. For replies: the reply itself.';
COMMENT ON COLUMN post_receipts.post_type IS 'Classification: single, thread, or reply.';
COMMENT ON COLUMN post_receipts.parent_tweet_id IS 'For replies: the tweet being replied to. NULL for singles/threads.';
COMMENT ON COLUMN post_receipts.posted_at IS 'When the tweet was posted to X (from API/Playwright).';
COMMENT ON COLUMN post_receipts.receipt_created_at IS 'When this receipt was written to the database.';
COMMENT ON COLUMN post_receipts.reconciled_at IS 'When this receipt was matched to content_metadata. NULL if not yet reconciled.';
COMMENT ON COLUMN post_receipts.metadata IS 'Additional context: target_username, content_preview, topic_label, etc.';

-- ============================================================
-- PART 3: Migration Complete
-- ============================================================

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE '✅ Reply truth infrastructure migration complete';
  RAISE NOTICE '   - Advisory lock functions: pg_try_advisory_lock, pg_advisory_unlock';
  RAISE NOTICE '   - Table: post_receipts (with 6 indexes)';
END $$;


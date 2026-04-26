-- =============================================================================
-- Brain Algorithm Signals v2 — capture the signals the X ranker actually weights
-- =============================================================================
-- Adds:
--   * brain_tweets.author_followers_at_post_time  — causal snapshot at first scrape
--   * brain_tweets.parent_engagement_at_post_time — JSONB of parent's metrics for replies
--   * brain_tweets.velocity_5m / velocity_15m / velocity_60m — likes/min in algo's
--     critical first-distribution window
--   * external_patterns.source — discriminator for vi vs brain aggregator outputs
--   * external_reply_patterns.parent_author_replied_to_this_reply — the 75x signal
--     (the highest weight in the public Heavy Ranker config)
--   * external_reply_patterns.reply_author_is_verified — monetization-relevant
--     proxy for verified-engager ratio
--   * pending_velocity_snapshots — crash-safe queue for velocity collection
-- =============================================================================

-- Causal denormalization on brain_tweets ------------------------------------
DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS author_followers_at_post_time INT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS parent_engagement_at_post_time JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Velocity window snapshots on brain_tweets ---------------------------------
DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS velocity_5m REAL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS velocity_15m REAL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS velocity_60m REAL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Source discriminator on external_patterns ---------------------------------
DO $$ BEGIN
  ALTER TABLE external_patterns ADD COLUMN IF NOT EXISTS source TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Existing rows are vi-sourced (the only aggregator that wrote them).
UPDATE external_patterns SET source = 'vi' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_external_patterns_source
  ON external_patterns (source, combined_score DESC);

-- Reply-author engagement signal (the 75x signal) ---------------------------
DO $$ BEGIN
  ALTER TABLE external_reply_patterns
    ADD COLUMN IF NOT EXISTS parent_author_replied_to_this_reply BOOLEAN;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE external_reply_patterns
    ADD COLUMN IF NOT EXISTS reply_author_is_verified BOOLEAN;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE external_reply_patterns
    ADD COLUMN IF NOT EXISTS engagement_check_attempted_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_external_reply_patterns_engagement_pending
  ON external_reply_patterns (parent_posted_at DESC)
  WHERE parent_author_replied_to_this_reply IS NULL;

-- Velocity snapshot queue ---------------------------------------------------
-- Crash-safe: target_offset_min IS the bucket. A late-firing worker writes
-- to the intended bucket, not a new "actual elapsed" bucket. Reclaim-after-
-- 2min handles crashed workers without losing the snapshot intent.

CREATE TABLE IF NOT EXISTS pending_velocity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT NOT NULL,
  target_offset_min INT NOT NULL CHECK (target_offset_min IN (5, 15, 60)),
  due_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tweet_id, target_offset_min)
);

CREATE INDEX IF NOT EXISTS idx_pending_velocity_due
  ON pending_velocity_snapshots (due_at)
  WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_velocity_reclaim
  ON pending_velocity_snapshots (claimed_at);

COMMENT ON TABLE pending_velocity_snapshots IS
  'Crash-safe queue for velocity-window snapshots (+5m/+15m/+60m). '
  'Producer enqueues 3 rows per new tweet. Worker polls every 30s, '
  'claims with claimed_at, snapshots metrics, deletes on success. '
  'target_offset_min IS the bucket — late firings still land in the '
  'intended velocity_{N}m column.';

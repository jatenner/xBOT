-- =============================================================================
-- brain_backfill_queue — Historical deep-scrape queue for growth transitions
-- =============================================================================
--
-- Why: When an account crosses a follower threshold (e.g. 0→100, 500→1K),
-- our timeline scraper only captures their last ~100 tweets, which are AFTER
-- the growth happened. To reverse-engineer growth, we need their tweets from
-- DURING the growth window. This queue triggers a one-time deep backfill per
-- transition, deep-scrolling the profile until the oldest visible tweet is
-- older than the transition start date minus a buffer.
--
-- Queue pattern mirrors brain_account_snapshots' census_queued_at approach —
-- DB-backed so survives process restarts, worker pulls oldest pending row.

CREATE TABLE IF NOT EXISTS brain_backfill_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  username TEXT NOT NULL,
  from_stage TEXT NOT NULL,           -- "0", "100", "500", "1000", "5000"
  to_stage TEXT NOT NULL,             -- "100", "500", "1000", "5000", "10000"
  transition_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transition_started_at TIMESTAMPTZ,  -- When the account first crossed from_stage
  target_date_cutoff TIMESTAMPTZ,     -- Stop scrolling once tweets older than this
                                      -- Typically transition_started_at - 30 days

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done', 'failed')),

  tweets_captured INT NOT NULL DEFAULT 0,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One queue entry per (account, transition). If the same transition gets
  -- detected again (e.g. status flipped from in_progress to completed),
  -- we update the existing row rather than enqueuing twice.
  UNIQUE (username, from_stage, to_stage)
);

CREATE INDEX IF NOT EXISTS idx_backfill_queue_pending
  ON brain_backfill_queue(status, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_backfill_queue_username
  ON brain_backfill_queue(username);

CREATE INDEX IF NOT EXISTS idx_backfill_queue_retry
  ON brain_backfill_queue(status, last_attempt_at ASC)
  WHERE status = 'failed';

COMMENT ON TABLE brain_backfill_queue IS
  'Queue of historical deep-scrape jobs triggered by stage transitions. '
  'Worker pulls oldest pending row, deep-scrolls user profile past target_date_cutoff, '
  'upserts tweets to brain_tweets, marks row done.';

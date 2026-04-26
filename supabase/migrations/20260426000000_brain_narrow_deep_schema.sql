-- =============================================================================
-- Brain Narrow-Deep Schema
-- =============================================================================
-- Converts the brain from wide+shallow (32K accounts × 5 tweets each) to
-- narrow+deep (~2K accounts × 50+ tweets, with per-tweet engagement curves).
--
-- Three independent research streams (code audit, academic literature on
-- growth attribution, GitHub creator-analytics tools) converged on the same
-- requirements:
--   1. Pre-computed deltas at write-time (Gilbert CHI 2013 follow-predictor model)
--   2. Per-tweet engagement curves at log-spaced ages (Cheng et al. 2014 / Hawkes / TiDeH)
--   3. Engagement-source decomposition (BlackMagic.so's product moat)
--   4. Tier promotion/demotion auditing (Nansen Smart Money pattern)
--   5. Reply-edge table for the comment-guy growth hypothesis
-- =============================================================================

-- ── 1. Per-snapshot pre-computed deltas ────────────────────────────────────
-- Account-level deltas already exist on brain_accounts.growth_rate_*; this
-- adds them at the snapshot level so we can localize WHEN growth happened
-- (the autoregressive panel-data shape).

DO $$ BEGIN
  ALTER TABLE brain_account_snapshots ADD COLUMN IF NOT EXISTS followers_delta_24h INT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_account_snapshots ADD COLUMN IF NOT EXISTS followers_delta_7d INT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_account_snapshots ADD COLUMN IF NOT EXISTS follower_growth_accel REAL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_brain_account_snapshots_growth
  ON brain_account_snapshots (username, checked_at DESC);

-- ── 2. Per-tweet engagement curves ─────────────────────────────────────────
-- The unit of analysis every cascade-prediction paper uses (Cheng et al. 2014,
-- SEISMIC, TiDeH). We currently have brain_tweet_snapshots (terminal counts
-- at irregular 30-min rescrapes). This table records explicit log-spaced
-- captures so we can fit Hawkes-process growth curves and detect breakouts
-- from the first-15-minute velocity.

CREATE TABLE IF NOT EXISTS brain_tweet_engagement_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT NOT NULL,
  age_bucket TEXT NOT NULL CHECK (age_bucket IN ('5m','15m','1h','6h','24h','7d')),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  age_minutes_actual INT,           -- how late the worker fired vs target
  likes INT,
  retweets INT,
  replies INT,
  bookmarks INT,
  quotes INT,
  views BIGINT,
  -- Per-minute velocity vs the previous bucket (NULL for the +5m bucket).
  -- Cascade work shows velocity is a stronger predictor than terminal counts.
  likes_per_minute REAL,
  replies_per_minute REAL,
  UNIQUE (tweet_id, age_bucket)
);

CREATE INDEX IF NOT EXISTS idx_tweet_engagement_snapshots_tweet
  ON brain_tweet_engagement_snapshots (tweet_id, captured_at);

CREATE INDEX IF NOT EXISTS idx_tweet_engagement_snapshots_age
  ON brain_tweet_engagement_snapshots (age_bucket, captured_at DESC);

-- ── 3. Re-capture queue (mirrors pending_velocity_snapshots pattern) ───────
-- Producer enqueues 6 rows per S/A-tier external tweet at first ingest.
-- Worker polls every 60s, claims due rows, captures metrics, deletes on success.
-- Crash-safe via claim-and-reclaim (claimed_at older than 2min is reclaimable).

CREATE TABLE IF NOT EXISTS pending_engagement_recaptures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT NOT NULL,
  age_bucket TEXT NOT NULL CHECK (age_bucket IN ('5m','15m','1h','6h','24h','7d')),
  due_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  account_tier TEXT,                -- snapshot of tier at enqueue (for prioritization)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tweet_id, age_bucket)
);

CREATE INDEX IF NOT EXISTS idx_pending_engagement_due
  ON pending_engagement_recaptures (due_at)
  WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_engagement_reclaim
  ON pending_engagement_recaptures (claimed_at)
  WHERE claimed_at IS NOT NULL;

COMMENT ON TABLE pending_engagement_recaptures IS
  'Crash-safe queue for log-spaced tweet engagement re-captures (5m/15m/1h/6h/24h/7d). '
  'Worker polls every 60s. age_bucket IS the bucket — late firings still write to the '
  'intended bucket, mirroring pending_velocity_snapshots semantics.';

-- ── 4. Engagement-source decomposition on brain_tweets ─────────────────────
-- The signal BlackMagic.so commercializes: "did this engagement come from your
-- followers (audience content) or from strangers (viral content)?" These have
-- different growth implications — viral hits stranger reach but doesn't
-- always convert to follows. Source captured opportunistically when known.

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS engagement_from_followers_pct REAL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS engagement_from_strangers_pct REAL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_tweets ADD COLUMN IF NOT EXISTS is_unusual_for_author BOOLEAN;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── 5. Tier change history (audit trail for the promotion daemon) ──────────
-- Lets us validate the daemon's decisions retrospectively and see whether
-- tier-up correlates with subsequent growth (the meta-feedback loop).

CREATE TABLE IF NOT EXISTS brain_account_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  from_tier TEXT,
  to_tier TEXT NOT NULL,
  reason TEXT NOT NULL,             -- 'promotion_signal' | 'demotion_no_signal' | 'manual' | 'pruned'
  signal_score REAL,                -- composite score at change time
  followers_at_change INT,
  growth_rate_7d_at_change REAL
);

CREATE INDEX IF NOT EXISTS idx_tier_history_username
  ON brain_account_tier_history (username, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_tier_history_recent
  ON brain_account_tier_history (changed_at DESC);

-- ── 6. Reply-edge table for the comment-guy hypothesis ─────────────────────
-- external_reply_patterns records replies to OUR tracked accounts' tweets.
-- This is the inverse: replies BY our tracked accounts (their outbound reply
-- graph). Required for "does reply-guying drive growth?" attribution per
-- Storypath / Apex case study analyses, with all the per-edge covariates.

CREATE TABLE IF NOT EXISTS brain_reply_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_tweet_id TEXT NOT NULL,
  reply_author_username TEXT NOT NULL,
  reply_author_followers_at_time INT,
  target_tweet_id TEXT NOT NULL,
  target_author_username TEXT NOT NULL,
  target_author_followers_at_time INT,
  reply_latency_seconds INT,        -- how fast after parent posted
  reply_position_in_thread INT,
  op_replied_back BOOLEAN,          -- the 75x signal
  reply_engagement_24h INT,
  reply_likes_24h INT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reply_tweet_id)
);

CREATE INDEX IF NOT EXISTS idx_reply_edges_replier
  ON brain_reply_edges (reply_author_username, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reply_edges_target
  ON brain_reply_edges (target_author_username, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_reply_edges_op_engaged
  ON brain_reply_edges (op_replied_back) WHERE op_replied_back = true;

-- ── 7. Account deactivation reason (for the pruner) ────────────────────────
-- The pruner marks is_active=false; this records WHY so we can audit and
-- potentially reactivate if signal returns.

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_brain_accounts_active_tier
  ON brain_accounts (tier, scrape_priority DESC) WHERE is_active = true;

-- ── 8. Pool size view (the discovery circuit breaker reads this) ───────────

CREATE OR REPLACE VIEW brain_pool_stats AS
SELECT
  COUNT(*) FILTER (WHERE is_active = true) AS active_total,
  COUNT(*) FILTER (WHERE is_active = true AND tier = 'S') AS active_s,
  COUNT(*) FILTER (WHERE is_active = true AND tier = 'A') AS active_a,
  COUNT(*) FILTER (WHERE is_active = true AND tier = 'B') AS active_b,
  COUNT(*) FILTER (WHERE is_active = true AND tier = 'C') AS active_c,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive,
  COUNT(*) FILTER (WHERE is_active = true AND last_scraped_at >= NOW() - INTERVAL '24 hours') AS scraped_24h,
  COUNT(*) FILTER (WHERE is_active = true AND last_scraped_at < NOW() - INTERVAL '7 days') AS stale_7d
FROM brain_accounts;

COMMENT ON VIEW brain_pool_stats IS
  'Quick health snapshot for the discovery circuit breaker and tier daemon. '
  'Discovery pauses when active_total > BRAIN_DISCOVERY_PAUSE_THRESHOLD (default 30000).';

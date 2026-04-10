-- Migration: Tweet-to-Follower-Delta Attribution
-- Created: 2026-04-11
-- Purpose: Link individual tweets to follower count changes that happened in their window.
--
-- Why: brain_account_snapshots tracks follower count over time; brain_tweets tracks
-- individual tweets. There was no way to SQL-query "which tweet came immediately
-- before the follower spike" — you had to eyeball timestamps manually.
--
-- This table is populated by the observatory_tweet_attribution job (runs every 60 min).
-- The job processes tweets from the last 7 days whose authors have growth_status IN
-- ('interesting','hot','explosive') — we deliberately don't attribute tweets from
-- dormant accounts because the signal would be too noisy.
--
-- Design notes:
-- - No fixed-window columns (delta_24h, delta_48h). Census cadence varies by tier
--   (6h explosive / 12h hot / 24h interesting / 168h boring), so fixed windows would
--   be ~70% null. Instead we store the actual next-snapshot delta and window_hours
--   and let downstream SQL normalize per-day.
-- - attribution_weight is tweet-type weighted (original=1.0, thread=1.0, quote=0.5,
--   reply=0.1) then scaled by engagement rank within the window. A reply with 500
--   likes does not drive followers the way an original with 500 likes does.
-- - attribution_confidence reflects how cleanly we can pin the delta to THIS tweet:
--   'high' = exactly one tweet from this author in the window; 'medium' = 2-5 tweets
--   sharing the window; 'low' = >5 tweets sharing the window (individual signal noisy).
-- - Loose join by tweet_id / author_username / snapshot ids — no hard FKs, consistent
--   with existing brain_* schema conventions.

CREATE TABLE IF NOT EXISTS brain_tweet_follower_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  tweet_type TEXT NOT NULL,
  baseline_snapshot_id UUID,
  baseline_followers INT,
  baseline_checked_at TIMESTAMPTZ,
  next_snapshot_id UUID,
  next_followers INT,
  next_checked_at TIMESTAMPTZ,
  window_hours NUMERIC,
  delta_followers INT,
  attribution_weight NUMERIC,
  attribution_confidence TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tweet_id)
);

CREATE INDEX IF NOT EXISTS idx_brain_attribution_author_posted ON brain_tweet_follower_attribution(author_username, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_attribution_tweet ON brain_tweet_follower_attribution(tweet_id);
CREATE INDEX IF NOT EXISTS idx_brain_attribution_delta ON brain_tweet_follower_attribution(delta_followers DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_brain_attribution_confidence ON brain_tweet_follower_attribution(attribution_confidence);
CREATE INDEX IF NOT EXISTS idx_brain_attribution_computed ON brain_tweet_follower_attribution(computed_at DESC);

COMMENT ON TABLE brain_tweet_follower_attribution IS
  'Links brain_tweets to follower count deltas in the window between baseline and next snapshot. '
  'Populated by observatory_tweet_attribution job. Filter on attribution_confidence=high for causal claims.';

COMMENT ON COLUMN brain_tweet_follower_attribution.attribution_weight IS
  'Tweet-type weighted (original=1.0, thread=1.0, quote=0.5, reply=0.1) scaled by engagement rank within window.';

COMMENT ON COLUMN brain_tweet_follower_attribution.attribution_confidence IS
  'high = exactly one tweet from this author in window; medium = 2-5 tweets; low = >5 tweets (noisy).';

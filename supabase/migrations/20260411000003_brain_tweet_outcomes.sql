-- Migration: Per-tweet expected-vs-actual outcomes for external accounts
-- Created: 2026-04-11
-- Purpose: Score every external tweet as breakout/above/expected/below/failure
-- vs the stratified baseline (tier × domain × hour). Populated by the
-- observatory_outcome_scorer job which is the SOLE writer — avoids the circular
-- dependency with Stage 2 classification (classification writes domain, outcomes
-- read domain; if classification also wrote outcomes, we'd have a cycle).
--
-- Column name note: expected_views / expected_likes / outcome_class already
-- exist on the feedback_events table for OUR OWN tweets in the posting system.
-- We deliberately use a separate table (brain_tweet_outcomes) to avoid:
--   1. Semantic collision with feedback_events
--   2. Migrating the hot brain_tweets table to add new columns
--
-- The two systems are complementary:
--   - feedback_events = posting system's expected-vs-actual for OUR tweets
--   - brain_tweet_outcomes = brain's expected-vs-actual for EXTERNAL tweets

CREATE TABLE IF NOT EXISTS brain_tweet_outcomes (
  tweet_id TEXT PRIMARY KEY,
  expected_views NUMERIC,
  expected_likes NUMERIC,
  actual_views NUMERIC,
  actual_likes NUMERIC,
  outcome_class TEXT,
  baseline_source TEXT,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_outcomes_class ON brain_tweet_outcomes(outcome_class);
CREATE INDEX IF NOT EXISTS idx_brain_outcomes_computed ON brain_tweet_outcomes(computed_at DESC);

COMMENT ON TABLE brain_tweet_outcomes IS
  'Per-tweet expected-vs-actual outcome class (breakout/above/expected/below/failure). '
  'Written by observatory_outcome_scorer only — do NOT write from other jobs. '
  'Distinct from feedback_events (which covers our own posting system tweets).';

COMMENT ON COLUMN brain_tweet_outcomes.baseline_source IS
  'stratified = used brain_engagement_baselines bucket; per_author_fallback = used brain_accounts.avg_likes_30d';

COMMENT ON COLUMN brain_tweet_outcomes.outcome_class IS
  'breakout (actual >= p75*1.5), above (>= p75), expected (p25-p75), below (< p25), failure (< p25*0.5)';

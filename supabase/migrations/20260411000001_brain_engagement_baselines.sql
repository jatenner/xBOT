-- Migration: Stratified engagement baselines for external accounts
-- Created: 2026-04-11
-- Purpose: Cross-account baseline ranges by (tier, domain, posted_hour_utc) so
-- we can ask "was this tweet unusual for accounts LIKE this one?"
--
-- Complements the per-author signal:
--   - brain_accounts.avg_likes_30d + brain_tweets.viral_multiplier answer
--     "was this tweet unusual for THIS author" (populated by runEngagementBaseline)
--   - brain_engagement_baselines + brain_tweet_outcomes answer
--     "was this tweet unusual for similar accounts" (populated by baselineBuilder +
--     outcomeScorer)
--
-- Rebuilt every 6 hours from brain_tweets + brain_classifications + brain_accounts
-- over a rolling 30-day window. Buckets with sample_size < 20 are excluded; the
-- outcomeScorer falls back to per-author viral_multiplier when no bucket matches.

CREATE TABLE IF NOT EXISTS brain_engagement_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL,
  domain TEXT NOT NULL,
  posted_hour_utc INT NOT NULL,
  sample_size INT NOT NULL,
  median_views NUMERIC,
  p25_views NUMERIC,
  p75_views NUMERIC,
  median_likes NUMERIC,
  p25_likes NUMERIC,
  p75_likes NUMERIC,
  window_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tier, domain, posted_hour_utc, window_days)
);

CREATE INDEX IF NOT EXISTS idx_brain_baselines_lookup ON brain_engagement_baselines(tier, domain, posted_hour_utc);
CREATE INDEX IF NOT EXISTS idx_brain_baselines_updated ON brain_engagement_baselines(updated_at DESC);

COMMENT ON TABLE brain_engagement_baselines IS
  'Stratified engagement baselines per (tier, domain, hour) bucket. Rebuilt every 6h by observatory_baseline_builder over rolling 30-day window.';

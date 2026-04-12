-- Migration: Close data gaps in brain system
-- Adds: bio change tracking, hashtag extraction, posting frequency time-series,
-- content evolution detection, and auto-seeding campaigns for profile hops.

-- =============================================================================
-- 1. BIO CHANGE TRACKING
-- Detects when an account changes their bio — correlates with growth pivots.
-- =============================================================================

CREATE TABLE IF NOT EXISTS brain_bio_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL REFERENCES brain_accounts(username),
  old_bio TEXT,
  new_bio TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  followers_at_change INTEGER,
  follower_range TEXT,
  -- What changed (computed at insert time)
  added_keywords TEXT[],     -- words in new_bio not in old_bio
  removed_keywords TEXT[],   -- words in old_bio not in new_bio
  change_type TEXT,          -- 'niche_pivot', 'credentials_added', 'cta_added', 'minor_edit', 'complete_rewrite'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bio_changes_username ON brain_bio_changes(username);
CREATE INDEX idx_bio_changes_date ON brain_bio_changes(changed_at DESC);
CREATE INDEX idx_bio_changes_type ON brain_bio_changes(change_type);
CREATE INDEX idx_bio_changes_range ON brain_bio_changes(follower_range);

-- =============================================================================
-- 2. HASHTAG EXTRACTION (per-tweet)
-- Stores actual hashtag text so we can correlate hashtags with engagement.
-- =============================================================================

CREATE TABLE IF NOT EXISTS brain_tweet_hashtags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  hashtag TEXT NOT NULL,       -- lowercase, without #
  author_username TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  author_followers INTEGER,
  follower_range TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tweet_hashtags_hashtag ON brain_tweet_hashtags(hashtag);
CREATE INDEX idx_tweet_hashtags_tweet ON brain_tweet_hashtags(tweet_id);
CREATE INDEX idx_tweet_hashtags_author ON brain_tweet_hashtags(author_username);
CREATE INDEX idx_tweet_hashtags_engagement ON brain_tweet_hashtags(likes DESC);
CREATE UNIQUE INDEX idx_tweet_hashtags_unique ON brain_tweet_hashtags(tweet_id, hashtag);

-- =============================================================================
-- 3. POSTING FREQUENCY TIME-SERIES
-- Track how posting cadence changes over time for each account.
-- =============================================================================

CREATE TABLE IF NOT EXISTS brain_posting_frequency (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL REFERENCES brain_accounts(username),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Rolling windows
  posts_7d INTEGER,
  posts_14d INTEGER,
  posts_30d INTEGER,
  replies_7d INTEGER,
  replies_14d INTEGER,
  replies_30d INTEGER,
  threads_7d INTEGER,
  -- Computed rates
  posts_per_day_7d REAL,
  posts_per_day_14d REAL,
  posts_per_day_30d REAL,
  reply_ratio_7d REAL,       -- replies / (posts + replies)
  -- Deltas from previous measurement
  frequency_delta_7d REAL,    -- current - previous posts_per_day_7d
  frequency_trend TEXT,       -- 'accelerating', 'stable', 'decelerating', 'sporadic'
  -- Context
  followers_at_measurement INTEGER,
  follower_range TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posting_freq_username ON brain_posting_frequency(username);
CREATE INDEX idx_posting_freq_date ON brain_posting_frequency(measured_at DESC);
CREATE INDEX idx_posting_freq_trend ON brain_posting_frequency(frequency_trend);
CREATE UNIQUE INDEX idx_posting_freq_unique ON brain_posting_frequency(username, measured_at);

-- =============================================================================
-- 4. CONTENT EVOLUTION TRACKING
-- Detect when accounts shift their content strategy.
-- =============================================================================

CREATE TABLE IF NOT EXISTS brain_content_evolution (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL REFERENCES brain_accounts(username),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- What changed
  dimension TEXT NOT NULL,     -- 'hook_type', 'tone', 'format', 'domain', 'media_type', 'reply_ratio'
  old_primary TEXT,            -- dominant value before
  new_primary TEXT,            -- dominant value after
  old_distribution JSONB,     -- {"bold_claim": 0.4, "question": 0.3, ...}
  new_distribution JSONB,
  -- Context
  window_days INTEGER DEFAULT 14,
  sample_size_before INTEGER,
  sample_size_after INTEGER,
  followers_before INTEGER,
  followers_after INTEGER,
  follower_range TEXT,
  -- Was this shift correlated with growth?
  growth_rate_before REAL,
  growth_rate_after REAL,
  growth_correlated BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_evolution_username ON brain_content_evolution(username);
CREATE INDEX idx_content_evolution_dimension ON brain_content_evolution(dimension);
CREATE INDEX idx_content_evolution_correlated ON brain_content_evolution(growth_correlated) WHERE growth_correlated = true;
CREATE INDEX idx_content_evolution_date ON brain_content_evolution(detected_at DESC);

-- =============================================================================
-- 5. AUTO-SEED CAMPAIGNS FOR PROFILE HOP SCALING
-- Pre-seed campaigns across diverse follower ranges and niches.
-- =============================================================================

INSERT INTO brain_seed_campaigns (niche, target_follower_range, target_count, priority, status, seed_accounts)
SELECT niche, range, 500, priority, 'active', seed_accounts
FROM (VALUES
  -- Health (highest priority — our core niche)
  ('health', 'nano',  3, ARRAY['hubermanlab', 'PeterAttiaMD', 'foundmyfitness']),
  ('health', 'micro', 3, ARRAY['hubermanlab', 'PeterAttiaMD', 'foundmyfitness']),
  ('health', 'small', 3, ARRAY['hubermanlab', 'PeterAttiaMD', 'foundmyfitness']),
  ('health', 'mid',   2, ARRAY['hubermanlab', 'PeterAttiaMD']),
  -- Tech
  ('tech', 'nano',  2, ARRAY['levaborenstein', 'swaborenstein', 'elaborenstein']),
  ('tech', 'micro', 2, ARRAY['levaborenstein', 'swaborenstein']),
  ('tech', 'small', 2, ARRAY['levaborenstein', 'swaborenstein']),
  -- Finance
  ('finance', 'nano',  2, ARRAY['naval', 'chaaborenstein']),
  ('finance', 'micro', 2, ARRAY['naval', 'chaaborenstein']),
  -- Personal development
  ('personal_dev', 'nano',  2, ARRAY['aliabdaal', 'jaborenstein']),
  ('personal_dev', 'micro', 2, ARRAY['aliabdaal', 'jaborenstein']),
  -- Crypto
  ('crypto', 'nano',  1, ARRAY['VitalikButerin', 'cobie']),
  ('crypto', 'micro', 1, ARRAY['VitalikButerin', 'cobie']),
  -- AI / Science
  ('science', 'nano',  2, ARRAY['ylecun', 'kaborenstein']),
  ('science', 'micro', 2, ARRAY['ylecun', 'kaborenstein'])
) AS t(niche, range, priority, seed_accounts)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. Add last_bio_hash to brain_accounts for efficient bio-change detection
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS last_bio_hash TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS last_hop_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_brain_accounts_hop ON brain_accounts(last_hop_at) WHERE last_hop_at IS NULL;

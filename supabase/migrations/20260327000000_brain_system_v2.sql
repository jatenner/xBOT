-- Migration: Brain System v2 — Self-Growing Twitter Intelligence
-- Created: 2026-03-27
-- Purpose: 7 new tables for domain-agnostic discovery, classification, self-model, and feedback loop

-- =============================================================================
-- TABLE 1: brain_tweets — Universal tweet store (domain-agnostic)
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  author_username TEXT NOT NULL,
  author_followers INT,
  author_following INT,
  author_tier TEXT DEFAULT 'C',

  -- Content
  content TEXT NOT NULL,
  media_type TEXT DEFAULT 'none',
  tweet_type TEXT NOT NULL DEFAULT 'original',
  is_thread BOOLEAN DEFAULT false,
  thread_position INT,
  parent_tweet_id TEXT,

  -- Raw metrics (scraped from DOM)
  views BIGINT DEFAULT 0,
  likes INT DEFAULT 0,
  retweets INT DEFAULT 0,
  replies INT DEFAULT 0,
  bookmarks INT DEFAULT 0,
  quotes INT DEFAULT 0,

  -- Computed ratios (Stage 1 classification)
  view_to_follower_ratio FLOAT,
  like_to_view_ratio FLOAT,
  bookmark_to_like_ratio FLOAT,
  reply_to_like_ratio FLOAT,
  retweet_to_like_ratio FLOAT,
  quote_to_retweet_ratio FLOAT,
  engagement_rate FLOAT,
  viral_multiplier FLOAT,

  -- Timing
  posted_at TIMESTAMPTZ,
  posted_hour_utc INT,
  posted_day_of_week INT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),

  -- Discovery provenance
  discovery_source TEXT NOT NULL,
  discovery_keyword TEXT,
  discovery_feed_run_id TEXT,

  -- Re-scrape tracking (Stage 3)
  rescrape_count INT DEFAULT 0,
  last_rescrape_at TIMESTAMPTZ,
  peak_likes INT,
  peak_views BIGINT,
  peak_velocity FLOAT,
  time_to_peak_minutes INT,
  engagement_trajectory TEXT,

  -- Content features (structural, extracted at ingest)
  content_features JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_tweets_tweet_id ON brain_tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_brain_tweets_author ON brain_tweets(author_username);
CREATE INDEX IF NOT EXISTS idx_brain_tweets_posted ON brain_tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_tweets_source ON brain_tweets(discovery_source);
CREATE INDEX IF NOT EXISTS idx_brain_tweets_viral ON brain_tweets(viral_multiplier DESC NULLS LAST) WHERE viral_multiplier > 2.0;
CREATE INDEX IF NOT EXISTS idx_brain_tweets_tier ON brain_tweets(author_tier);
CREATE INDEX IF NOT EXISTS idx_brain_tweets_rescrape ON brain_tweets(last_rescrape_at ASC NULLS FIRST) WHERE rescrape_count < 5;
CREATE INDEX IF NOT EXISTS idx_brain_tweets_engagement ON brain_tweets(engagement_rate DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_brain_tweets_likes ON brain_tweets(likes DESC);
CREATE INDEX IF NOT EXISTS idx_brain_tweets_hour ON brain_tweets(posted_hour_utc);

-- =============================================================================
-- TABLE 2: brain_tweet_snapshots — Time-series engagement data
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_tweet_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT NOT NULL,
  views BIGINT,
  likes INT,
  retweets INT,
  replies INT,
  bookmarks INT,
  quotes INT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_snapshots_tweet ON brain_tweet_snapshots(tweet_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_snapshots_scraped ON brain_tweet_snapshots(scraped_at DESC);

-- =============================================================================
-- TABLE 3: brain_accounts — Universal account tracker (auto-tiered)
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,

  -- Metadata
  display_name TEXT,
  followers_count INT,
  following_count INT,
  bio_text TEXT,
  verified BOOLEAN DEFAULT false,
  account_age_days INT,

  -- Tier (rolling percentile, auto-promoted/demoted)
  tier TEXT NOT NULL DEFAULT 'C',
  tier_score FLOAT DEFAULT 0.0,
  tier_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Domain (auto-classified)
  primary_domain TEXT,
  domain_confidence FLOAT,

  -- Performance metrics (rolling 30d)
  avg_views_30d FLOAT,
  avg_likes_30d FLOAT,
  avg_engagement_rate_30d FLOAT,
  viral_rate_30d FLOAT,
  hit_rate_30d FLOAT,
  tweet_frequency_daily FLOAT,
  ff_ratio FLOAT,

  -- Discovery
  discovery_method TEXT NOT NULL DEFAULT 'seed',
  discovered_from_username TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Scraping status
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  scrape_priority FLOAT DEFAULT 0.5,
  scrape_success_count INT DEFAULT 0,
  scrape_failure_count INT DEFAULT 0,
  tweets_collected_count INT DEFAULT 0,
  consecutive_failures INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_accounts_tier ON brain_accounts(tier, tier_score DESC);
CREATE INDEX IF NOT EXISTS idx_brain_accounts_active ON brain_accounts(is_active, scrape_priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brain_accounts_domain ON brain_accounts(primary_domain);
CREATE INDEX IF NOT EXISTS idx_brain_accounts_stale ON brain_accounts(last_scraped_at ASC NULLS FIRST) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brain_accounts_discovery ON brain_accounts(discovery_method);
CREATE INDEX IF NOT EXISTS idx_brain_accounts_username ON brain_accounts(username);

-- =============================================================================
-- TABLE 4: brain_keywords — Self-expanding keyword pool
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT UNIQUE NOT NULL,

  -- Source
  source TEXT NOT NULL DEFAULT 'seed',
  source_detail TEXT,
  domain_hint TEXT,

  -- Performance
  tweets_found_total INT DEFAULT 0,
  tweets_found_last_run INT DEFAULT 0,
  avg_engagement_found FLOAT,
  viral_tweets_found INT DEFAULT 0,
  unique_authors_found INT DEFAULT 0,

  -- Scheduling
  priority FLOAT DEFAULT 0.5,
  last_searched_at TIMESTAMPTZ,
  search_count INT DEFAULT 0,
  staleness_score FLOAT DEFAULT 0.0,

  -- Status
  is_active BOOLEAN DEFAULT true,
  deactivated_reason TEXT,
  deactivated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_keywords_active ON brain_keywords(is_active, priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brain_keywords_stale ON brain_keywords(last_searched_at ASC NULLS FIRST) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brain_keywords_source ON brain_keywords(source);
CREATE INDEX IF NOT EXISTS idx_brain_keywords_domain ON brain_keywords(domain_hint);

-- =============================================================================
-- TABLE 5: brain_classifications — Multi-dimensional AI classification
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,

  -- Stage 2: AI classification (domain-agnostic)
  domain TEXT,
  domain_confidence FLOAT,
  hook_type TEXT,
  tone TEXT,
  format TEXT,
  emotional_trigger TEXT,
  specificity TEXT,
  actionability TEXT,
  identity_signal TEXT,
  controversy_level FLOAT,
  novelty_level FLOAT,

  -- Stage 4: Deep analysis (viral tweets only)
  reply_tree_depth INT,
  top_reply_count INT,
  amplifier_accounts JSONB,
  quote_sentiment_distribution JSONB,
  algo_boost_detected BOOLEAN,
  conversation_quality TEXT,

  -- Metadata
  classification_stage INT DEFAULT 2,
  classified_at TIMESTAMPTZ DEFAULT NOW(),
  classification_model TEXT DEFAULT 'gpt-4o-mini',
  classification_cost_cents FLOAT
);

CREATE INDEX IF NOT EXISTS idx_brain_class_tweet ON brain_classifications(tweet_id);
CREATE INDEX IF NOT EXISTS idx_brain_class_domain ON brain_classifications(domain);
CREATE INDEX IF NOT EXISTS idx_brain_class_hook ON brain_classifications(hook_type);
CREATE INDEX IF NOT EXISTS idx_brain_class_tone ON brain_classifications(tone);
CREATE INDEX IF NOT EXISTS idx_brain_class_format ON brain_classifications(format);
CREATE INDEX IF NOT EXISTS idx_brain_class_stage ON brain_classifications(classification_stage);
CREATE INDEX IF NOT EXISTS idx_brain_class_emotional ON brain_classifications(emotional_trigger);
CREATE INDEX IF NOT EXISTS idx_brain_class_combo ON brain_classifications(domain, hook_type, tone, format);

-- =============================================================================
-- TABLE 6: self_model_state — Our account's self-understanding (singleton)
-- =============================================================================
CREATE TABLE IF NOT EXISTS self_model_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Current state
  follower_count INT NOT NULL DEFAULT 0,
  following_count INT NOT NULL DEFAULT 0,
  growth_phase TEXT NOT NULL DEFAULT 'cold_start',

  -- Rolling performance (7d)
  avg_views_7d FLOAT,
  avg_likes_7d FLOAT,
  avg_engagement_rate_7d FLOAT,
  total_posts_7d INT DEFAULT 0,
  total_replies_7d INT DEFAULT 0,

  -- Rolling performance (30d)
  avg_views_30d FLOAT,
  avg_likes_30d FLOAT,
  avg_engagement_rate_30d FLOAT,
  total_posts_30d INT DEFAULT 0,
  total_replies_30d INT DEFAULT 0,

  -- Best performing patterns (for OUR account)
  best_formats JSONB DEFAULT '[]',
  best_topics JSONB DEFAULT '[]',
  best_hooks JSONB DEFAULT '[]',
  best_posting_hours JSONB DEFAULT '[]',
  best_archetypes JSONB DEFAULT '[]',
  worst_formats JSONB DEFAULT '[]',
  worst_topics JSONB DEFAULT '[]',

  -- Expectations (calibrated to OUR size)
  expected_views_per_post FLOAT,
  expected_likes_per_post FLOAT,
  expected_views_per_reply FLOAT,
  expected_likes_per_reply FLOAT,
  expected_engagement_rate FLOAT,

  -- Growth velocity
  followers_gained_7d INT DEFAULT 0,
  followers_gained_30d INT DEFAULT 0,
  growth_rate_daily FLOAT,
  growth_acceleration FLOAT,

  -- Strategy health
  working_strategies JSONB DEFAULT '[]',
  decaying_strategies JSONB DEFAULT '[]',
  untested_strategies JSONB DEFAULT '[]',

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the singleton row
INSERT INTO self_model_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TABLE 7: feedback_events — Expected vs actual for every action
-- =============================================================================
CREATE TABLE IF NOT EXISTS feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Action reference
  decision_id UUID,
  tweet_id TEXT,
  action_type TEXT NOT NULL,

  -- Expected (predicted before action)
  expected_views FLOAT,
  expected_likes FLOAT,
  expected_engagement_rate FLOAT,

  -- Actual (measured after)
  actual_views INT,
  actual_likes INT,
  actual_engagement_rate FLOAT,
  actual_followers_gained INT,

  -- Delta
  views_delta FLOAT,
  likes_delta FLOAT,
  engagement_delta FLOAT,

  -- Diagnosis
  outcome_class TEXT,
  failure_diagnosis TEXT,
  diagnosis_confidence FLOAT,
  diagnosis_details JSONB,

  -- Context at time of action
  content_features JSONB,
  classification JSONB,
  target_username TEXT,
  target_tier TEXT,
  posted_hour_utc INT,
  posted_day_of_week INT,
  growth_phase TEXT,
  follower_count_at_post INT,

  measured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_action ON feedback_events(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_diagnosis ON feedback_events(failure_diagnosis) WHERE failure_diagnosis IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_outcome ON feedback_events(outcome_class);
CREATE INDEX IF NOT EXISTS idx_feedback_phase ON feedback_events(growth_phase);
CREATE INDEX IF NOT EXISTS idx_feedback_decision ON feedback_events(decision_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_events(created_at DESC);

-- =============================================================================
-- ENHANCE: external_patterns — add tier segmentation
-- =============================================================================
ALTER TABLE external_patterns ADD COLUMN IF NOT EXISTS account_tier_segment TEXT;
ALTER TABLE external_patterns ADD COLUMN IF NOT EXISTS applies_to_phases JSONB DEFAULT '["all"]';

-- =============================================================================
-- ENHANCE: strategy_state — add self-model awareness
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strategy_state') THEN
    ALTER TABLE strategy_state ADD COLUMN IF NOT EXISTS growth_phase TEXT DEFAULT 'cold_start';
    ALTER TABLE strategy_state ADD COLUMN IF NOT EXISTS self_model_version INT DEFAULT 0;
    ALTER TABLE strategy_state ADD COLUMN IF NOT EXISTS tier_segment_weights JSONB DEFAULT '{}';
    ALTER TABLE strategy_state ADD COLUMN IF NOT EXISTS decay_detected_strategies JSONB DEFAULT '[]';
  END IF;
END $$;

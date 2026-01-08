-- Reply System V2: Multi-feed candidate sources, scoring, queueing, and tiered scheduling
-- Goal: 4 replies/hour with >=1000 views target (ratcheting upward)

BEGIN;

-- ============================================================================
-- CANDIDATE SOURCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS candidate_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'curated_accounts', 'keyword_search', 'viral_watcher'
  source_name TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb, -- Source-specific config (accounts list, keywords, etc.)
  enabled BOOLEAN DEFAULT true,
  fetch_interval_minutes INTEGER DEFAULT 5,
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_sources_type ON candidate_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_candidate_sources_enabled ON candidate_sources(enabled);

-- ============================================================================
-- CANDIDATE EVALUATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS candidate_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_tweet_id TEXT NOT NULL,
  candidate_author_username TEXT NOT NULL,
  candidate_content TEXT,
  candidate_posted_at TIMESTAMPTZ,
  
  -- Source tracking
  source_id UUID REFERENCES candidate_sources(id),
  source_type TEXT NOT NULL,
  source_feed_name TEXT,
  
  -- Evaluation results
  is_root_tweet BOOLEAN,
  is_parody BOOLEAN DEFAULT false,
  topic_relevance_score DECIMAL(3,2), -- 0.00 to 1.00
  spam_score DECIMAL(3,2), -- 0.00 to 1.00 (higher = more spam)
  velocity_score DECIMAL(5,2), -- likes/replies/rt per minute
  recency_score DECIMAL(3,2), -- 0.00 to 1.00
  author_signal_score DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Composite score
  overall_score DECIMAL(5,2),
  
  -- Hard filters
  passed_hard_filters BOOLEAN DEFAULT false,
  filter_reason TEXT, -- Why it passed/failed
  
  -- Prediction
  predicted_24h_views INTEGER,
  predicted_tier INTEGER, -- 1 (>=5000), 2 (>=1000), 3 (>=500), 4 (<500)
  
  -- Status
  status TEXT DEFAULT 'evaluated', -- 'evaluated', 'queued', 'posted', 'expired', 'blocked'
  queued_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  
  -- Metadata
  evaluation_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_tweet_id ON candidate_evaluations(candidate_tweet_id);
CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_status ON candidate_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_score ON candidate_evaluations(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_tier ON candidate_evaluations(predicted_tier);
CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_source ON candidate_evaluations(source_type);
CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_posted_at ON candidate_evaluations(posted_at DESC);

-- ============================================================================
-- REPLY CANDIDATE QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_candidate_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES candidate_evaluations(id),
  candidate_tweet_id TEXT NOT NULL,
  
  -- Scores
  overall_score DECIMAL(5,2) NOT NULL,
  predicted_tier INTEGER NOT NULL,
  predicted_24h_views INTEGER,
  
  -- Source
  source_type TEXT NOT NULL,
  source_feed_name TEXT,
  
  -- TTL
  expires_at TIMESTAMPTZ NOT NULL,
  ttl_minutes INTEGER DEFAULT 60, -- Based on age/velocity
  
  -- Status
  status TEXT DEFAULT 'queued', -- 'queued', 'selected', 'posted', 'expired'
  selected_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_queue_status ON reply_candidate_queue(status);
CREATE INDEX IF NOT EXISTS idx_reply_queue_tier ON reply_candidate_queue(predicted_tier);
CREATE INDEX IF NOT EXISTS idx_reply_queue_score ON reply_candidate_queue(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_reply_queue_expires ON reply_candidate_queue(expires_at);
CREATE INDEX IF NOT EXISTS idx_reply_queue_available ON reply_candidate_queue(status, predicted_tier, expires_at) WHERE status = 'queued';

-- ============================================================================
-- REPLY PERFORMANCE METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT, -- Links to content_generation_metadata_comprehensive
  candidate_tweet_id TEXT NOT NULL,
  our_reply_tweet_id TEXT NOT NULL,
  
  -- Performance snapshots
  views_30m INTEGER,
  likes_30m INTEGER,
  replies_30m INTEGER,
  retweets_30m INTEGER,
  
  views_4h INTEGER,
  likes_4h INTEGER,
  replies_4h INTEGER,
  retweets_4h INTEGER,
  
  views_24h INTEGER,
  likes_24h INTEGER,
  replies_24h INTEGER,
  retweets_24h INTEGER,
  
  -- Targets
  target_24h_views INTEGER DEFAULT 1000,
  passed_target BOOLEAN, -- views_24h >= target_24h_views
  
  -- Tier
  predicted_tier INTEGER,
  actual_tier INTEGER, -- Based on actual performance
  
  -- Metadata
  posted_at TIMESTAMPTZ NOT NULL,
  metrics_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_metrics_decision_id ON reply_performance_metrics(decision_id);
CREATE INDEX IF NOT EXISTS idx_reply_metrics_tweet_id ON reply_performance_metrics(our_reply_tweet_id);
CREATE INDEX IF NOT EXISTS idx_reply_metrics_posted_at ON reply_performance_metrics(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_metrics_passed_target ON reply_performance_metrics(passed_target);

-- ============================================================================
-- RATCHET CONTROLLER
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_ratchet_controller (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  
  -- Current threshold
  current_24h_views_threshold INTEGER DEFAULT 1000,
  
  -- Performance metrics
  total_replies INTEGER DEFAULT 0,
  passed_threshold INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2), -- passed_threshold / total_replies * 100
  
  -- Ratchet decision
  ratchet_applied BOOLEAN DEFAULT false,
  new_threshold INTEGER,
  ratchet_reason TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ratchet_week ON reply_ratchet_controller(week_start_date);

-- ============================================================================
-- CURATED ACCOUNTS (for CuratedAccountsFeed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS curated_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  follower_count INTEGER,
  account_type TEXT, -- 'expert', 'influencer', 'researcher', 'practitioner'
  health_topics TEXT[], -- Array of topics
  signal_score DECIMAL(3,2), -- 0.00 to 1.00
  enabled BOOLEAN DEFAULT true,
  last_tweet_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curated_accounts_enabled ON curated_accounts(enabled);
CREATE INDEX IF NOT EXISTS idx_curated_accounts_signal ON curated_accounts(signal_score DESC);

COMMENT ON TABLE candidate_sources IS 'Multi-feed candidate sources configuration';
COMMENT ON TABLE candidate_evaluations IS 'All evaluated candidates with scores and filters';
COMMENT ON TABLE reply_candidate_queue IS 'Shortlist queue of top candidates ready for posting';
COMMENT ON TABLE reply_performance_metrics IS 'Performance tracking for posted replies';
COMMENT ON TABLE reply_ratchet_controller IS 'Weekly ratchet controller for quality thresholds';

COMMIT;


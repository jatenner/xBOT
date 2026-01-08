-- Reply System V2 Hardening: Traceability + SLO Tracking
-- Adds end-to-end traceability and 4/hour SLO monitoring

BEGIN;

-- ============================================================================
-- TRACEABILITY: Add run IDs to all tables
-- ============================================================================

-- Add feed_run_id to candidate_evaluations
ALTER TABLE candidate_evaluations 
ADD COLUMN IF NOT EXISTS feed_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_candidate_evaluations_feed_run_id ON candidate_evaluations(feed_run_id);

-- Add candidate_evaluation_id to reply_candidate_queue (already exists via evaluation_id, but add explicit reference)
-- evaluation_id already exists, so we're good

-- Add scheduler_run_id to reply_candidate_queue
ALTER TABLE reply_candidate_queue
ADD COLUMN IF NOT EXISTS scheduler_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_reply_queue_scheduler_run_id ON reply_candidate_queue(scheduler_run_id);

-- Add candidate_evaluation_id and queue_id to content_generation_metadata_comprehensive
ALTER TABLE content_generation_metadata_comprehensive
ADD COLUMN IF NOT EXISTS candidate_evaluation_id UUID REFERENCES candidate_evaluations(id),
ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES reply_candidate_queue(id),
ADD COLUMN IF NOT EXISTS scheduler_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_content_metadata_candidate_eval ON content_generation_metadata_comprehensive(candidate_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_content_metadata_queue_id ON content_generation_metadata_comprehensive(queue_id);
CREATE INDEX IF NOT EXISTS idx_content_metadata_scheduler_run ON content_generation_metadata_comprehensive(scheduler_run_id);

-- Add decision_id to reply_performance_metrics (already exists, verify)
-- decision_id already exists

-- ============================================================================
-- SLO TRACKING: Reply SLO Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_slo_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduler_run_id TEXT NOT NULL,
  slot_time TIMESTAMPTZ NOT NULL, -- The 15-min slot this represents
  
  -- Result
  posted BOOLEAN NOT NULL,
  reason TEXT, -- 'queue_empty', 'all_blocked', 'insufficient_metrics', 'posting_failed', 'posted_successfully'
  
  -- Candidate info (if attempted)
  candidate_tweet_id TEXT,
  candidate_evaluation_id UUID REFERENCES candidate_evaluations(id),
  queue_id UUID REFERENCES reply_candidate_queue(id),
  predicted_tier INTEGER,
  
  -- Decision/permit info (if posted)
  decision_id TEXT,
  permit_id TEXT,
  posted_tweet_id TEXT,
  
  -- Supply metrics at time of slot
  queue_size INTEGER,
  tier_1_count INTEGER,
  tier_2_count INTEGER,
  tier_3_count INTEGER,
  
  -- SLO status
  slo_hit BOOLEAN, -- true if posted, false if missed
  slo_target INTEGER DEFAULT 4, -- replies per hour target
  
  -- Metadata
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reply_slo_slot_time ON reply_slo_events(slot_time DESC);
CREATE INDEX IF NOT EXISTS idx_reply_slo_posted ON reply_slo_events(posted);
CREATE INDEX IF NOT EXISTS idx_reply_slo_scheduler_run ON reply_slo_events(scheduler_run_id);
CREATE INDEX IF NOT EXISTS idx_reply_slo_decision_id ON reply_slo_events(decision_id);

-- ============================================================================
-- SUPPLY + QUALITY SUMMARY REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_system_summary_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_start TIMESTAMPTZ NOT NULL,
  
  -- Supply metrics
  candidates_evaluated INTEGER DEFAULT 0,
  candidates_passed_filters INTEGER DEFAULT 0,
  candidates_blocked INTEGER DEFAULT 0,
  block_reasons JSONB DEFAULT '{}'::jsonb, -- { 'not_root': 10, 'parody': 5, 'low_topic': 20, ... }
  
  queue_size INTEGER DEFAULT 0,
  tier_distribution JSONB DEFAULT '{}'::jsonb, -- { 'tier_1': 5, 'tier_2': 15, 'tier_3': 5 }
  
  -- SLO metrics
  slo_target INTEGER DEFAULT 4,
  slo_hits INTEGER DEFAULT 0,
  slo_misses INTEGER DEFAULT 0,
  slo_reasons JSONB DEFAULT '{}'::jsonb, -- { 'queue_empty': 2, 'posting_failed': 1 }
  
  -- Quality metrics
  replies_posted INTEGER DEFAULT 0,
  replies_tier_1 INTEGER DEFAULT 0,
  replies_tier_2 INTEGER DEFAULT 0,
  replies_tier_3 INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reply_summary_hourly_time ON reply_system_summary_hourly(hour_start);
CREATE INDEX IF NOT EXISTS idx_reply_summary_hourly_created ON reply_system_summary_hourly(created_at DESC);

CREATE TABLE IF NOT EXISTS reply_system_summary_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  
  -- Performance metrics
  total_replies INTEGER DEFAULT 0,
  replies_with_24h_metrics INTEGER DEFAULT 0,
  
  views_24h_distribution JSONB DEFAULT '{}'::jsonb, -- { '0-100': 5, '100-500': 10, '500-1000': 8, '1000-5000': 12, '5000+': 3 }
  views_24h_median INTEGER,
  views_24h_mean DECIMAL(10,2),
  views_24h_p25 INTEGER,
  views_24h_p75 INTEGER,
  
  success_rate_1000 DECIMAL(5,2), -- % with >=1000 views
  success_rate_5000 DECIMAL(5,2), -- % with >=5000 views
  
  -- Tier performance
  tier_1_actual_performance JSONB DEFAULT '{}'::jsonb,
  tier_2_actual_performance JSONB DEFAULT '{}'::jsonb,
  tier_3_actual_performance JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reply_summary_daily_date ON reply_system_summary_daily(date);
CREATE INDEX IF NOT EXISTS idx_reply_summary_daily_created ON reply_system_summary_daily(created_at DESC);

COMMENT ON TABLE reply_slo_events IS 'SLO tracking for 4 replies/hour target';
COMMENT ON TABLE reply_system_summary_hourly IS 'Hourly supply + quality summary';
COMMENT ON TABLE reply_system_summary_daily IS 'Daily performance summary';

COMMIT;


-- Migration: Growth Observatory — Account-Tracking Intelligence System
-- Created: 2026-03-28
-- Purpose: 7 new tables + brain_accounts growth tracking columns
-- Tracks hundreds of thousands of accounts over time, detects growth, builds strategy playbooks.

-- =============================================================================
-- TABLE 1: brain_account_snapshots — Time-series follower counts (the census)
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  followers_count INT,
  following_count INT,
  bio_text TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_acct_snap_user_time ON brain_account_snapshots(username, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_acct_snap_time ON brain_account_snapshots(checked_at DESC);

-- =============================================================================
-- TABLE 2: brain_growth_events — Detected growth accelerations
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_growth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  growth_rate_before FLOAT,
  growth_rate_after FLOAT,
  acceleration_factor FLOAT,
  trigger_type TEXT DEFAULT 'organic',
  growth_phase_at_detection TEXT,
  followers_at_detection INT,
  retrospective_status TEXT DEFAULT 'pending',
  retrospective_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_growth_events_user ON brain_growth_events(username, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_growth_events_status ON brain_growth_events(retrospective_status) WHERE retrospective_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_brain_growth_events_time ON brain_growth_events(detected_at DESC);

-- =============================================================================
-- TABLE 3: brain_account_profiles — AI-classified account type and behavior
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_account_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  account_type TEXT,
  niche TEXT,
  sub_niches JSONB DEFAULT '[]',
  voice_style TEXT,
  posting_frequency_daily FLOAT,
  reply_ratio FLOAT,
  avg_reply_target_size INT,
  active_hours JSONB,
  content_style_summary TEXT,
  ff_ratio FLOAT,
  profile_confidence FLOAT,
  profiled_at TIMESTAMPTZ DEFAULT NOW(),
  profile_version INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_brain_acct_profiles_user ON brain_account_profiles(username);
CREATE INDEX IF NOT EXISTS idx_brain_acct_profiles_type ON brain_account_profiles(account_type);
CREATE INDEX IF NOT EXISTS idx_brain_acct_profiles_niche ON brain_account_profiles(niche);

-- =============================================================================
-- TABLE 4: brain_retrospective_analyses — What growing accounts did differently
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_retrospective_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  growth_event_id UUID,
  period_before_start TIMESTAMPTZ,
  period_before_end TIMESTAMPTZ,
  period_during_start TIMESTAMPTZ,
  period_during_end TIMESTAMPTZ,
  before_stats JSONB,
  during_stats JSONB,
  key_changes JSONB,
  external_correlations JSONB,
  analysis_summary TEXT,
  analysis_model TEXT DEFAULT 'gpt-4o-mini',
  analyzed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_retro_user ON brain_retrospective_analyses(username, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_retro_event ON brain_retrospective_analyses(growth_event_id);

-- =============================================================================
-- TABLE 5: brain_strategy_library — Aggregated playbooks by stage
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_strategy_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  strategy_category TEXT,
  win_rate FLOAT,
  sample_size INT DEFAULT 0,
  winning_patterns JSONB DEFAULT '{}',
  losing_patterns JSONB DEFAULT '{}',
  key_differentiators JSONB DEFAULT '{}',
  avg_growth_rate FLOAT,
  median_days_to_next_stage FLOAT,
  confidence TEXT DEFAULT 'low',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stage, strategy_name)
);

CREATE INDEX IF NOT EXISTS idx_brain_strategy_lib_stage ON brain_strategy_library(stage, win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_brain_strategy_lib_cat ON brain_strategy_library(strategy_category);

-- =============================================================================
-- TABLE 6: brain_strategy_memory — Our own experiment tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_strategy_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_name TEXT NOT NULL,
  test_number INT DEFAULT 1,
  test_period_start TIMESTAMPTZ,
  test_period_end TIMESTAMPTZ,
  our_results JSONB,
  benchmark JSONB,
  diagnosis TEXT,
  verdict TEXT DEFAULT 'in_progress',
  next_action TEXT,
  shelf_status TEXT DEFAULT 'active',
  revisit_at TIMESTAMPTZ,
  shelved_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_strat_mem_name ON brain_strategy_memory(strategy_name, test_number DESC);
CREATE INDEX IF NOT EXISTS idx_brain_strat_mem_verdict ON brain_strategy_memory(verdict);
CREATE INDEX IF NOT EXISTS idx_brain_strat_mem_shelf ON brain_strategy_memory(shelf_status, revisit_at) WHERE shelf_status = 'shelved';

-- =============================================================================
-- TABLE 7: brain_daily_context — What was happening on Twitter each day
-- =============================================================================
CREATE TABLE IF NOT EXISTS brain_daily_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_date DATE UNIQUE NOT NULL,
  trending_topics JSONB DEFAULT '[]',
  major_events JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_daily_ctx_date ON brain_daily_context(context_date DESC);

-- =============================================================================
-- ENHANCE: brain_accounts — Add growth tracking columns
-- =============================================================================
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS growth_status TEXT DEFAULT 'unknown';
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS census_frequency_hours INT DEFAULT 168;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS growth_rate_7d FLOAT;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS growth_rate_30d FLOAT;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS growth_acceleration FLOAT;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS prev_followers_count INT;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS first_snapshot_at TIMESTAMPTZ;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS latest_snapshot_at TIMESTAMPTZ;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS snapshot_count INT DEFAULT 0;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS growth_events_count INT DEFAULT 0;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS last_census_at TIMESTAMPTZ;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS next_census_at TIMESTAMPTZ;

-- Denormalized from brain_account_profiles for fast queries
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS account_type_cached TEXT;
ALTER TABLE brain_accounts ADD COLUMN IF NOT EXISTS niche_cached TEXT;

-- New indexes for observatory queries
CREATE INDEX IF NOT EXISTS idx_brain_accounts_growth ON brain_accounts(growth_status);
CREATE INDEX IF NOT EXISTS idx_brain_accounts_census ON brain_accounts(next_census_at ASC NULLS FIRST) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_brain_accounts_growth_rate ON brain_accounts(growth_rate_7d DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_brain_accounts_growth_accel ON brain_accounts(growth_acceleration DESC NULLS LAST);

-- Set initial next_census_at for all existing accounts so they enter the census pipeline
UPDATE brain_accounts
SET next_census_at = NOW() + (random() * INTERVAL '72 hours'),
    growth_status = 'unknown'
WHERE next_census_at IS NULL;

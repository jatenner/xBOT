-- Pattern Engine output: growth playbooks per (niche × from_range × to_range)
-- Growth Story Generator output: human-readable growth narratives

-- =============================================================================
-- 1. GROWTH PLAYBOOKS
-- One row per (niche, from_range, to_range) — the computed "recipe" for growth
-- =============================================================================

CREATE TABLE IF NOT EXISTS brain_growth_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche TEXT,                          -- NULL = cross-niche aggregate
  from_range TEXT NOT NULL,
  to_range TEXT NOT NULL,
  sample_size INT NOT NULL DEFAULT 0,

  -- Volume metrics
  avg_posts_per_day NUMERIC,
  avg_replies_per_day NUMERIC,
  avg_threads_per_day NUMERIC,

  -- Content metrics
  avg_word_count_posts NUMERIC,
  avg_word_count_replies NUMERIC,
  reply_ratio NUMERIC,
  thread_ratio NUMERIC,

  -- Reply targeting
  reply_target_distribution JSONB,
  avg_reply_target_followers NUMERIC,
  avg_reply_delay_minutes NUMERIC,

  -- Content style (from AI classification)
  top_hook_types JSONB,
  top_tones JSONB,
  top_formats JSONB,

  -- Timing
  best_posting_hours_utc INT[],

  -- Media
  media_type_distribution JSONB,

  -- CTA & algorithm signals
  cta_usage_rate NUMERIC,
  avg_algo_score NUMERIC,
  avg_bookmark_save_rate NUMERIC,
  avg_engagement_rate NUMERIC,
  avg_likes NUMERIC,
  avg_views NUMERIC,

  -- Bio characteristics of accounts that grew
  bio_patterns JSONB,

  -- Content evolution during transition
  content_evolution_patterns JSONB,

  -- Comparison to stagnant accounts
  stagnant_comparison JSONB,
  key_differentiators JSONB,

  -- Metadata
  avg_days_to_transition NUMERIC,
  confidence TEXT NOT NULL DEFAULT 'low',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(COALESCE(niche, '__cross_niche__'), from_range, to_range)
);

CREATE INDEX IF NOT EXISTS idx_playbooks_range ON brain_growth_playbooks(from_range, to_range);
CREATE INDEX IF NOT EXISTS idx_playbooks_niche ON brain_growth_playbooks(niche);
CREATE INDEX IF NOT EXISTS idx_playbooks_confidence ON brain_growth_playbooks(confidence) WHERE confidence IN ('medium', 'high');

-- =============================================================================
-- 2. GROWTH STORIES
-- Human-readable narratives of how specific accounts grew
-- =============================================================================

CREATE TABLE IF NOT EXISTS brain_growth_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  growth_event_id UUID,

  -- The journey
  from_range TEXT NOT NULL,
  to_range TEXT NOT NULL,
  from_followers INT,
  to_followers INT,
  days_elapsed NUMERIC,

  -- Structured data
  content_summary JSONB,
  reply_strategy JSONB,
  key_tweets JSONB,
  bio_changes JSONB,
  content_evolution JSONB,
  peer_comparison JSONB,

  -- AI-generated narrative
  story_headline TEXT,
  story_narrative TEXT,

  -- Metadata
  ai_model TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(username, growth_event_id)
);

CREATE INDEX IF NOT EXISTS idx_stories_range ON brain_growth_stories(from_range, to_range);
CREATE INDEX IF NOT EXISTS idx_stories_generated ON brain_growth_stories(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_username ON brain_growth_stories(username);

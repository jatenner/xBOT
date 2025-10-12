-- Enhanced Content Generation System Database Migration
-- Creates tables for viral patterns, hook evolution, and follower optimization

-- Viral Patterns Table (from Viral Formula Discovery Engine)
CREATE TABLE IF NOT EXISTS viral_patterns (
  pattern_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Pattern structure (stored as JSONB)
  hook_template TEXT NOT NULL,
  content_flow JSONB DEFAULT '[]',
  evidence_requirements JSONB DEFAULT '[]',
  engagement_triggers JSONB DEFAULT '[]',
  
  -- Performance metrics
  viral_success_rate REAL NOT NULL DEFAULT 0,
  avg_follower_conversion REAL NOT NULL DEFAULT 0,
  avg_engagement_multiplier REAL NOT NULL DEFAULT 1,
  avg_viral_coefficient REAL NOT NULL DEFAULT 0,
  
  -- Learning data
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discovery_method TEXT CHECK (discovery_method IN ('automatic', 'manual', 'evolved')) DEFAULT 'automatic',
  
  -- Usage context (stored as JSONB arrays)
  best_topics JSONB DEFAULT '[]',
  optimal_timing JSONB DEFAULT '[]',
  target_audiences JSONB DEFAULT '[]',
  avoid_conditions JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_viral_success_rate CHECK (viral_success_rate >= 0 AND viral_success_rate <= 1),
  CONSTRAINT valid_confidence_score_vp CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- Hook DNA Table (from Hook Evolution Engine)
CREATE TABLE IF NOT EXISTS hook_dna (
  hook_id TEXT PRIMARY KEY,
  hook_text TEXT NOT NULL,
  hook_category TEXT CHECK (hook_category IN ('statistical', 'contrarian', 'authority', 'curiosity', 'social_proof', 'value_bomb')) NOT NULL,
  
  -- Performance genetics (0-1 scores)
  engagement_gene REAL NOT NULL DEFAULT 0.5,
  viral_gene REAL NOT NULL DEFAULT 0.5,
  follower_gene REAL NOT NULL DEFAULT 0.5,
  authority_gene REAL NOT NULL DEFAULT 0.5,
  
  -- Hook characteristics
  word_count INTEGER NOT NULL DEFAULT 0,
  has_statistics BOOLEAN DEFAULT FALSE,
  has_controversy BOOLEAN DEFAULT FALSE,
  has_question BOOLEAN DEFAULT FALSE,
  has_emotional_trigger BOOLEAN DEFAULT FALSE,
  
  -- Evolution data
  generation INTEGER NOT NULL DEFAULT 0,
  parent_hooks JSONB DEFAULT '[]', -- Array of parent hook IDs
  mutation_rate REAL NOT NULL DEFAULT 0.3,
  
  -- Performance tracking
  times_used INTEGER NOT NULL DEFAULT 0,
  avg_engagement_rate REAL NOT NULL DEFAULT 0,
  avg_viral_coefficient REAL NOT NULL DEFAULT 0,
  avg_followers_gained REAL NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0,
  
  -- Context data (stored as JSONB arrays)
  best_topics JSONB DEFAULT '[]',
  best_audiences JSONB DEFAULT '[]',
  optimal_timing JSONB DEFAULT '[]',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  last_evolved TIMESTAMPTZ,
  
  CONSTRAINT valid_genes CHECK (
    engagement_gene >= 0 AND engagement_gene <= 1 AND
    viral_gene >= 0 AND viral_gene <= 1 AND
    follower_gene >= 0 AND follower_gene <= 1 AND
    authority_gene >= 0 AND authority_gene <= 1
  ),
  CONSTRAINT valid_success_rate_hd CHECK (success_rate >= 0 AND success_rate <= 1),
  CONSTRAINT valid_mutation_rate CHECK (mutation_rate >= 0 AND mutation_rate <= 1)
);

-- Hook Performance Table (tracks individual hook usage and results)
CREATE TABLE IF NOT EXISTS hook_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hook_id TEXT NOT NULL REFERENCES hook_dna(hook_id),
  
  -- Performance metrics
  engagement_rate REAL NOT NULL DEFAULT 0,
  viral_coefficient REAL NOT NULL DEFAULT 0,
  followers_gained INTEGER NOT NULL DEFAULT 0,
  
  -- Context
  topic TEXT NOT NULL,
  audience TEXT NOT NULL,
  post_id TEXT, -- Link to actual post if available
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Follower Magnet Content Table (tracks follower-optimized content)
CREATE TABLE IF NOT EXISTS follower_magnet_content (
  content_id TEXT PRIMARY KEY,
  
  -- Content data
  content_text TEXT NOT NULL,
  content_format TEXT CHECK (content_format IN ('single', 'thread')) NOT NULL,
  
  -- Follower acquisition metrics
  follower_magnet_score REAL NOT NULL DEFAULT 0,
  viral_potential REAL NOT NULL DEFAULT 0,
  conversion_hooks JSONB DEFAULT '[]',
  
  -- Content characteristics
  hook_strategy TEXT CHECK (hook_strategy IN ('authority_builder', 'controversy_magnet', 'value_bomb', 'curiosity_gap', 'social_proof')) NOT NULL,
  credibility_signals JSONB DEFAULT '[]',
  follow_triggers JSONB DEFAULT '[]',
  
  -- Meta information
  topic TEXT NOT NULL,
  angle TEXT NOT NULL,
  uniqueness_indicators JSONB DEFAULT '[]',
  target_audience TEXT CHECK (target_audience IN ('health_seekers', 'fitness_enthusiasts', 'wellness_beginners', 'biohackers')) NOT NULL,
  
  -- Performance tracking
  times_used INTEGER NOT NULL DEFAULT 0,
  avg_followers_gained REAL NOT NULL DEFAULT 0,
  avg_engagement_rate REAL NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  
  CONSTRAINT valid_magnet_scores CHECK (
    follower_magnet_score >= 0 AND follower_magnet_score <= 1 AND
    viral_potential >= 0 AND viral_potential <= 1
  ),
  CONSTRAINT valid_success_rate_fmc CHECK (success_rate >= 0 AND success_rate <= 1)
);

-- Master Content Generation Log (tracks all master content generation attempts)
CREATE TABLE IF NOT EXISTS master_content_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  
  -- Generation request
  primary_goal TEXT CHECK (primary_goal IN ('followers', 'viral', 'engagement', 'authority')) NOT NULL,
  secondary_goal TEXT CHECK (secondary_goal IN ('followers', 'viral', 'engagement', 'authority')),
  target_audience TEXT,
  format_preference TEXT,
  viral_target TEXT,
  
  -- Generation result
  generation_method TEXT CHECK (generation_method IN ('follower_optimized', 'viral_formula', 'hook_evolved', 'hybrid')) NOT NULL,
  hook_used_id TEXT, -- References hook_dna.hook_id
  viral_pattern_used_id TEXT, -- References viral_patterns.pattern_id
  
  -- Predictions made
  predicted_followers INTEGER NOT NULL DEFAULT 0,
  predicted_engagement_rate REAL NOT NULL DEFAULT 0,
  predicted_viral_coefficient REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  
  -- Actual results (updated later)
  actual_followers INTEGER,
  actual_engagement_rate REAL,
  actual_viral_coefficient REAL,
  
  -- Performance analysis
  prediction_accuracy REAL, -- How accurate were our predictions?
  generation_success BOOLEAN, -- Did this generation method work well?
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  results_updated_at TIMESTAMPTZ,
  
  CONSTRAINT valid_confidence_score_mcl CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_viral_patterns_success_rate ON viral_patterns(viral_success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_confidence ON viral_patterns(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_patterns_discovery_method ON viral_patterns(discovery_method);

CREATE INDEX IF NOT EXISTS idx_hook_dna_category ON hook_dna(hook_category);
CREATE INDEX IF NOT EXISTS idx_hook_dna_generation ON hook_dna(generation);
CREATE INDEX IF NOT EXISTS idx_hook_dna_success_rate ON hook_dna(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_hook_dna_times_used ON hook_dna(times_used DESC);
CREATE INDEX IF NOT EXISTS idx_hook_dna_last_used ON hook_dna(last_used DESC);

CREATE INDEX IF NOT EXISTS idx_hook_performance_hook_id ON hook_performance(hook_id);
CREATE INDEX IF NOT EXISTS idx_hook_performance_created_at ON hook_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hook_performance_engagement ON hook_performance(engagement_rate DESC);

CREATE INDEX IF NOT EXISTS idx_follower_magnet_strategy ON follower_magnet_content(hook_strategy);
CREATE INDEX IF NOT EXISTS idx_follower_magnet_score ON follower_magnet_content(follower_magnet_score DESC);
CREATE INDEX IF NOT EXISTS idx_follower_magnet_audience ON follower_magnet_content(target_audience);

CREATE INDEX IF NOT EXISTS idx_master_content_method ON master_content_log(generation_method);
CREATE INDEX IF NOT EXISTS idx_master_content_goal ON master_content_log(primary_goal);
CREATE INDEX IF NOT EXISTS idx_master_content_created ON master_content_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_content_confidence ON master_content_log(confidence_score DESC);

-- Add helpful comments
COMMENT ON TABLE viral_patterns IS 'Discovered viral content patterns with performance metrics';
COMMENT ON TABLE hook_dna IS 'Evolutionary hook system with genetic algorithms for optimization';
COMMENT ON TABLE hook_performance IS 'Individual hook usage tracking for learning and evolution';
COMMENT ON TABLE follower_magnet_content IS 'Content specifically optimized for follower acquisition';
COMMENT ON TABLE master_content_log IS 'Comprehensive log of all master content generation attempts';

-- Insert some foundation viral patterns
INSERT INTO viral_patterns (pattern_id, name, description, hook_template, content_flow, evidence_requirements, engagement_triggers, viral_success_rate, avg_follower_conversion, avg_engagement_multiplier, avg_viral_coefficient, sample_size, confidence_score, discovery_method, best_topics, optimal_timing, target_audiences) VALUES
('authority_stat_bomb', 'Authority Statistical Bomb', 'Establish authority with surprising statistics', 'X% of people believe Y, but new research shows Z', '["hook", "surprising_stat", "mechanism", "actionable_advice"]', '["recent_studies_with_sample_sizes"]', '["surprise", "authority", "value"]', 0.45, 12.3, 1.8, 0.35, 8, 0.7, 'manual', '["metabolism", "sleep", "nutrition myths"]', '["Tuesday 2PM", "Thursday 11AM"]', '["health_seekers", "biohackers"]'),
('controversy_curiosity', 'Controversial Curiosity Gap', 'Create curiosity with controversial takes', 'Everything you know about X is wrong. Here''s why:', '["controversial_hook", "evidence", "mechanism", "mind_blown_moment"]', '["contrarian_research"]', '["curiosity", "controversy", "surprise"]', 0.38, 15.7, 2.1, 0.42, 6, 0.65, 'manual', '["fitness myths", "diet industry", "supplement truth"]', '["Monday 9AM", "Wednesday 3PM"]', '["wellness_beginners", "fitness_enthusiasts"]');

-- Insert some foundation hooks
INSERT INTO hook_dna (hook_id, hook_text, hook_category, engagement_gene, viral_gene, follower_gene, authority_gene, word_count, has_statistics, has_controversy, has_question, has_emotional_trigger, generation, parent_hooks, mutation_rate, best_topics, best_audiences, optimal_timing) VALUES
('foundation_stat_1', 'X% of people believe Y, but new research shows Z', 'statistical', 0.7, 0.6, 0.8, 0.9, 9, true, true, false, true, 0, '[]', 0.3, '["health", "nutrition", "fitness"]', '["health_seekers", "biohackers"]', '["Tuesday", "Thursday"]'),
('foundation_contrarian_1', 'Everything you know about X is wrong. Here''s why:', 'contrarian', 0.8, 0.9, 0.7, 0.6, 8, false, true, false, true, 0, '[]', 0.4, '["myths", "misconceptions", "conventional_wisdom"]', '["wellness_beginners", "fitness_enthusiasts"]', '["Monday", "Wednesday"]'),
('foundation_authority_1', 'New research reveals surprising truth about X', 'authority', 0.6, 0.5, 0.7, 0.8, 7, false, false, false, true, 0, '[]', 0.3, '["health", "science", "research"]', '["health_seekers", "biohackers"]', '["Tuesday", "Friday"]');

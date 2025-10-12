-- Learning System Database Migration
-- Creates tables for enhanced performance tracking, pattern discovery, and prediction learning

-- Enhanced Performance Tracking Table
CREATE TABLE IF NOT EXISTS enhanced_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  engagement_rate REAL NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  retweets INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  saves INTEGER DEFAULT 0,
  
  -- Enhanced metrics
  time_to_peak_engagement REAL DEFAULT 0, -- Minutes until max engagement
  engagement_decay_rate REAL DEFAULT 0, -- How fast engagement drops (per hour)
  audience_retention REAL DEFAULT 0, -- Followers retained after post
  viral_coefficient REAL DEFAULT 0, -- Spread beyond direct followers
  reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  topic_saturation_effect REAL DEFAULT 1.0, -- Performance vs recent similar content
  
  -- Content characteristics
  content_length INTEGER NOT NULL DEFAULT 0,
  has_statistics BOOLEAN DEFAULT FALSE,
  has_controversy BOOLEAN DEFAULT FALSE,
  hook_type TEXT NOT NULL DEFAULT 'generic_hook',
  evidence_type TEXT NOT NULL DEFAULT 'anecdotal_evidence',
  topic TEXT NOT NULL,
  format TEXT CHECK (format IN ('single', 'thread')) DEFAULT 'single',
  posting_time TIMESTAMPTZ NOT NULL,
  day_of_week INTEGER NOT NULL DEFAULT 0,
  
  -- Prediction accuracy
  predicted_engagement REAL DEFAULT 0,
  prediction_error REAL DEFAULT 0,
  
  -- Timestamps
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6)
);

-- Content Patterns Table
CREATE TABLE IF NOT EXISTS content_patterns (
  pattern_id TEXT PRIMARY KEY,
  pattern_type TEXT CHECK (pattern_type IN ('hook', 'topic', 'format', 'timing', 'evidence')) NOT NULL,
  pattern_description TEXT NOT NULL,
  avg_performance REAL NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 0,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_validated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- Discovered Patterns Table (from Pattern Discovery Engine)
CREATE TABLE IF NOT EXISTS discovered_patterns (
  id TEXT PRIMARY KEY,
  type TEXT CHECK (type IN ('content_structure', 'timing', 'topic_combination', 'audience_behavior', 'viral_element')) NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  impact_score REAL NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validation_status TEXT CHECK (validation_status IN ('discovered', 'testing', 'validated', 'rejected')) DEFAULT 'discovered',
  
  -- Pattern specifics (stored as JSONB)
  conditions JSONB DEFAULT '{}',
  outcomes JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '{}',
  
  CONSTRAINT valid_confidence_dp CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT valid_impact CHECK (impact_score >= -1 AND impact_score <= 5)
);

-- Prediction Errors Table
CREATE TABLE IF NOT EXISTS prediction_errors (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  prediction_type TEXT CHECK (prediction_type IN ('engagement_rate', 'viral_potential', 'follower_growth', 'optimal_timing')) NOT NULL,
  predicted_value REAL NOT NULL,
  actual_value REAL NOT NULL,
  error_magnitude REAL NOT NULL DEFAULT 0,
  error_direction TEXT CHECK (error_direction IN ('overestimate', 'underestimate')) NOT NULL,
  
  -- Context that led to the prediction (stored as JSONB)
  prediction_context JSONB DEFAULT '{}',
  
  -- Analysis of why the prediction was wrong (stored as JSONB)
  error_analysis JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  learned_from BOOLEAN DEFAULT FALSE
);

-- Learning Adjustments Table
CREATE TABLE IF NOT EXISTS learning_adjustments (
  id TEXT PRIMARY KEY,
  adjustment_type TEXT CHECK (adjustment_type IN ('feature_weight', 'new_feature', 'model_parameter', 'prediction_logic')) NOT NULL,
  target_component TEXT NOT NULL,
  adjustment_description TEXT NOT NULL,
  expected_improvement REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  
  -- What errors led to this adjustment
  source_errors JSONB DEFAULT '[]', -- Array of PredictionError IDs
  
  -- Implementation details (stored as JSONB)
  implementation JSONB DEFAULT '{}',
  
  applied_at TIMESTAMPTZ,
  validation_results JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_confidence_la CHECK (confidence >= 0 AND confidence <= 1)
);

-- Prediction Contexts Table (stores prediction context for later comparison)
CREATE TABLE IF NOT EXISTS prediction_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,
  predicted_metrics JSONB NOT NULL DEFAULT '{}',
  content_metadata JSONB NOT NULL DEFAULT '{}',
  content_data JSONB DEFAULT '{}', -- Store content and posting info for later analysis
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_enhanced_performance_post_id ON enhanced_performance(post_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_performance_topic ON enhanced_performance(topic);
CREATE INDEX IF NOT EXISTS idx_enhanced_performance_format ON enhanced_performance(format);
CREATE INDEX IF NOT EXISTS idx_enhanced_performance_posted_at ON enhanced_performance(posted_at);
CREATE INDEX IF NOT EXISTS idx_enhanced_performance_day_of_week ON enhanced_performance(day_of_week);

CREATE INDEX IF NOT EXISTS idx_content_patterns_type ON content_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_content_patterns_confidence ON content_patterns(confidence_score);

CREATE INDEX IF NOT EXISTS idx_discovered_patterns_type ON discovered_patterns(type);
CREATE INDEX IF NOT EXISTS idx_discovered_patterns_validation ON discovered_patterns(validation_status);
CREATE INDEX IF NOT EXISTS idx_discovered_patterns_confidence ON discovered_patterns(confidence);

CREATE INDEX IF NOT EXISTS idx_prediction_errors_post_id ON prediction_errors(post_id);
CREATE INDEX IF NOT EXISTS idx_prediction_errors_type ON prediction_errors(prediction_type);
CREATE INDEX IF NOT EXISTS idx_prediction_errors_learned ON prediction_errors(learned_from);
CREATE INDEX IF NOT EXISTS idx_prediction_errors_created ON prediction_errors(created_at);

CREATE INDEX IF NOT EXISTS idx_learning_adjustments_type ON learning_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_learning_adjustments_applied ON learning_adjustments(applied_at);
CREATE INDEX IF NOT EXISTS idx_learning_adjustments_confidence ON learning_adjustments(confidence);

CREATE INDEX IF NOT EXISTS idx_prediction_contexts_post_id ON prediction_contexts(post_id);
CREATE INDEX IF NOT EXISTS idx_prediction_contexts_created ON prediction_contexts(created_at);

-- Add helpful comments
COMMENT ON TABLE enhanced_performance IS 'Comprehensive performance tracking for content learning';
COMMENT ON TABLE content_patterns IS 'Discovered patterns in content performance';
COMMENT ON TABLE discovered_patterns IS 'Advanced patterns discovered by the pattern discovery engine';
COMMENT ON TABLE prediction_errors IS 'Track prediction errors for learning and improvement';
COMMENT ON TABLE learning_adjustments IS 'Adjustments to be made based on learning from errors';
COMMENT ON TABLE prediction_contexts IS 'Store prediction context for later performance comparison';

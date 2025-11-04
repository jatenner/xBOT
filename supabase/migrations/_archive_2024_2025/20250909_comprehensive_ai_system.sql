-- Comprehensive AI System Database Schema
-- Supports requirements: AI-driven content, data storage, learning, timing

-- AI Content Generation tracking
CREATE TABLE IF NOT EXISTS ai_content_generation (
  id BIGSERIAL PRIMARY KEY,
  content TEXT[] NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('single', 'thread')),
  hook_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  viral_potential DECIMAL(5,2) NOT NULL DEFAULT 0,
  uniqueness_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  topic_variation TEXT NOT NULL,
  reasoning_chain TEXT[] NOT NULL DEFAULT '{}',
  tweet_ids TEXT[] NOT NULL DEFAULT '{}',
  target_timing TIMESTAMPTZ,
  actual_timing TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  engagement_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real-time engagement tracking
CREATE TABLE IF NOT EXISTS real_time_engagement (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  growth_attribution INTEGER DEFAULT 0
);

-- AI timing optimization data
CREATE TABLE IF NOT EXISTS ai_timing_optimization (
  id BIGSERIAL PRIMARY KEY,
  planned_time TIMESTAMPTZ NOT NULL,
  actual_time TIMESTAMPTZ NOT NULL,
  hour_of_day INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  engagement_score DECIMAL(5,2) DEFAULT 0,
  audience_activity DECIMAL(5,2) DEFAULT 0,
  competition_level DECIMAL(5,2) DEFAULT 0,
  optimal_confidence DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Content uniqueness and deduplication
CREATE TABLE IF NOT EXISTS content_uniqueness (
  id BIGSERIAL PRIMARY KEY,
  content_hash TEXT UNIQUE NOT NULL,
  content_snippet TEXT NOT NULL,
  tweet_id TEXT,
  similarity_score DECIMAL(5,4) DEFAULT 0,
  is_duplicate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI learning patterns
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  performance_score DECIMAL(5,2) DEFAULT 0,
  usage_count INTEGER DEFAULT 1,
  success_rate DECIMAL(5,4) DEFAULT 0,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real reply opportunities and results
CREATE TABLE IF NOT EXISTS real_reply_opportunities (
  id BIGSERIAL PRIMARY KEY,
  target_tweet_id TEXT NOT NULL,
  target_username TEXT NOT NULL,
  target_content TEXT NOT NULL,
  reply_opportunity TEXT NOT NULL,
  engagement_potential DECIMAL(5,2) DEFAULT 0,
  our_reply TEXT,
  reply_tweet_id TEXT,
  reply_engagement JSONB DEFAULT '{}',
  success_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Viral content analysis
CREATE TABLE IF NOT EXISTS viral_content_analysis (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  viral_elements TEXT[] DEFAULT '{}',
  psychological_triggers TEXT[] DEFAULT '{}',
  hook_strategy TEXT,
  viral_score DECIMAL(5,2) DEFAULT 0,
  engagement_velocity DECIMAL(5,2) DEFAULT 0,
  retention_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_content_generation_created_at ON ai_content_generation(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_content_generation_viral_potential ON ai_content_generation(viral_potential DESC);
CREATE INDEX IF NOT EXISTS idx_ai_content_generation_topic_variation ON ai_content_generation(topic_variation);

CREATE INDEX IF NOT EXISTS idx_real_time_engagement_tweet_id ON real_time_engagement(tweet_id);
CREATE INDEX IF NOT EXISTS idx_real_time_engagement_timestamp ON real_time_engagement(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ai_timing_optimization_hour_day ON ai_timing_optimization(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_ai_timing_optimization_engagement ON ai_timing_optimization(engagement_score DESC);

CREATE INDEX IF NOT EXISTS idx_content_uniqueness_hash ON content_uniqueness(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_uniqueness_duplicate ON content_uniqueness(is_duplicate);

CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_type ON ai_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_performance ON ai_learning_patterns(performance_score DESC);

CREATE INDEX IF NOT EXISTS idx_real_reply_opportunities_potential ON real_reply_opportunities(engagement_potential DESC);
CREATE INDEX IF NOT EXISTS idx_real_reply_opportunities_success ON real_reply_opportunities(success_score DESC);

CREATE INDEX IF NOT EXISTS idx_viral_content_analysis_score ON viral_content_analysis(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_viral_content_analysis_type ON viral_content_analysis(content_type);

-- RLS Policies (allow service role access)
ALTER TABLE ai_content_generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_timing_optimization ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_uniqueness ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_reply_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE viral_content_analysis ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY IF NOT EXISTS "Service role access" ON ai_content_generation FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access" ON real_time_engagement FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access" ON ai_timing_optimization FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access" ON content_uniqueness FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access" ON ai_learning_patterns FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access" ON real_reply_opportunities FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "Service role access" ON viral_content_analysis FOR ALL TO service_role USING (true);

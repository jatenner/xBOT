-- 🚀 AUTONOMOUS SYSTEM TABLES
-- Database schema for complete autonomous learning system

-- Monitoring posts
CREATE TABLE IF NOT EXISTS monitored_posts (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'single',
  topic TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quality_score NUMERIC(5,2),
  hook_type TEXT,
  persona TEXT,
  framework TEXT,
  monitoring_started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics by phase (8-phase monitoring)
CREATE TABLE IF NOT EXISTS metrics_by_phase (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  phase TEXT NOT NULL, -- '5min', '15min', '1hour', '3hour', '6hour', '24hour', '3day', '1week'
  likes BIGINT DEFAULT 0,
  retweets BIGINT DEFAULT 0,
  replies BIGINT DEFAULT 0,
  bookmarks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  engagement_rate NUMERIC(8,4) DEFAULT 0,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tweet_id, phase)
);

-- Performance patterns for machine learning
CREATE TABLE IF NOT EXISTS performance_patterns (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  topic TEXT NOT NULL,
  format TEXT NOT NULL,
  posted_hour INTEGER NOT NULL, -- 0-23
  posted_day INTEGER NOT NULL,  -- 0-6 (Sunday=0)
  quality_score NUMERIC(5,2),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Learning insights generated from performance analysis
CREATE TABLE IF NOT EXISTS learning_insights (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  topic TEXT NOT NULL,
  format TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  performance_tier TEXT NOT NULL, -- 'low', 'medium', 'high', 'viral'
  insights TEXT[] DEFAULT ARRAY[]::TEXT[],
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Timing predictions for optimization tracking
CREATE TABLE IF NOT EXISTS timing_predictions (
  id BIGSERIAL PRIMARY KEY,
  prediction_time TIMESTAMPTZ DEFAULT NOW(),
  recommended_time TIMESTAMPTZ NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  reasoning TEXT,
  optimization_score NUMERIC(5,2),
  context JSONB DEFAULT '{}'::jsonb,
  factors JSONB DEFAULT '{}'::jsonb,
  actual_posted_time TIMESTAMPTZ,
  actual_performance NUMERIC(8,4)
);

-- Content fingerprints for uniqueness checking
CREATE TABLE IF NOT EXISTS content_fingerprints (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding JSONB, -- OpenAI embeddings for similarity
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  structure TEXT,
  vocabulary TEXT[] DEFAULT ARRAY[]::TEXT[],
  hook TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topic performance tracking
CREATE TABLE IF NOT EXISTS topic_performance (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  total_posts INTEGER DEFAULT 0,
  total_engagement NUMERIC(10,2) DEFAULT 0,
  average_engagement NUMERIC(8,4) DEFAULT 0,
  best_engagement NUMERIC(8,4) DEFAULT 0,
  last_used TIMESTAMPTZ,
  performance_tier TEXT DEFAULT 'unrated', -- 'low', 'medium', 'high', 'viral'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(topic)
);

-- Timing effectiveness tracking
CREATE TABLE IF NOT EXISTS timing_effectiveness (
  id BIGSERIAL PRIMARY KEY,
  hour_of_day INTEGER NOT NULL, -- 0-23
  day_of_week INTEGER NOT NULL, -- 0-6
  total_posts INTEGER DEFAULT 0,
  total_engagement NUMERIC(10,2) DEFAULT 0,
  average_engagement NUMERIC(8,4) DEFAULT 0,
  success_rate NUMERIC(5,4) DEFAULT 0, -- Percentage of posts with >5% engagement
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hour_of_day, day_of_week)
);

-- Format performance tracking
CREATE TABLE IF NOT EXISTS format_performance (
  id BIGSERIAL PRIMARY KEY,
  format TEXT NOT NULL, -- 'single', 'thread'
  total_posts INTEGER DEFAULT 0,
  total_engagement NUMERIC(10,2) DEFAULT 0,
  average_engagement NUMERIC(8,4) DEFAULT 0,
  best_engagement NUMERIC(8,4) DEFAULT 0,
  effectiveness_score NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(format)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitored_posts_tweet_id ON monitored_posts (tweet_id);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_posted_at ON monitored_posts (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitored_posts_topic ON monitored_posts (topic);

CREATE INDEX IF NOT EXISTS idx_metrics_by_phase_tweet_id ON metrics_by_phase (tweet_id);
CREATE INDEX IF NOT EXISTS idx_metrics_by_phase_phase ON metrics_by_phase (phase);
CREATE INDEX IF NOT EXISTS idx_metrics_by_phase_collected_at ON metrics_by_phase (collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_patterns_topic ON performance_patterns (topic);
CREATE INDEX IF NOT EXISTS idx_performance_patterns_hour_day ON performance_patterns (posted_hour, posted_day);
CREATE INDEX IF NOT EXISTS idx_performance_patterns_timestamp ON performance_patterns (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_learning_insights_topic ON learning_insights (topic);
CREATE INDEX IF NOT EXISTS idx_learning_insights_performance_tier ON learning_insights (performance_tier);
CREATE INDEX IF NOT EXISTS idx_learning_insights_timestamp ON learning_insights (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_timing_predictions_recommended_time ON timing_predictions (recommended_time);
CREATE INDEX IF NOT EXISTS idx_timing_predictions_confidence ON timing_predictions (confidence DESC);

CREATE INDEX IF NOT EXISTS idx_content_fingerprints_created_at ON content_fingerprints (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_performance_topic ON topic_performance (topic);
CREATE INDEX IF NOT EXISTS idx_topic_performance_average_engagement ON topic_performance (average_engagement DESC);

CREATE INDEX IF NOT EXISTS idx_timing_effectiveness_hour_day ON timing_effectiveness (hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timing_effectiveness_average_engagement ON timing_effectiveness (average_engagement DESC);

-- Add RLS policies if needed (adjust based on your security requirements)
-- ALTER TABLE monitored_posts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE metrics_by_phase ENABLE ROW LEVEL SECURITY;
-- (Add appropriate policies for your use case)

-- Comments for documentation
COMMENT ON TABLE monitored_posts IS 'Stores posts being monitored by the autonomous system';
COMMENT ON TABLE metrics_by_phase IS 'Tracks engagement metrics across 8 monitoring phases';
COMMENT ON TABLE performance_patterns IS 'Stores patterns for machine learning optimization';
COMMENT ON TABLE learning_insights IS 'AI-generated insights from performance analysis';
COMMENT ON TABLE timing_predictions IS 'Tracks timing predictions and their accuracy';
COMMENT ON TABLE content_fingerprints IS 'Content fingerprints for uniqueness checking';
COMMENT ON TABLE topic_performance IS 'Aggregated performance data by topic';
COMMENT ON TABLE timing_effectiveness IS 'Effectiveness tracking by time slots';
COMMENT ON TABLE format_performance IS 'Performance comparison between formats';

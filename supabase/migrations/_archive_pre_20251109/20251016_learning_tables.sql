-- Learning System Tables for Attribution and Performance Tracking

-- Post Attribution Table
CREATE TABLE IF NOT EXISTS post_attribution (
  post_id TEXT PRIMARY KEY,
  posted_at TIMESTAMPTZ NOT NULL,
  followers_before INTEGER NOT NULL,
  followers_2h_after INTEGER,
  followers_24h_after INTEGER,
  followers_48h_after INTEGER,
  followers_gained INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,4) DEFAULT 0,
  likes INTEGER DEFAULT 0,
  retweets INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  profile_clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  hook_pattern TEXT,
  topic TEXT,
  generator_used TEXT,
  format TEXT CHECK (format IN ('single', 'thread')),
  viral_score INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_attribution_posted_at ON post_attribution(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_attribution_hook ON post_attribution(hook_pattern);
CREATE INDEX IF NOT EXISTS idx_post_attribution_topic ON post_attribution(topic);

-- Hook Performance Table
CREATE TABLE IF NOT EXISTS hook_performance (
  hook_pattern TEXT PRIMARY KEY,
  times_used INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(5,4) DEFAULT 0,
  avg_followers_per_post NUMERIC(8,2) DEFAULT 0,
  confidence_score NUMERIC(5,4) DEFAULT 0,
  best_performing_post_id TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hook_performance_avg_followers ON hook_performance(avg_followers_per_post DESC);

-- Topic Performance Table
CREATE TABLE IF NOT EXISTS topic_performance (
  topic TEXT PRIMARY KEY,
  posts_count INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(5,4) DEFAULT 0,
  avg_followers_per_post NUMERIC(8,2) DEFAULT 0,
  declining_performance BOOLEAN DEFAULT FALSE,
  last_used TIMESTAMPTZ,
  best_performing_post_id TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_performance_avg_followers ON topic_performance(avg_followers_per_post DESC);
CREATE INDEX IF NOT EXISTS idx_topic_performance_last_used ON topic_performance(last_used DESC);

-- Generator Performance Table
CREATE TABLE IF NOT EXISTS generator_performance (
  generator TEXT PRIMARY KEY,
  posts_count INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  avg_engagement_rate NUMERIC(5,4) DEFAULT 0,
  avg_followers_per_post NUMERIC(8,2) DEFAULT 0,
  best_for_topics TEXT[], -- Array of topics this generator excels at
  best_performing_post_id TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generator_performance_avg_followers ON generator_performance(avg_followers_per_post DESC);

-- Meta Learning Insights Table
CREATE TABLE IF NOT EXISTS meta_insights (
  insight_id TEXT PRIMARY KEY,
  insight_type TEXT NOT NULL, -- 'hook_topic_combo', 'format_timing', 'generator_topic', etc.
  pattern TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  sample_size INTEGER NOT NULL,
  avg_followers_gained NUMERIC(8,2) NOT NULL,
  recommendations TEXT,
  examples TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_validated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_insights_confidence ON meta_insights(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_type ON meta_insights(insight_type);

-- A/B Test Results Table
CREATE TABLE IF NOT EXISTS ab_test_results (
  test_id TEXT PRIMARY KEY,
  hypothesis TEXT NOT NULL,
  variant_a_description TEXT NOT NULL,
  variant_b_description TEXT NOT NULL,
  metric TEXT NOT NULL, -- 'engagement_rate', 'followers_gained', 'profile_clicks'
  variant_a_posts INTEGER DEFAULT 0,
  variant_b_posts INTEGER DEFAULT 0,
  variant_a_avg_result NUMERIC(8,2) DEFAULT 0,
  variant_b_avg_result NUMERIC(8,2) DEFAULT 0,
  winner TEXT, -- 'a', 'b', or 'inconclusive'
  confidence_level NUMERIC(5,4),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'paused')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_test_results(status);

-- Comments
COMMENT ON TABLE post_attribution IS 'Tracks follower growth and engagement attribution for each post';
COMMENT ON TABLE hook_performance IS 'Performance metrics for different hook patterns';
COMMENT ON TABLE topic_performance IS 'Performance metrics for different topics';
COMMENT ON TABLE generator_performance IS 'Performance metrics for each content generator';
COMMENT ON TABLE meta_insights IS 'Cross-pattern insights discovered through analysis';
COMMENT ON TABLE ab_test_results IS 'A/B test experiments and results';


-- Learning System Schema for xBOT
-- Enables AI-driven content optimization based on engagement data

-- Posts table: Track own account performance
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('short', 'medium', 'thread')),
  topic TEXT,
  hook_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  posted_at TIMESTAMP WITH TIME ZONE,
  
  -- Engagement metrics
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0, -- (likes + replies + reposts) / views
  follower_conversion INTEGER DEFAULT 0, -- new followers from this post
  
  -- AI metadata
  embeddings vector(1536), -- OpenAI ada-002 embeddings
  generation_params JSONB, -- prompt variations, temperature, etc.
  
  -- Performance tracking
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  performance_tier TEXT CHECK (performance_tier IN ('top', 'mid', 'low')),
  
  INDEX idx_posts_created_at ON posts (created_at DESC),
  INDEX idx_posts_engagement_rate ON posts (engagement_rate DESC),
  INDEX idx_posts_format ON posts (format),
  INDEX idx_posts_topic ON posts (topic),
  INDEX idx_posts_performance_tier ON posts (performance_tier)
);

-- Peer posts: Learn from high-performing health Twitter accounts
CREATE TABLE IF NOT EXISTS peer_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_handle TEXT NOT NULL,
  tweet_id TEXT UNIQUE NOT NULL,
  text TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('short', 'medium', 'thread')),
  topic TEXT,
  hook_type TEXT,
  
  -- Account context
  account_followers INTEGER,
  account_niche TEXT,
  
  -- Engagement metrics
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  normalized_engagement DECIMAL(5,4) DEFAULT 0, -- engagement_rate / account_followers * 1000000
  
  -- AI metadata
  embeddings vector(1536),
  extracted_patterns JSONB, -- hooks, structures, angles extracted by AI
  
  -- Collection metadata
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_peer_posts_account ON peer_posts (account_handle),
  INDEX idx_peer_posts_normalized_engagement ON peer_posts (normalized_engagement DESC),
  INDEX idx_peer_posts_scraped_at ON peer_posts (scraped_at DESC),
  INDEX idx_peer_posts_topic ON peer_posts (topic)
);

-- Patterns: Track what works and what doesn't
CREATE TABLE IF NOT EXISTS patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('hook', 'format', 'topic', 'structure', 'angle')),
  pattern_name TEXT NOT NULL,
  pattern_description TEXT,
  
  -- Performance tracking
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2) DEFAULT 0, -- 0-1 confidence in this pattern
  
  -- Pattern metadata
  discovered_from TEXT CHECK (discovered_from IN ('own_posts', 'peer_posts', 'manual')),
  example_posts TEXT[], -- array of post IDs that exhibit this pattern
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'testing', 'deprecated')),
  
  UNIQUE(pattern_type, pattern_name),
  INDEX idx_patterns_confidence ON patterns (confidence_score DESC),
  INDEX idx_patterns_type ON patterns (pattern_type),
  INDEX idx_patterns_status ON patterns (status)
);

-- Recommendations: AI-generated content strategy updates
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Strategy recommendations
  amplify_patterns JSONB NOT NULL, -- patterns to use more
  avoid_patterns JSONB NOT NULL, -- patterns to use less
  experiment_patterns JSONB NOT NULL, -- new patterns to try
  
  -- Content mix recommendations
  format_distribution JSONB, -- {"short": 0.4, "medium": 0.3, "thread": 0.3}
  topic_priorities JSONB, -- weighted list of topics to focus on
  
  -- Performance context
  based_on_posts INTEGER, -- number of posts analyzed
  avg_engagement_rate DECIMAL(5,4),
  follower_growth_rate DECIMAL(5,4),
  
  -- Application tracking
  applied_at TIMESTAMP WITH TIME ZONE,
  applied_by TEXT,
  results_measured_at TIMESTAMP WITH TIME ZONE,
  
  INDEX idx_recommendations_generated_at ON recommendations (generated_at DESC)
);

-- Content candidates: Generated but not yet posted
CREATE TABLE IF NOT EXISTS content_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('short', 'medium', 'thread')),
  topic TEXT,
  hook_type TEXT,
  
  -- Generation metadata
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generation_params JSONB,
  prompt_version TEXT,
  
  -- Quality scores
  novelty_score DECIMAL(3,2), -- 0-1, based on similarity to recent posts
  hook_strength_score DECIMAL(3,2), -- 0-1, AI assessment of hook quality
  clarity_score DECIMAL(3,2), -- 0-1, readability and coherence
  overall_score DECIMAL(3,2), -- weighted combination
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'posted')),
  rejected_reason TEXT,
  posted_as_tweet_id TEXT,
  
  -- AI metadata
  embeddings vector(1536),
  
  INDEX idx_candidates_status ON content_candidates (status),
  INDEX idx_candidates_overall_score ON content_candidates (overall_score DESC),
  INDEX idx_candidates_generated_at ON content_candidates (generated_at DESC)
);

-- Enable vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Helper functions for engagement calculations
CREATE OR REPLACE FUNCTION calculate_engagement_rate(likes INT, replies INT, reposts INT, views INT)
RETURNS DECIMAL(5,4) AS $$
BEGIN
  IF views = 0 OR views IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND(((likes + replies + reposts)::DECIMAL / views), 4);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_normalized_engagement(engagement_rate DECIMAL, followers INT)
RETURNS DECIMAL(5,4) AS $$
BEGIN
  IF followers = 0 OR followers IS NULL THEN
    RETURN 0;
  END IF;
  RETURN ROUND((engagement_rate / followers * 1000000), 4);
END;
$$ LANGUAGE plpgsql;

-- Initial seed data for patterns
INSERT INTO patterns (pattern_type, pattern_name, pattern_description, confidence_score, discovered_from) VALUES
('hook', 'contrarian_stat', 'Start with a surprising statistic that contradicts common belief', 0.7, 'manual'),
('hook', 'question_provocative', 'Open with a thought-provoking question', 0.6, 'manual'),
('hook', 'myth_busting', 'Challenge a widely accepted health myth', 0.8, 'manual'),
('format', 'numbered_thread', 'Multi-tweet thread with numbered points', 0.7, 'manual'),
('format', 'story_thread', 'Thread that tells a compelling story or case study', 0.8, 'manual'),
('topic', 'nutrition_myths', 'Content about common nutrition misconceptions', 0.7, 'manual'),
('topic', 'sleep_optimization', 'Evidence-based sleep improvement strategies', 0.6, 'manual'),
('topic', 'exercise_science', 'Latest research on fitness and movement', 0.7, 'manual');

COMMENT ON TABLE posts IS 'Tracks performance of own Twitter posts for learning optimization';
COMMENT ON TABLE peer_posts IS 'High-performing content from other health Twitter accounts';
COMMENT ON TABLE patterns IS 'Content patterns with tracked success/failure rates';
COMMENT ON TABLE recommendations IS 'AI-generated strategy recommendations based on performance data';
COMMENT ON TABLE content_candidates IS 'Generated content awaiting quality vetting and approval';

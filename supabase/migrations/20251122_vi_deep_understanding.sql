-- Migration: VI Deep Understanding System
-- Creates table for storing deep semantic/visual analysis of tweets

CREATE TABLE IF NOT EXISTS vi_deep_understanding (
  tweet_id TEXT PRIMARY KEY,
  
  -- Semantic Understanding (Why it works)
  semantic_analysis JSONB NOT NULL DEFAULT '{}',
  -- Contains: core_message, value_proposition, emotional_triggers, cognitive_hooks,
  --           credibility_signals, novelty_factor, urgency_elements, curiosity_gaps
  
  -- Visual Understanding (How it looks)
  visual_analysis JSONB NOT NULL DEFAULT '{}',
  -- Contains: readability_score, scannability_score, visual_hierarchy, pacing_rhythm,
  --           emphasis_techniques, white_space_usage, visual_flow
  
  -- Essence Extraction (The magic)
  essence_analysis JSONB NOT NULL DEFAULT '{}',
  -- Contains: the_hook, the_payoff, the_magic, the_formula, replicable_elements,
  --           unique_elements, improvement_opportunities
  
  -- Content Intelligence (What works)
  content_intelligence JSONB NOT NULL DEFAULT '{}',
  -- Contains: topic_performance, angle_effectiveness, style_appeal, audience_match,
  --           viral_elements, engagement_drivers, follower_conversion_factors
  
  -- Actionable Insights
  actionable_insights JSONB NOT NULL DEFAULT '{}',
  -- Contains: key_learnings, applicable_patterns, content_recommendations,
  --           formatting_recommendations, timing_insights
  
  -- Performance Data
  performance_data JSONB NOT NULL DEFAULT '{}',
  -- Contains: engagement_rate, impressions, likes, retweets, replies, followers_gained
  
  confidence FLOAT NOT NULL DEFAULT 0.5,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add deep_analyzed flag to vi_collected_tweets
ALTER TABLE vi_collected_tweets
ADD COLUMN IF NOT EXISTS deep_analyzed BOOLEAN NOT NULL DEFAULT false;

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_vi_deep_confidence ON vi_deep_understanding(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_vi_deep_analyzed_at ON vi_deep_understanding(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vi_deep_performance ON vi_deep_understanding((performance_data->>'engagement_rate') DESC);
CREATE INDEX IF NOT EXISTS idx_vi_collected_deep_analyzed ON vi_collected_tweets(deep_analyzed) WHERE deep_analyzed = false;

-- GIN indexes for JSONB searches
CREATE INDEX IF NOT EXISTS idx_vi_deep_semantic ON vi_deep_understanding USING GIN(semantic_analysis);
CREATE INDEX IF NOT EXISTS idx_vi_deep_essence ON vi_deep_understanding USING GIN(essence_analysis);
CREATE INDEX IF NOT EXISTS idx_vi_deep_content ON vi_deep_understanding USING GIN(content_intelligence);
CREATE INDEX IF NOT EXISTS idx_vi_deep_insights ON vi_deep_understanding USING GIN(actionable_insights);

-- Comments for documentation
COMMENT ON TABLE vi_deep_understanding IS 'Deep semantic and visual analysis of successful tweets - goes beyond structure to understand essence';
COMMENT ON COLUMN vi_deep_understanding.semantic_analysis IS 'Why the tweet works (core message, emotions, hooks, credibility)';
COMMENT ON COLUMN vi_deep_understanding.visual_analysis IS 'How the tweet looks (readability, hierarchy, pacing, flow)';
COMMENT ON COLUMN vi_deep_understanding.essence_analysis IS 'The magic element that makes it special (hook, payoff, formula)';
COMMENT ON COLUMN vi_deep_understanding.content_intelligence IS 'What content patterns work (topics, angles, styles, audiences)';
COMMENT ON COLUMN vi_deep_understanding.actionable_insights IS 'What we can learn and apply (patterns, recommendations, learnings)';


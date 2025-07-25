-- 🧠 TWITTER MASTER SYSTEM DATABASE SUPPORT
-- ==========================================
-- Date: 2025-01-24
-- Purpose: Add database support for the new Twitter Master AI System

-- ============================================================================
-- 1. TWITTER INTELLIGENCE DATA
-- ============================================================================

-- Store Twitter platform intelligence and analysis
CREATE TABLE IF NOT EXISTS twitter_platform_intelligence (
  id SERIAL PRIMARY KEY,
  analysis_date DATE NOT NULL DEFAULT CURRENT_DATE,
  algorithm_behavior TEXT NOT NULL,
  optimal_content_types JSONB DEFAULT '[]',
  competitive_climate TEXT,
  audience_state TEXT,
  opportunity_windows JSONB DEFAULT '[]',
  platform_trends JSONB DEFAULT '[]',
  analysis_confidence INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(analysis_date)
);

-- Store content strategy decisions and performance
CREATE TABLE IF NOT EXISTS content_strategy_decisions (
  id SERIAL PRIMARY KEY,
  decision_type VARCHAR(50) NOT NULL, -- 'short_term', 'medium_term', 'long_term', 'emergency'
  strategy_data JSONB NOT NULL,
  performance_predictions JSONB DEFAULT '{}',
  actual_performance JSONB DEFAULT '{}',
  confidence_score INTEGER DEFAULT 50,
  implementation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. NETWORK AND RELATIONSHIP TRACKING
-- ============================================================================

-- Track strategic Twitter relationships and engagements
CREATE TABLE IF NOT EXISTS twitter_relationships (
  id SERIAL PRIMARY KEY,
  twitter_username VARCHAR(100) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL, -- 'influencer', 'peer', 'collaborator', 'competitor'
  follower_count INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  niche VARCHAR(100),
  influence_score INTEGER DEFAULT 0,
  accessibility VARCHAR(10) DEFAULT 'medium', -- 'high', 'medium', 'low'
  last_engagement_date TIMESTAMPTZ,
  engagement_count INTEGER DEFAULT 0,
  relationship_value_score INTEGER DEFAULT 50,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(twitter_username)
);

-- Track strategic engagements and their outcomes
CREATE TABLE IF NOT EXISTS strategic_engagements (
  id SERIAL PRIMARY KEY,
  target_username VARCHAR(100) NOT NULL,
  engagement_type VARCHAR(50) NOT NULL, -- 'reply', 'like', 'retweet', 'follow', 'mention'
  content TEXT,
  strategic_value INTEGER DEFAULT 50,
  expected_reach INTEGER DEFAULT 0,
  actual_reach INTEGER DEFAULT 0,
  relationship_impact TEXT,
  success_metrics JSONB DEFAULT '{}',
  outcome_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. GROWTH AND PERFORMANCE TRACKING
-- ============================================================================

-- Enhanced follower growth tracking
CREATE TABLE IF NOT EXISTS follower_growth_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  follower_count INTEGER NOT NULL,
  follower_change INTEGER DEFAULT 0,
  growth_source VARCHAR(50), -- 'content', 'engagement', 'viral', 'network'
  growth_tactics JSONB DEFAULT '[]',
  content_performance JSONB DEFAULT '{}',
  engagement_quality DECIMAL(5,2) DEFAULT 0,
  growth_quality_score INTEGER DEFAULT 50,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

-- Track content performance for learning
CREATE TABLE IF NOT EXISTS content_performance_learning (
  id SERIAL PRIMARY KEY,
  tweet_id VARCHAR(50) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  content_category VARCHAR(50),
  predicted_performance JSONB DEFAULT '{}',
  actual_performance JSONB DEFAULT '{}',
  performance_variance JSONB DEFAULT '{}',
  learning_insights JSONB DEFAULT '[]',
  optimization_suggestions JSONB DEFAULT '[]',
  master_decision_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tweet_id)
);

-- ============================================================================
-- 4. MASTER SYSTEM DECISIONS AND LOGS
-- ============================================================================

-- Log all Twitter Master System decisions
CREATE TABLE IF NOT EXISTS twitter_master_decisions (
  id SERIAL PRIMARY KEY,
  situation_context JSONB NOT NULL,
  decision_type VARCHAR(50) NOT NULL, -- 'post_content', 'strategic_engagement', 'network_building', etc.
  decision_content TEXT,
  reasoning TEXT NOT NULL,
  confidence_score INTEGER NOT NULL,
  expected_impact JSONB DEFAULT '{}',
  execution_plan JSONB DEFAULT '[]',
  success_metrics JSONB DEFAULT '[]',
  actual_results JSONB DEFAULT '{}',
  decision_quality_score INTEGER DEFAULT 0,
  learning_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track trending topics and opportunities
CREATE TABLE IF NOT EXISTS trending_opportunities (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  momentum VARCHAR(20) DEFAULT 'rising', -- 'rising', 'peak', 'declining'
  health_relevance INTEGER DEFAULT 0,
  opportunity_score INTEGER DEFAULT 0,
  entry_strategy TEXT,
  content_angles JSONB DEFAULT '[]',
  competition_level VARCHAR(20) DEFAULT 'medium',
  time_window_start TIMESTAMPTZ DEFAULT NOW(),
  time_window_end TIMESTAMPTZ,
  capitalized BOOLEAN DEFAULT FALSE,
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SYSTEM CONFIGURATION AND STATE
-- ============================================================================

-- Store Twitter Master System configuration
CREATE TABLE IF NOT EXISTS twitter_master_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  config_type VARCHAR(50) DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
  description TEXT,
  last_updated_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track system state and health
CREATE TABLE IF NOT EXISTS system_health_status (
  id SERIAL PRIMARY KEY,
  component_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'optimal', 'good', 'degraded', 'critical'
  readiness_score INTEGER DEFAULT 0,
  last_check TIMESTAMPTZ DEFAULT NOW(),
  health_data JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  alerts JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(component_name)
);

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Intelligence and analytics indexes
CREATE INDEX IF NOT EXISTS idx_platform_intelligence_date ON twitter_platform_intelligence(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_content_strategy_type_status ON content_strategy_decisions(decision_type, implementation_status);
CREATE INDEX IF NOT EXISTS idx_content_strategy_created ON content_strategy_decisions(created_at DESC);

-- Relationship and engagement indexes
CREATE INDEX IF NOT EXISTS idx_relationships_type_score ON twitter_relationships(relationship_type, relationship_value_score DESC);
CREATE INDEX IF NOT EXISTS idx_relationships_last_engagement ON twitter_relationships(last_engagement_date DESC);
CREATE INDEX IF NOT EXISTS idx_strategic_engagements_target ON strategic_engagements(target_username);
CREATE INDEX IF NOT EXISTS idx_strategic_engagements_type ON strategic_engagements(engagement_type);
CREATE INDEX IF NOT EXISTS idx_strategic_engagements_created ON strategic_engagements(created_at DESC);

-- Growth and performance indexes
CREATE INDEX IF NOT EXISTS idx_follower_growth_date ON follower_growth_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_follower_growth_source ON follower_growth_analytics(growth_source);
CREATE INDEX IF NOT EXISTS idx_content_performance_tweet ON content_performance_learning(tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_performance_type ON content_performance_learning(content_type);
CREATE INDEX IF NOT EXISTS idx_content_performance_created ON content_performance_learning(created_at DESC);

-- Decision and opportunity indexes
CREATE INDEX IF NOT EXISTS idx_master_decisions_type ON twitter_master_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_master_decisions_confidence ON twitter_master_decisions(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_master_decisions_created ON twitter_master_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_opportunities_momentum ON trending_opportunities(momentum);
CREATE INDEX IF NOT EXISTS idx_trending_opportunities_score ON trending_opportunities(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_opportunities_capitalized ON trending_opportunities(capitalized);

-- System status indexes
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health_status(component_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health_status(status);
CREATE INDEX IF NOT EXISTS idx_system_health_check ON system_health_status(last_check DESC);

-- ============================================================================
-- 7. INITIAL CONFIGURATION
-- ============================================================================

-- Insert default Twitter Master System configuration
INSERT INTO twitter_master_config (config_key, config_value, config_type, description) VALUES
  ('system_enabled', 'true', 'boolean', 'Enable/disable Twitter Master System'),
  ('intelligence_level', 'high', 'string', 'AI intelligence level: low, medium, high, expert'),
  ('growth_goal', 'aggressive', 'string', 'Growth strategy: conservative, moderate, aggressive'),
  ('content_strategy', 'viral_value_mix', 'string', 'Content strategy approach'),
  ('engagement_budget_daily', '100', 'number', 'Daily engagement budget (likes/follows)'),
  ('decision_confidence_threshold', '70', 'number', 'Minimum confidence score for auto-execution'),
  ('learning_mode', 'active', 'string', 'Learning mode: passive, active, aggressive'),
  ('safety_level', 'high', 'string', 'Safety level: medium, high, maximum')
ON CONFLICT (config_key) DO UPDATE SET 
  config_value = EXCLUDED.config_value,
  updated_at = NOW();

-- Initialize system health components
INSERT INTO system_health_status (component_name, status, readiness_score) VALUES
  ('twitter_platform_intelligence', 'optimal', 95),
  ('content_strategy_master', 'optimal', 95),
  ('network_intelligence', 'optimal', 95),
  ('growth_intelligence', 'optimal', 95),
  ('trend_monitor', 'optimal', 90),
  ('competitor_intelligence', 'optimal', 90),
  ('boundary_safety', 'optimal', 100),
  ('guru_decision_engine', 'optimal', 95)
ON CONFLICT (component_name) DO UPDATE SET 
  status = EXCLUDED.status,
  readiness_score = EXCLUDED.readiness_score,
  last_check = NOW();

-- Log the migration
INSERT INTO system_logs (action, data, source) VALUES
  ('twitter_master_system_tables_created', 
   '{"migration": "20250124_twitter_master_system_tables", "tables_added": 8, "indexes_added": 20, "configs_added": 8}', 
   'migration_script')
ON CONFLICT DO NOTHING; 
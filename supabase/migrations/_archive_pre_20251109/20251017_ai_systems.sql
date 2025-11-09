-- AI Systems Tables

-- Strategy Insights Storage
CREATE TABLE IF NOT EXISTS ai_strategy_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  insights JSONB NOT NULL,
  strategies_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_strategy_insights_discovered ON ai_strategy_insights(discovered_at DESC);

COMMENT ON TABLE ai_strategy_insights IS 'Stores AI-discovered follower acquisition strategies';

-- AI Discovered Targets
CREATE TABLE IF NOT EXISTS ai_discovered_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT UNIQUE NOT NULL,
  username TEXT,
  followers INTEGER DEFAULT 0,
  topic_overlap TEXT[],
  why_target TEXT,
  reply_strategy TEXT,
  conversion_potential NUMERIC(3,2) DEFAULT 0.5,
  priority TEXT DEFAULT 'medium',
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Performance tracking
  times_replied INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  total_followers_gained INTEGER DEFAULT 0,
  actual_conversion_rate NUMERIC(5,2) DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_targets_priority ON ai_discovered_targets(priority, conversion_potential DESC);
CREATE INDEX IF NOT EXISTS idx_ai_targets_handle ON ai_discovered_targets(handle);

COMMENT ON TABLE ai_discovered_targets IS 'AI-discovered optimal accounts to engage with';

-- AI System Runs Log
CREATE TABLE IF NOT EXISTS ai_system_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name TEXT NOT NULL,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds NUMERIC(8,2),
  estimated_cost NUMERIC(8,4),
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  results_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_ai_system_runs_system ON ai_system_runs(system_name, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_system_runs_date ON ai_system_runs(run_at DESC);

COMMENT ON TABLE ai_system_runs IS 'Tracks AI system executions for monitoring and budgeting';


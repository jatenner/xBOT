-- AI Control Plane + Cost-Aware Operation Migration
-- Creates tables for LLM usage logging, control plane state, and AI judge decisions

-- ============================================================
-- 1) LLM USAGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model TEXT NOT NULL, -- e.g., 'gpt-4o-mini', 'gpt-4o'
  purpose TEXT NOT NULL, -- e.g., 'target_judge', 'reply_generation', 'control_plane'
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  est_cost_usd NUMERIC(10, 6) NOT NULL, -- Estimated cost in USD
  latency_ms INTEGER, -- Request latency in milliseconds
  trace_ids JSONB, -- { candidate_id, decision_id, permit_id, feed_run_id, etc. }
  request_metadata JSONB, -- Additional request context
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_timestamp ON llm_usage_log(timestamp DESC);
CREATE INDEX idx_llm_usage_purpose ON llm_usage_log(purpose);
CREATE INDEX idx_llm_usage_trace_ids ON llm_usage_log USING GIN(trace_ids);

-- Hourly cost rollup
CREATE TABLE IF NOT EXISTS llm_cost_summary_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_start TIMESTAMPTZ NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hour_start, model, purpose)
);

CREATE INDEX idx_llm_cost_hourly_start ON llm_cost_summary_hourly(hour_start DESC);

-- Daily cost rollup
CREATE TABLE IF NOT EXISTS llm_cost_summary_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_start DATE NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date_start, model, purpose)
);

CREATE INDEX idx_llm_cost_daily_start ON llm_cost_summary_daily(date_start DESC);

-- ============================================================
-- 2) CONTROL PLANE STATE
-- ============================================================
CREATE TABLE IF NOT EXISTS control_plane_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = current active state
  
  -- Feed weights (normalized 0-1, sum to 1.0)
  feed_weights JSONB NOT NULL DEFAULT '{"curated_accounts": 0.5, "keyword_search": 0.3, "viral_watcher": 0.2}'::jsonb,
  
  -- Acceptance threshold (0-1, replaces rigid topic threshold)
  acceptance_threshold NUMERIC(3, 2) NOT NULL DEFAULT 0.60,
  
  -- Exploration rate (0-1, probability of trying lower-scored candidates)
  exploration_rate NUMERIC(3, 2) NOT NULL DEFAULT 0.10,
  
  -- Shortlist size (max candidates to queue)
  shortlist_size INTEGER NOT NULL DEFAULT 25,
  
  -- Budget caps (USD)
  budget_caps JSONB NOT NULL DEFAULT '{"hourly_max": 5.00, "daily_max": 50.00, "per_reply_max": 0.10}'::jsonb,
  
  -- Model selection (cheaper models when near budget cap)
  model_preferences JSONB NOT NULL DEFAULT '{"default": "gpt-4o-mini", "fallback": "gpt-4o-mini"}'::jsonb,
  
  -- Metadata
  updated_by TEXT NOT NULL DEFAULT 'control_plane_agent',
  update_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_control_plane_effective ON control_plane_state(effective_at DESC);
CREATE INDEX idx_control_plane_active ON control_plane_state(expires_at) WHERE expires_at IS NULL;

-- Control plane decisions log
CREATE TABLE IF NOT EXISTS control_plane_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL, -- 'hourly_adjustment', 'daily_strategy_update', 'budget_alert', etc.
  decision_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  input_data JSONB, -- Summary data that informed the decision
  output_state JSONB, -- New state values
  reasoning TEXT, -- Why this decision was made
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_control_decisions_time ON control_plane_decisions(decision_time DESC);
CREATE INDEX idx_control_decisions_type ON control_plane_decisions(decision_type);

-- ============================================================
-- 3) EXTEND CANDIDATE_EVALUATIONS FOR AI JUDGE
-- ============================================================
ALTER TABLE candidate_evaluations 
ADD COLUMN IF NOT EXISTS ai_judge_decision JSONB,
ADD COLUMN IF NOT EXISTS judge_relevance NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS judge_replyability NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS judge_momentum NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS judge_audience_fit NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS judge_spam_risk NUMERIC(3, 2),
ADD COLUMN IF NOT EXISTS judge_expected_views_bucket TEXT, -- 'low', 'medium', 'high', 'viral'
ADD COLUMN IF NOT EXISTS judge_decision TEXT, -- 'accept', 'reject', 'explore'
ADD COLUMN IF NOT EXISTS judge_reasons TEXT;

CREATE INDEX idx_candidate_judge_decision ON candidate_evaluations(judge_decision);
CREATE INDEX idx_candidate_judge_relevance ON candidate_evaluations(judge_relevance);

-- ============================================================
-- 4) FUNCTIONS FOR COST ROLLUPS
-- ============================================================

-- Function to calculate LLM cost based on model and tokens
CREATE OR REPLACE FUNCTION calculate_llm_cost(
  model_name TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER
) RETURNS NUMERIC(10, 6) AS $$
DECLARE
  input_cost_per_1k NUMERIC;
  output_cost_per_1k NUMERIC;
BEGIN
  -- Pricing as of Jan 2025 (update as needed)
  CASE model_name
    WHEN 'gpt-4o-mini' THEN
      input_cost_per_1k := 0.15 / 1000; -- $0.15 per 1M input tokens
      output_cost_per_1k := 0.60 / 1000; -- $0.60 per 1M output tokens
    WHEN 'gpt-4o' THEN
      input_cost_per_1k := 2.50 / 1000; -- $2.50 per 1M input tokens
      output_cost_per_1k := 10.00 / 1000; -- $10.00 per 1M output tokens
    ELSE
      -- Default to gpt-4o-mini pricing
      input_cost_per_1k := 0.15 / 1000;
      output_cost_per_1k := 0.60 / 1000;
  END CASE;
  
  RETURN (input_tokens * input_cost_per_1k) + (output_tokens * output_cost_per_1k);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to rollup hourly costs
CREATE OR REPLACE FUNCTION rollup_llm_costs_hourly(target_hour TIMESTAMPTZ DEFAULT DATE_TRUNC('hour', NOW()))
RETURNS void AS $$
BEGIN
  INSERT INTO llm_cost_summary_hourly (
    hour_start,
    model,
    purpose,
    total_requests,
    total_input_tokens,
    total_output_tokens,
    total_cost_usd,
    avg_latency_ms
  )
  SELECT
    DATE_TRUNC('hour', timestamp) as hour_start,
    model,
    purpose,
    COUNT(*) as total_requests,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(est_cost_usd) as total_cost_usd,
    AVG(latency_ms) as avg_latency_ms
  FROM llm_usage_log
  WHERE DATE_TRUNC('hour', timestamp) = target_hour
  GROUP BY DATE_TRUNC('hour', timestamp), model, purpose
  ON CONFLICT (hour_start, model, purpose) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    total_input_tokens = EXCLUDED.total_input_tokens,
    total_output_tokens = EXCLUDED.total_output_tokens,
    total_cost_usd = EXCLUDED.total_cost_usd,
    avg_latency_ms = EXCLUDED.avg_latency_ms;
END;
$$ LANGUAGE plpgsql;

-- Function to rollup daily costs
CREATE OR REPLACE FUNCTION rollup_llm_costs_daily(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO llm_cost_summary_daily (
    date_start,
    model,
    purpose,
    total_requests,
    total_input_tokens,
    total_output_tokens,
    total_cost_usd,
    avg_latency_ms
  )
  SELECT
    DATE(timestamp) as date_start,
    model,
    purpose,
    COUNT(*) as total_requests,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(est_cost_usd) as total_cost_usd,
    AVG(latency_ms) as avg_latency_ms
  FROM llm_usage_log
  WHERE DATE(timestamp) = target_date
  GROUP BY DATE(timestamp), model, purpose
  ON CONFLICT (date_start, model, purpose) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    total_input_tokens = EXCLUDED.total_input_tokens,
    total_output_tokens = EXCLUDED.total_output_tokens,
    total_cost_usd = EXCLUDED.total_cost_usd,
    avg_latency_ms = EXCLUDED.avg_latency_ms;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5) VIEWS FOR COST INSPECTION
-- ============================================================

CREATE OR REPLACE VIEW llm_cost_summary_24h AS
SELECT
  purpose,
  model,
  COUNT(*) as requests,
  SUM(total_tokens) as total_tokens,
  SUM(est_cost_usd) as total_cost_usd,
  AVG(latency_ms) as avg_latency_ms
FROM llm_usage_log
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY purpose, model
ORDER BY total_cost_usd DESC;

CREATE OR REPLACE VIEW control_plane_current_state AS
SELECT *
FROM control_plane_state
WHERE expires_at IS NULL
ORDER BY effective_at DESC
LIMIT 1;


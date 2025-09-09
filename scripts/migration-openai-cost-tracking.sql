-- 🎯 OPENAI COST TRACKING MIGRATION
-- Comprehensive tracking of all OpenAI API usage and costs

-- Create the main usage log table
CREATE TABLE IF NOT EXISTS openai_usage_log (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'post_generation',
    'reply_generation', 
    'thread_generation',
    'content_scoring',
    'optimization',
    'learning',
    'other'
  )),
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  actual_cost DECIMAL(10,6),
  request_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  correlation_id TEXT,
  session_id TEXT,
  content_preview TEXT, -- First 100 chars of generated content
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_openai_usage_timestamp ON openai_usage_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_openai_usage_operation_type ON openai_usage_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_openai_usage_model ON openai_usage_log(model);
CREATE INDEX IF NOT EXISTS idx_openai_usage_success ON openai_usage_log(success);
CREATE INDEX IF NOT EXISTS idx_openai_usage_date ON openai_usage_log(DATE(timestamp));
CREATE INDEX IF NOT EXISTS idx_openai_usage_correlation ON openai_usage_log(correlation_id) WHERE correlation_id IS NOT NULL;

-- Create a view for daily cost summaries
CREATE OR REPLACE VIEW openai_daily_cost_summary AS
SELECT 
  DATE(timestamp) as date,
  operation_type,
  model,
  COUNT(*) as request_count,
  SUM(estimated_cost) as total_cost,
  AVG(estimated_cost) as avg_cost_per_request,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(total_tokens) as total_tokens,
  AVG(total_tokens) as avg_tokens_per_request,
  COUNT(*) FILTER (WHERE success = true) as successful_requests,
  COUNT(*) FILTER (WHERE success = false) as failed_requests,
  ROUND((COUNT(*) FILTER (WHERE success = true)::decimal / COUNT(*)) * 100, 2) as success_rate
FROM openai_usage_log
GROUP BY DATE(timestamp), operation_type, model
ORDER BY date DESC, total_cost DESC;

-- Create a view for hourly cost breakdowns  
CREATE OR REPLACE VIEW openai_hourly_cost_breakdown AS
SELECT 
  DATE(timestamp) as date,
  EXTRACT(HOUR FROM timestamp) as hour,
  operation_type,
  COUNT(*) as request_count,
  SUM(estimated_cost) as total_cost,
  AVG(estimated_cost) as avg_cost,
  SUM(total_tokens) as total_tokens
FROM openai_usage_log
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(timestamp), EXTRACT(HOUR FROM timestamp), operation_type
ORDER BY date DESC, hour DESC, total_cost DESC;

-- Create budget tracking table
CREATE TABLE IF NOT EXISTS openai_budget_tracking (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  daily_budget DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  actual_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  over_budget BOOLEAN NOT NULL DEFAULT false,
  emergency_stop_triggered BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for budget tracking
CREATE INDEX IF NOT EXISTS idx_budget_tracking_date ON openai_budget_tracking(date);

-- Create function to update budget tracking automatically
CREATE OR REPLACE FUNCTION update_daily_budget_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO openai_budget_tracking (date, actual_cost, request_count, over_budget)
  SELECT 
    DATE(NEW.timestamp),
    COALESCE(SUM(estimated_cost), 0) + NEW.estimated_cost,
    COUNT(*) + 1,
    (COALESCE(SUM(estimated_cost), 0) + NEW.estimated_cost) > 10.00
  FROM openai_usage_log 
  WHERE DATE(timestamp) = DATE(NEW.timestamp)
  ON CONFLICT (date) 
  DO UPDATE SET
    actual_cost = EXCLUDED.actual_cost,
    request_count = EXCLUDED.request_count, 
    over_budget = EXCLUDED.over_budget,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update budget tracking
DROP TRIGGER IF EXISTS trg_update_budget_tracking ON openai_usage_log;
CREATE TRIGGER trg_update_budget_tracking
  AFTER INSERT ON openai_usage_log
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_budget_tracking();

-- Create cost analysis functions
CREATE OR REPLACE FUNCTION get_cost_per_operation(operation_type_param TEXT, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  operation_type TEXT,
  avg_cost_per_request DECIMAL(10,6),
  total_requests INTEGER,
  total_cost DECIMAL(10,6),
  most_expensive_model TEXT,
  least_expensive_model TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oul.operation_type,
    AVG(oul.estimated_cost)::DECIMAL(10,6) as avg_cost_per_request,
    COUNT(*)::INTEGER as total_requests,
    SUM(oul.estimated_cost)::DECIMAL(10,6) as total_cost,
    (SELECT model FROM openai_usage_log WHERE operation_type = oul.operation_type AND timestamp >= CURRENT_DATE - INTERVAL '%s days' ORDER BY estimated_cost DESC LIMIT 1) as most_expensive_model,
    (SELECT model FROM openai_usage_log WHERE operation_type = oul.operation_type AND timestamp >= CURRENT_DATE - INTERVAL '%s days' ORDER BY estimated_cost ASC LIMIT 1) as least_expensive_model
  FROM openai_usage_log oul
  WHERE oul.operation_type = operation_type_param
    AND oul.timestamp >= CURRENT_DATE - make_interval(days => days_back)
  GROUP BY oul.operation_type;
END;
$$ LANGUAGE plpgsql;

-- Create function to get top cost operations
CREATE OR REPLACE FUNCTION get_top_cost_operations(days_back INTEGER DEFAULT 7, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  operation_type TEXT,
  total_cost DECIMAL(10,6),
  request_count INTEGER,
  avg_cost_per_request DECIMAL(10,6),
  cost_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH total_cost_cte AS (
    SELECT SUM(estimated_cost) as total_system_cost
    FROM openai_usage_log
    WHERE timestamp >= CURRENT_DATE - make_interval(days => days_back)
  )
  SELECT 
    oul.operation_type,
    SUM(oul.estimated_cost)::DECIMAL(10,6) as total_cost,
    COUNT(*)::INTEGER as request_count,
    AVG(oul.estimated_cost)::DECIMAL(10,6) as avg_cost_per_request,
    ROUND((SUM(oul.estimated_cost) / total_cost_cte.total_system_cost * 100)::DECIMAL(5,2), 2) as cost_percentage
  FROM openai_usage_log oul, total_cost_cte
  WHERE oul.timestamp >= CURRENT_DATE - make_interval(days => days_back)
  GROUP BY oul.operation_type, total_cost_cte.total_system_cost
  ORDER BY total_cost DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample budget targets for reference
INSERT INTO openai_budget_tracking (date, daily_budget, notes) VALUES
  (CURRENT_DATE, 10.00, 'Default daily budget limit')
ON CONFLICT (date) DO NOTHING;

-- Create RLS policies if needed
ALTER TABLE openai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE openai_budget_tracking ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role
CREATE POLICY IF NOT EXISTS "Allow service role all operations on openai_usage_log" ON openai_usage_log
  FOR ALL USING (true);

CREATE POLICY IF NOT EXISTS "Allow service role all operations on openai_budget_tracking" ON openai_budget_tracking  
  FOR ALL USING (true);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_openai_usage_recent ON openai_usage_log(timestamp DESC) WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days';
CREATE INDEX IF NOT EXISTS idx_openai_usage_operation_recent ON openai_usage_log(operation_type, timestamp DESC) WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days';

-- Add comments for documentation
COMMENT ON TABLE openai_usage_log IS 'Comprehensive tracking of all OpenAI API usage and costs';
COMMENT ON TABLE openai_budget_tracking IS 'Daily budget tracking and alerting for OpenAI costs';
COMMENT ON VIEW openai_daily_cost_summary IS 'Daily cost summaries by operation type and model';
COMMENT ON VIEW openai_hourly_cost_breakdown IS 'Hourly cost breakdown for recent activity';
COMMENT ON FUNCTION get_cost_per_operation IS 'Get detailed cost analysis for specific operation types';
COMMENT ON FUNCTION get_top_cost_operations IS 'Get the highest cost operations over a specified period';

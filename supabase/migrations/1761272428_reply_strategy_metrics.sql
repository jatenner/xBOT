-- Table for tracking reply strategy performance
CREATE TABLE IF NOT EXISTS reply_strategy_metrics (
  id BIGSERIAL PRIMARY KEY,
  strategy_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance analysis
CREATE INDEX IF NOT EXISTS idx_reply_strategy_metrics_timestamp 
  ON reply_strategy_metrics(timestamp DESC);
  
CREATE INDEX IF NOT EXISTS idx_reply_strategy_metrics_strategy 
  ON reply_strategy_metrics(strategy_name, timestamp DESC);

-- View for strategy success rates
CREATE OR REPLACE VIEW reply_strategy_health AS
SELECT 
  strategy_name,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failures,
  ROUND(100.0 * SUM(CASE WHEN success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
  AVG(CASE WHEN success THEN response_time_ms END) as avg_response_time_ms,
  MAX(CASE WHEN success THEN timestamp END) as last_success,
  COUNT(CASE WHEN timestamp > NOW() - INTERVAL '1 hour' THEN 1 END) as attempts_last_hour
FROM reply_strategy_metrics
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY strategy_name
ORDER BY success_rate DESC;

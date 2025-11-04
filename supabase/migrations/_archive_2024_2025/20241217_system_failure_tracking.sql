-- System Failure Tracking Tables
-- Comprehensive failure tracking and analysis for autonomous system improvement

-- System Failures Log
CREATE TABLE IF NOT EXISTS system_failures (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  system_name VARCHAR(100) NOT NULL,
  failure_type VARCHAR(50) NOT NULL CHECK (failure_type IN ('primary_failure', 'emergency_fallback', 'complete_failure')),
  root_cause VARCHAR(200) NOT NULL,
  emergency_system_used VARCHAR(100),
  attempted_action VARCHAR(200) NOT NULL,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- System Health Metrics (aggregated hourly)
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  system_name VARCHAR(100) NOT NULL,
  hour_window TIMESTAMP WITH TIME ZONE NOT NULL, -- Start of the hour
  total_attempts INTEGER NOT NULL DEFAULT 0,
  successful_attempts INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  emergency_fallbacks INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms INTEGER,
  success_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_attempts > 0 THEN (successful_attempts::DECIMAL / total_attempts) * 100 
      ELSE 0 
    END
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(system_name, hour_window)
);

-- System Improvement Actions (autonomous fixes applied)
CREATE TABLE IF NOT EXISTS system_improvements (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  system_name VARCHAR(100) NOT NULL,
  improvement_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  trigger_pattern VARCHAR(200), -- What failure pattern triggered this
  implementation_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    implementation_status IN ('pending', 'applied', 'failed', 'reverted')
  ),
  effectiveness_score DECIMAL(3,2), -- 0.00 to 1.00
  applied_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_failures_timestamp ON system_failures(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_failures_system_name ON system_failures(system_name);
CREATE INDEX IF NOT EXISTS idx_system_failures_type ON system_failures(failure_type);
CREATE INDEX IF NOT EXISTS idx_system_failures_cause ON system_failures(root_cause);

CREATE INDEX IF NOT EXISTS idx_system_health_timestamp ON system_health_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_health_system_hour ON system_health_metrics(system_name, hour_window);
CREATE INDEX IF NOT EXISTS idx_system_health_success_rate ON system_health_metrics(success_rate);

CREATE INDEX IF NOT EXISTS idx_system_improvements_timestamp ON system_improvements(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_improvements_system ON system_improvements(system_name);
CREATE INDEX IF NOT EXISTS idx_system_improvements_status ON system_improvements(implementation_status);

-- Views for easy analysis
CREATE OR REPLACE VIEW system_failure_summary AS
SELECT 
  system_name,
  COUNT(*) as total_failures,
  COUNT(*) FILTER (WHERE failure_type = 'primary_failure') as primary_failures,
  COUNT(*) FILTER (WHERE failure_type = 'emergency_fallback') as emergency_fallbacks,
  COUNT(*) FILTER (WHERE failure_type = 'complete_failure') as complete_failures,
  COUNT(*) FILTER (WHERE emergency_system_used IS NOT NULL) as emergency_usage_count,
  array_agg(DISTINCT root_cause ORDER BY root_cause) as common_causes,
  MIN(timestamp) as first_failure,
  MAX(timestamp) as last_failure
FROM system_failures 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY system_name
ORDER BY total_failures DESC;

CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT 
  system_name,
  AVG(success_rate) as avg_success_rate,
  SUM(total_attempts) as total_attempts_7d,
  SUM(emergency_fallbacks) as emergency_fallbacks_7d,
  MAX(hour_window) as last_activity,
  CASE 
    WHEN AVG(success_rate) >= 95 THEN 'excellent'
    WHEN AVG(success_rate) >= 80 THEN 'good'
    WHEN AVG(success_rate) >= 60 THEN 'poor'
    ELSE 'critical'
  END as health_status
FROM system_health_metrics 
WHERE hour_window >= NOW() - INTERVAL '7 days'
GROUP BY system_name
ORDER BY avg_success_rate ASC;

-- RLS (Row Level Security) - Enable but allow all for now
ALTER TABLE system_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_improvements ENABLE ROW LEVEL SECURITY;

-- Policies (allow all operations for service role)
CREATE POLICY "Allow all for service role" ON system_failures FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON system_health_metrics FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON system_improvements FOR ALL USING (true);

COMMENT ON TABLE system_failures IS 'Comprehensive tracking of all system failures for analysis and improvement';
COMMENT ON TABLE system_health_metrics IS 'Aggregated hourly metrics for system health monitoring';
COMMENT ON TABLE system_improvements IS 'Track autonomous system improvements and their effectiveness';

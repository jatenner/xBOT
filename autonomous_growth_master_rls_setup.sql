-- 🎯 AUTONOMOUS TWITTER GROWTH MASTER - RLS SETUP (OPTIONAL)
-- Run this if you want to enable Row Level Security
-- NOTE: You may not need RLS if using service role key

-- Enable RLS on all tables
ALTER TABLE follower_growth_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_growth_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_quality_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_growth_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_optimization_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies with unique names
DROP POLICY IF EXISTS "follower_growth_predictions_policy" ON follower_growth_predictions;
CREATE POLICY "follower_growth_predictions_policy" ON follower_growth_predictions
    FOR ALL USING (true);

DROP POLICY IF EXISTS "autonomous_decisions_policy" ON autonomous_decisions;
CREATE POLICY "autonomous_decisions_policy" ON autonomous_decisions
    FOR ALL USING (true);

DROP POLICY IF EXISTS "follower_growth_patterns_policy" ON follower_growth_patterns;
CREATE POLICY "follower_growth_patterns_policy" ON follower_growth_patterns
    FOR ALL USING (true);

DROP POLICY IF EXISTS "content_quality_analysis_policy" ON content_quality_analysis;
CREATE POLICY "content_quality_analysis_policy" ON content_quality_analysis
    FOR ALL USING (true);

DROP POLICY IF EXISTS "follower_tracking_policy" ON follower_tracking;
CREATE POLICY "follower_tracking_policy" ON follower_tracking
    FOR ALL USING (true);

DROP POLICY IF EXISTS "prediction_model_performance_policy" ON prediction_model_performance;
CREATE POLICY "prediction_model_performance_policy" ON prediction_model_performance
    FOR ALL USING (true);

DROP POLICY IF EXISTS "autonomous_growth_strategies_policy" ON autonomous_growth_strategies;
CREATE POLICY "autonomous_growth_strategies_policy" ON autonomous_growth_strategies
    FOR ALL USING (true);

DROP POLICY IF EXISTS "content_optimization_history_policy" ON content_optimization_history;
CREATE POLICY "content_optimization_history_policy" ON content_optimization_history
    FOR ALL USING (true);

DROP POLICY IF EXISTS "system_health_metrics_policy" ON system_health_metrics;
CREATE POLICY "system_health_metrics_policy" ON system_health_metrics
    FOR ALL USING (true);

DROP POLICY IF EXISTS "system_performance_metrics_policy" ON system_performance_metrics;
CREATE POLICY "system_performance_metrics_policy" ON system_performance_metrics
    FOR ALL USING (true);

DROP POLICY IF EXISTS "system_alerts_policy" ON system_alerts;
CREATE POLICY "system_alerts_policy" ON system_alerts
    FOR ALL USING (true); 
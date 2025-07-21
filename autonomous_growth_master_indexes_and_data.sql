-- 🎯 AUTONOMOUS TWITTER GROWTH MASTER - INDEXES AND INITIAL DATA
-- Run this AFTER creating the tables with the main script

-- ===============================================
-- 📊 PERFORMANCE INDEXES
-- ===============================================

-- Follower Growth Predictions
CREATE INDEX IF NOT EXISTS idx_follower_predictions_content_hash ON follower_growth_predictions(content_hash);
CREATE INDEX IF NOT EXISTS idx_follower_predictions_created_at ON follower_growth_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_follower_predictions_accuracy ON follower_growth_predictions(prediction_accuracy);

-- Autonomous Decisions
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_action ON autonomous_decisions(action);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_confidence ON autonomous_decisions(confidence);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_created_at ON autonomous_decisions(created_at);

-- Follower Growth Patterns
CREATE INDEX IF NOT EXISTS idx_growth_patterns_success_rate ON follower_growth_patterns(success_rate);
CREATE INDEX IF NOT EXISTS idx_growth_patterns_active ON follower_growth_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_growth_patterns_avg_followers ON follower_growth_patterns(average_followers_gained);

-- Content Quality Analysis
CREATE INDEX IF NOT EXISTS idx_content_quality_hash ON content_quality_analysis(content_hash);
CREATE INDEX IF NOT EXISTS idx_content_quality_score ON content_quality_analysis(overall_quality);

-- Follower Tracking
CREATE INDEX IF NOT EXISTS idx_follower_tracking_tweet_id ON follower_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_tracking_created_at ON follower_tracking(created_at);

-- System Health Metrics
CREATE INDEX IF NOT EXISTS idx_system_health_recorded_at ON system_health_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_system_health_overall ON system_health_metrics(overall_health);

-- System Performance Metrics
CREATE INDEX IF NOT EXISTS idx_system_performance_recorded_at ON system_performance_metrics(recorded_at);

-- System Alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(alert_severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(is_resolved);

-- ===============================================
-- 🚀 INITIAL DATA SETUP
-- ===============================================

-- Insert default growth strategies
INSERT INTO autonomous_growth_strategies (strategy_name, strategy_type, strategy_config, is_active, priority) VALUES
('Engagement Question Strategy', 'content_generation', '{"focus": "questions", "tone": "engaging", "call_to_action": true}', true, 1),
('Data-Driven Insights', 'content_generation', '{"focus": "statistics", "tone": "informative", "include_numbers": true}', true, 2),
('Controversial Discussion', 'content_generation', '{"focus": "debate", "tone": "thoughtful", "engagement_bait": false}', true, 3),
('Viral Hook Strategy', 'content_generation', '{"focus": "hooks", "tone": "catchy", "viral_elements": true}', true, 4)
ON CONFLICT (strategy_name) DO NOTHING;

-- Insert initial prediction model
INSERT INTO prediction_model_performance (model_type, model_version, model_parameters) VALUES
('follower_growth_predictor', '1.0', '{"algorithm": "neural_network", "features": ["quality_score", "viral_potential", "timing"], "training_size": 0}')
ON CONFLICT DO NOTHING; 
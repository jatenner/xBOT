-- 🚀 FLUENT AUTONOMOUS SYSTEM DATABASE SCHEMA
-- This creates all tables with the correct columns for seamless operation

-- Enhanced autonomous_decisions table with all required columns
CREATE TABLE IF NOT EXISTS autonomous_decisions (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    action VARCHAR(20) DEFAULT 'post' CHECK (action IN ('post', 'improve', 'reject', 'delay')),
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    reasoning JSONB,
    expected_followers INTEGER,
    expected_engagement_rate DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced follower_growth_predictions table
CREATE TABLE IF NOT EXISTS follower_growth_predictions (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    followers_predicted INTEGER DEFAULT 0,
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    viral_score_predicted DECIMAL(5,4) DEFAULT 0.0000,
    quality_score DECIMAL(5,4) DEFAULT 0.0000,
    engagement_rate_predicted DECIMAL(5,4) DEFAULT 0.0000,
    reach_predicted INTEGER DEFAULT 0,
    impact_score DECIMAL(5,4) DEFAULT 0.0000,
    prediction_accuracy DECIMAL(5,4),
    actual_followers_gained INTEGER,
    actual_engagement_rate DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced follower_tracking table with all engagement metrics
CREATE TABLE IF NOT EXISTS follower_tracking (
    id BIGSERIAL PRIMARY KEY,
    tweet_id BIGINT,
    followers_before INTEGER DEFAULT 0,
    followers_after INTEGER DEFAULT 0,
    followers_gained INTEGER GENERATED ALWAYS AS (followers_after - followers_before) STORED,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
    tracked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced prediction_model_performance table
CREATE TABLE IF NOT EXISTS prediction_model_performance (
    id BIGSERIAL PRIMARY KEY,
    model_type VARCHAR(100) NOT NULL,
    accuracy DECIMAL(5,4) DEFAULT 0.0000,
    follower_prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    engagement_prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    viral_score_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    predictions_made INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    total_error DECIMAL(8,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced autonomous_growth_strategies table
CREATE TABLE IF NOT EXISTS autonomous_growth_strategies (
    id BIGSERIAL PRIMARY KEY,
    strategy_name VARCHAR(200) NOT NULL UNIQUE,
    strategy_type VARCHAR(100) NOT NULL,
    strategy_config JSONB,
    is_active BOOLEAN DEFAULT true,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    average_followers_gained DECIMAL(8,2) DEFAULT 0.00,
    average_engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
    times_used INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced system_performance_metrics table
CREATE TABLE IF NOT EXISTS system_performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    tweets_posted_24h INTEGER DEFAULT 0,
    followers_gained_24h INTEGER DEFAULT 0,
    engagement_rate_24h DECIMAL(5,4) DEFAULT 0.0000,
    ai_calls_made_24h INTEGER DEFAULT 0,
    patterns_learned_24h INTEGER DEFAULT 0,
    model_accuracy_improvement DECIMAL(5,4) DEFAULT 0.0000,
    budget_spent_24h DECIMAL(8,2) DEFAULT 0.00,
    system_uptime_hours DECIMAL(8,2) DEFAULT 0.00,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced system_health_metrics table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id BIGSERIAL PRIMARY KEY,
    overall_health VARCHAR(20) DEFAULT 'healthy' CHECK (overall_health IN ('healthy', 'warning', 'critical', 'degraded')),
    autonomous_growth_master_running BOOLEAN DEFAULT false,
    autonomous_growth_master_learning BOOLEAN DEFAULT false,
    prediction_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    database_connected BOOLEAN DEFAULT true,
    consecutive_errors INTEGER DEFAULT 0,
    last_successful_post TIMESTAMP WITH TIME ZONE,
    last_learning_update TIMESTAMP WITH TIME ZONE,
    system_load DECIMAL(5,2) DEFAULT 0.00,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced system_alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,
    alert_severity VARCHAR(20) DEFAULT 'info' CHECK (alert_severity IN ('info', 'warning', 'error', 'critical')),
    alert_message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    auto_recovery_successful BOOLEAN DEFAULT false,
    recovery_attempts INTEGER DEFAULT 0,
    resolution_action TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced content_quality_analysis table
CREATE TABLE IF NOT EXISTS content_quality_analysis (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE,
    quality_score DECIMAL(5,4) DEFAULT 0.0000,
    appeal_score DECIMAL(5,4) DEFAULT 0.0000,
    viral_potential DECIMAL(5,4) DEFAULT 0.0000,
    audience_match DECIMAL(5,4) DEFAULT 0.0000,
    originality_score DECIMAL(5,4) DEFAULT 0.0000,
    engagement_prediction DECIMAL(5,4) DEFAULT 0.0000,
    recommendation VARCHAR(20) DEFAULT 'analyze' CHECK (recommendation IN ('post', 'improve', 'reject', 'analyze')),
    improvement_suggestions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced follower_growth_patterns table
CREATE TABLE IF NOT EXISTS follower_growth_patterns (
    id BIGSERIAL PRIMARY KEY,
    time_period VARCHAR(20) NOT NULL,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    average_followers_gained DECIMAL(8,2) DEFAULT 0.00,
    average_engagement_rate DECIMAL(5,4) DEFAULT 0.0000,
    post_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0000,
    optimal_for_growth BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes for optimal query speed
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_action ON autonomous_decisions(action);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_confidence ON autonomous_decisions(confidence);
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_created_at ON autonomous_decisions(created_at);

CREATE INDEX IF NOT EXISTS idx_follower_predictions_confidence ON follower_growth_predictions(confidence);
CREATE INDEX IF NOT EXISTS idx_follower_predictions_tweet_id ON follower_growth_predictions(tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_predictions_content_hash ON follower_growth_predictions(content_hash);

CREATE INDEX IF NOT EXISTS idx_follower_tracking_tweet_id ON follower_tracking(tweet_id);
CREATE INDEX IF NOT EXISTS idx_follower_tracking_tracked_at ON follower_tracking(tracked_at);

CREATE INDEX IF NOT EXISTS idx_prediction_performance_accuracy ON prediction_model_performance(accuracy);
CREATE INDEX IF NOT EXISTS idx_prediction_performance_model_type ON prediction_model_performance(model_type);

CREATE INDEX IF NOT EXISTS idx_growth_strategies_active ON autonomous_growth_strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_growth_strategies_success_rate ON autonomous_growth_strategies(success_rate);

CREATE INDEX IF NOT EXISTS idx_system_performance_recorded_at ON system_performance_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_system_health_recorded_at ON system_health_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(alert_severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(is_resolved);

CREATE INDEX IF NOT EXISTS idx_content_quality_quality_score ON content_quality_analysis(quality_score);
CREATE INDEX IF NOT EXISTS idx_content_quality_content_hash ON content_quality_analysis(content_hash);

CREATE INDEX IF NOT EXISTS idx_growth_patterns_optimal ON follower_growth_patterns(optimal_for_growth);
CREATE INDEX IF NOT EXISTS idx_growth_patterns_time ON follower_growth_patterns(day_of_week, hour_of_day);

-- Insert initial autonomous growth strategies for immediate operation
INSERT INTO autonomous_growth_strategies (strategy_name, strategy_type, strategy_config, is_active, priority) VALUES
('Engagement Question Strategy', 'content_generation', '{"focus": "questions", "tone": "engaging", "call_to_action": true}', true, 1),
('Insight Sharing Strategy', 'content_generation', '{"focus": "insights", "tone": "expert", "value_proposition": true}', true, 2),
('Problem Solution Strategy', 'content_generation', '{"focus": "solutions", "tone": "helpful", "actionable_advice": true}', true, 3),
('Trending Topic Strategy', 'content_generation', '{"focus": "trends", "tone": "current", "timely_commentary": true}', true, 4),
('Community Building Strategy', 'content_generation', '{"focus": "community", "tone": "inclusive", "conversation_starter": true}', true, 5)
ON CONFLICT (strategy_name) DO NOTHING;

-- Insert initial growth patterns for optimal timing
INSERT INTO follower_growth_patterns (time_period, day_of_week, hour_of_day, average_followers_gained, average_engagement_rate, optimal_for_growth) VALUES
('weekday_morning', 1, 9, 15.5, 0.045, true),
('weekday_lunch', 2, 12, 18.2, 0.052, true),
('weekday_evening', 3, 17, 22.1, 0.061, true),
('weekend_morning', 6, 10, 25.8, 0.068, true),
('weekend_evening', 0, 19, 28.3, 0.074, true)
ON CONFLICT DO NOTHING;

-- Create a function to normalize content for duplicate detection
CREATE OR REPLACE FUNCTION normalize_content(content_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(REGEXP_REPLACE(content_text, '[^a-zA-Z0-9\s]', '', 'g')));
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate content hash
CREATE OR REPLACE FUNCTION generate_content_hash(content_text TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(digest(normalize_content(content_text), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-generate content hashes
CREATE OR REPLACE FUNCTION auto_generate_content_hash()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.content_hash IS NULL AND NEW.content IS NOT NULL THEN
        NEW.content_hash := generate_content_hash(NEW.content);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply auto-hash triggers to relevant tables
CREATE TRIGGER autonomous_decisions_hash_trigger
    BEFORE INSERT OR UPDATE ON autonomous_decisions
    FOR EACH ROW EXECUTE FUNCTION auto_generate_content_hash();

CREATE TRIGGER follower_predictions_hash_trigger
    BEFORE INSERT OR UPDATE ON follower_growth_predictions
    FOR EACH ROW EXECUTE FUNCTION auto_generate_content_hash();

CREATE TRIGGER content_quality_hash_trigger
    BEFORE INSERT OR UPDATE ON content_quality_analysis
    FOR EACH ROW EXECUTE FUNCTION auto_generate_content_hash();

-- Create views for easy data analysis
CREATE OR REPLACE VIEW autonomous_system_dashboard AS
SELECT 
    'System Health' as metric_category,
    COUNT(*) FILTER (WHERE overall_health = 'healthy') as healthy_checks,
    COUNT(*) FILTER (WHERE overall_health != 'healthy') as unhealthy_checks,
    AVG(prediction_accuracy) as avg_prediction_accuracy,
    MAX(recorded_at) as last_health_check
FROM system_health_metrics
WHERE recorded_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'Performance' as metric_category,
    SUM(tweets_posted_24h) as total_tweets,
    SUM(followers_gained_24h) as total_followers_gained,
    AVG(engagement_rate_24h) as avg_engagement_rate,
    MAX(recorded_at) as last_performance_update
FROM system_performance_metrics
WHERE recorded_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'Decision Making' as metric_category,
    COUNT(*) FILTER (WHERE action = 'post') as post_decisions,
    COUNT(*) FILTER (WHERE action != 'post') as other_decisions,
    AVG(confidence) as avg_confidence,
    MAX(created_at) as last_decision
FROM autonomous_decisions
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Grant necessary permissions
ALTER TABLE autonomous_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_growth_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_growth_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_quality_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_growth_patterns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for autonomous operation
CREATE POLICY "autonomous_decisions_policy" ON autonomous_decisions FOR ALL USING (true);
CREATE POLICY "follower_predictions_policy" ON follower_growth_predictions FOR ALL USING (true);
CREATE POLICY "follower_tracking_policy" ON follower_tracking FOR ALL USING (true);
CREATE POLICY "prediction_performance_policy" ON prediction_model_performance FOR ALL USING (true);
CREATE POLICY "growth_strategies_policy" ON autonomous_growth_strategies FOR ALL USING (true);
CREATE POLICY "system_performance_policy" ON system_performance_metrics FOR ALL USING (true);
CREATE POLICY "system_health_policy" ON system_health_metrics FOR ALL USING (true);
CREATE POLICY "system_alerts_policy" ON system_alerts FOR ALL USING (true);
CREATE POLICY "content_quality_policy" ON content_quality_analysis FOR ALL USING (true);
CREATE POLICY "growth_patterns_policy" ON follower_growth_patterns FOR ALL USING (true);

COMMIT; 
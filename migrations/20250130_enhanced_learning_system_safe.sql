-- ===============================================
-- ENHANCED AUTONOMOUS LEARNING SYSTEM MIGRATION (SAFE)
-- Phase 4-9 Implementation: Timing + Content Quality + Engagement + Bandit RL + Budget
-- ===============================================

-- ===============================================
-- PHASE 4: ENHANCED TIMING OPTIMIZATION
-- ===============================================

-- Enhanced timing statistics with simple tracking (no complex Bayesian calculations)
CREATE TABLE IF NOT EXISTS enhanced_timing_stats (
    id BIGSERIAL PRIMARY KEY,
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    total_posts INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_followers_gained INTEGER DEFAULT 0,
    
    -- Simple statistics (avoiding complex calculations)
    success_count INTEGER DEFAULT 0, -- Posts with engagement > threshold
    failure_count INTEGER DEFAULT 0, -- Posts with engagement <= threshold
    confidence_score DECIMAL(4,2) DEFAULT 0.5, -- Simple 0-1 confidence
    
    -- Performance metrics
    avg_engagement_rate DECIMAL(6,4) DEFAULT 0,
    avg_follower_conversion DECIMAL(6,4) DEFAULT 0,
    viral_hit_rate DECIMAL(6,4) DEFAULT 0,
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(hour_of_day, day_of_week)
);

-- Indexes for timing optimization
CREATE INDEX IF NOT EXISTS idx_enhanced_timing_hour ON enhanced_timing_stats (hour_of_day);
CREATE INDEX IF NOT EXISTS idx_enhanced_timing_day ON enhanced_timing_stats (day_of_week);
CREATE INDEX IF NOT EXISTS idx_enhanced_timing_performance ON enhanced_timing_stats (avg_engagement_rate DESC);

-- Optimal posting windows based on historical data
CREATE TABLE IF NOT EXISTS optimal_posting_windows (
    id BIGSERIAL PRIMARY KEY,
    window_start INTEGER NOT NULL CHECK (window_start >= 0 AND window_start <= 23),
    window_end INTEGER NOT NULL CHECK (window_end >= 0 AND window_end <= 23),
    day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'weekend', 'all')),
    confidence_score DECIMAL(4,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    avg_performance DECIMAL(6,4) NOT NULL,
    sample_size INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- PHASE 5: CONTENT QUALITY & SELF-CRITIQUE
-- ===============================================

-- Two-pass content generation tracking
CREATE TABLE IF NOT EXISTS content_generation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL,
    
    -- Draft generation
    draft_content TEXT,
    draft_model TEXT,
    draft_tokens INTEGER,
    draft_cost DECIMAL(6,4), -- Reduced precision
    draft_generation_time_ms INTEGER,
    
    -- Self-critique analysis
    critique_score INTEGER CHECK (critique_score >= 0 AND critique_score <= 100),
    critique_feedback JSONB DEFAULT '{}'::jsonb,
    critique_model TEXT,
    critique_cost DECIMAL(6,4), -- Reduced precision
    
    -- Final content
    final_content TEXT,
    final_model TEXT,
    final_tokens INTEGER,
    final_cost DECIMAL(6,4), -- Reduced precision
    
    -- Quality metrics
    grammar_score INTEGER CHECK (grammar_score >= 0 AND grammar_score <= 100),
    completeness_score INTEGER CHECK (completeness_score >= 0 AND completeness_score <= 100),
    virality_potential INTEGER CHECK (virality_potential >= 0 AND virality_potential <= 100),
    fact_check_status TEXT DEFAULT 'pending' CHECK (fact_check_status IN ('passed', 'failed', 'pending')),
    
    -- Performance tracking
    was_approved BOOLEAN DEFAULT false,
    rejection_reason TEXT,
    regeneration_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced content validation logs
CREATE TABLE IF NOT EXISTS content_validation_logs (
    id BIGSERIAL PRIMARY KEY,
    content_id UUID REFERENCES content_generation_sessions(id),
    validation_type TEXT NOT NULL CHECK (validation_type IN ('grammar', 'fact_check', 'completeness', 'nuclear')),
    validation_score INTEGER CHECK (validation_score >= 0 AND validation_score <= 100),
    validation_result TEXT NOT NULL CHECK (validation_result IN ('passed', 'failed', 'warning')),
    validation_details JSONB DEFAULT '{}'::jsonb,
    model_used TEXT,
    validation_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- PHASE 6: ENGAGEMENT INTELLIGENCE LOOP
-- ===============================================

-- Enhanced engagement tracking with context
CREATE TABLE IF NOT EXISTS intelligent_engagement_actions (
    id BIGSERIAL PRIMARY KEY,
    action_type TEXT NOT NULL CHECK (action_type IN ('like', 'reply', 'follow', 'retweet')),
    target_username TEXT NOT NULL,
    target_tweet_id TEXT,
    target_follower_count INTEGER,
    target_engagement_rate DECIMAL(6,4),
    
    -- Selection reasoning
    selection_algorithm TEXT NOT NULL CHECK (selection_algorithm IN ('random', 'strategic', 'bandit')),
    target_score DECIMAL(4,2), -- 0-99.99
    expected_roi DECIMAL(4,2),
    
    -- Action execution
    action_successful BOOLEAN,
    action_timestamp TIMESTAMPTZ,
    response_received BOOLEAN DEFAULT false,
    
    -- Outcome tracking
    reciprocal_action BOOLEAN DEFAULT false,
    follower_gained BOOLEAN DEFAULT false,
    engagement_value DECIMAL(4,2) DEFAULT 0,
    
    -- Learning data
    hour_of_action INTEGER CHECK (hour_of_action >= 0 AND hour_of_action <= 23),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    budget_utilization DECIMAL(4,2), -- 0-99.99%
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement target selection criteria
CREATE TABLE IF NOT EXISTS engagement_target_criteria (
    id BIGSERIAL PRIMARY KEY,
    criteria_type TEXT NOT NULL CHECK (criteria_type IN ('follower_count', 'engagement_rate', 'topic_relevance', 'timing')),
    min_value DECIMAL(8,2),
    max_value DECIMAL(8,2),
    weight DECIMAL(4,2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 10),
    is_active BOOLEAN DEFAULT true,
    performance_score DECIMAL(4,2) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- PHASE 7: CONTEXTUAL BANDIT / RL SYSTEM
-- ===============================================

-- Contextual features for bandit learning
CREATE TABLE IF NOT EXISTS contextual_features (
    id BIGSERIAL PRIMARY KEY,
    feature_name TEXT NOT NULL UNIQUE,
    feature_type TEXT NOT NULL CHECK (feature_type IN ('categorical', 'numerical', 'binary')),
    possible_values JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contextual bandit arms with feature weights
CREATE TABLE IF NOT EXISTS contextual_bandit_arms (
    id BIGSERIAL PRIMARY KEY,
    arm_name TEXT NOT NULL,
    arm_type TEXT NOT NULL CHECK (arm_type IN ('format', 'timing', 'engagement')),
    
    -- Context features
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Simple performance tracking (no complex linear regression)
    total_selections INTEGER DEFAULT 0,
    total_reward DECIMAL(8,2) DEFAULT 0,
    avg_reward DECIMAL(4,2) DEFAULT 0,
    
    -- Simple bandit parameters
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    confidence_score DECIMAL(4,2) DEFAULT 0.5,
    
    last_selected TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contextual bandit selection history
CREATE TABLE IF NOT EXISTS contextual_bandit_history (
    id BIGSERIAL PRIMARY KEY,
    arm_id BIGINT REFERENCES contextual_bandit_arms(id),
    context_features JSONB NOT NULL,
    predicted_reward DECIMAL(4,2),
    actual_reward DECIMAL(4,2),
    selection_method TEXT NOT NULL CHECK (selection_method IN ('thompson', 'ucb', 'epsilon_greedy')),
    model_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- PHASE 8: BUDGET OPTIMIZATION
-- ===============================================

-- Enhanced budget tracking with ROI analysis
CREATE TABLE IF NOT EXISTS budget_optimization_log (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('content_generation', 'analysis', 'engagement')),
    model_used TEXT NOT NULL,
    tokens_used INTEGER,
    cost_usd DECIMAL(6,4), -- Up to $99.9999
    
    -- ROI calculation
    expected_reward DECIMAL(4,2),
    actual_reward DECIMAL(4,2),
    roi_ratio DECIMAL(6,2), -- Can be negative or very high
    
    -- Context
    budget_utilization_before DECIMAL(4,2),
    budget_utilization_after DECIMAL(4,2),
    time_of_day INTEGER CHECK (time_of_day >= 0 AND time_of_day <= 23),
    was_fallback_model BOOLEAN DEFAULT false,
    
    -- Performance impact
    task_success BOOLEAN,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model performance tracking for smart selection
CREATE TABLE IF NOT EXISTS model_performance_stats (
    id BIGSERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    
    -- Performance metrics
    avg_quality_score DECIMAL(4,2),
    avg_cost_per_task DECIMAL(6,4),
    success_rate DECIMAL(4,2) CHECK (success_rate >= 0 AND success_rate <= 100),
    avg_roi DECIMAL(6,2),
    
    -- Usage statistics
    total_uses INTEGER DEFAULT 0,
    total_cost DECIMAL(8,4) DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Optimization data
    optimal_token_range_min INTEGER,
    optimal_token_range_max INTEGER,
    recommended_budget_threshold DECIMAL(4,2),
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(model_name, task_type)
);

-- ===============================================
-- SIMPLE STORED PROCEDURES (NO COMPLEX MATH)
-- ===============================================

-- Update timing statistics with simple tracking
CREATE OR REPLACE FUNCTION update_enhanced_timing_stats(
    p_hour INTEGER,
    p_day_of_week INTEGER,
    p_engagement INTEGER,
    p_impressions INTEGER DEFAULT 0,
    p_followers_gained INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    success_threshold INTEGER := 10;
    is_success BOOLEAN;
BEGIN
    -- Determine if this was a successful post
    is_success := p_engagement > success_threshold;
    
    -- Insert or update the record
    INSERT INTO enhanced_timing_stats (
        hour_of_day, day_of_week, total_posts, total_engagement, 
        total_impressions, total_followers_gained, success_count, failure_count,
        avg_engagement_rate
    ) VALUES (
        p_hour, p_day_of_week, 1, p_engagement, 
        p_impressions, p_followers_gained,
        CASE WHEN is_success THEN 1 ELSE 0 END,
        CASE WHEN is_success THEN 0 ELSE 1 END,
        p_engagement::DECIMAL
    )
    ON CONFLICT (hour_of_day, day_of_week) DO UPDATE SET
        total_posts = enhanced_timing_stats.total_posts + 1,
        total_engagement = enhanced_timing_stats.total_engagement + p_engagement,
        total_impressions = enhanced_timing_stats.total_impressions + p_impressions,
        total_followers_gained = enhanced_timing_stats.total_followers_gained + p_followers_gained,
        success_count = enhanced_timing_stats.success_count + CASE WHEN is_success THEN 1 ELSE 0 END,
        failure_count = enhanced_timing_stats.failure_count + CASE WHEN is_success THEN 0 ELSE 1 END,
        avg_engagement_rate = (enhanced_timing_stats.total_engagement + p_engagement)::DECIMAL / (enhanced_timing_stats.total_posts + 1),
        confidence_score = CASE 
            WHEN enhanced_timing_stats.total_posts + 1 >= 10 THEN
                LEAST(0.95, (enhanced_timing_stats.success_count + CASE WHEN is_success THEN 1 ELSE 0 END)::DECIMAL / (enhanced_timing_stats.total_posts + 1))
            ELSE 0.5
        END,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Get optimal posting windows
CREATE OR REPLACE FUNCTION get_optimal_posting_windows(
    confidence_threshold DECIMAL(4,2) DEFAULT 0.7
) RETURNS TABLE (
    hour_start INTEGER,
    hour_end INTEGER,
    day_type TEXT,
    confidence DECIMAL(4,2),
    avg_performance DECIMAL(6,4),
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ets.hour_of_day,
        ets.hour_of_day + 1,
        CASE 
            WHEN ets.day_of_week IN (0, 6) THEN 'weekend'
            ELSE 'weekday'
        END,
        ets.confidence_score,
        ets.avg_engagement_rate,
        CASE 
            WHEN ets.avg_engagement_rate > 0.05 THEN 'Highly recommended'
            WHEN ets.avg_engagement_rate > 0.02 THEN 'Recommended'
            ELSE 'Consider for diversity'
        END
    FROM enhanced_timing_stats ets
    WHERE ets.total_posts >= 3
    AND ets.confidence_score >= confidence_threshold
    ORDER BY ets.avg_engagement_rate DESC, ets.confidence_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Update contextual bandit with reward (simplified)
CREATE OR REPLACE FUNCTION update_contextual_bandit(
    p_arm_id BIGINT,
    p_context_features JSONB,
    p_reward DECIMAL(4,2)
) RETURNS VOID AS $$
DECLARE
    is_success BOOLEAN := p_reward > 1.0;
BEGIN
    -- Record the interaction
    INSERT INTO contextual_bandit_history (
        arm_id, context_features, actual_reward, selection_method
    ) VALUES (
        p_arm_id, p_context_features, p_reward, 'thompson'
    );
    
    -- Update arm statistics
    UPDATE contextual_bandit_arms SET
        total_selections = total_selections + 1,
        total_reward = total_reward + p_reward,
        avg_reward = (total_reward + p_reward) / (total_selections + 1),
        success_count = success_count + CASE WHEN is_success THEN 1 ELSE 0 END,
        failure_count = failure_count + CASE WHEN is_success THEN 0 ELSE 1 END,
        confidence_score = CASE 
            WHEN total_selections + 1 >= 10 THEN
                LEAST(0.95, (success_count + CASE WHEN is_success THEN 1 ELSE 0 END)::DECIMAL / (total_selections + 1))
            ELSE 0.5
        END,
        last_selected = NOW()
    WHERE id = p_arm_id;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- INITIAL DATA SETUP
-- ===============================================

-- Insert contextual features
INSERT INTO contextual_features (feature_name, feature_type, possible_values) VALUES
('hour_of_day', 'numerical', '[]'),
('day_of_week', 'categorical', '[0,1,2,3,4,5,6]'),
('content_category', 'categorical', '["health_optimization", "fitness", "nutrition", "mental_health", "supplements"]'),
('format_type', 'categorical', '["data_insight", "how_to", "myth_bust", "personal_story", "question"]'),
('hook_type', 'categorical', '["question", "statement", "statistic", "controversy", "story"]'),
('budget_utilization', 'numerical', '[]'),
('recent_engagement_rate', 'numerical', '[]')
ON CONFLICT (feature_name) DO NOTHING;

-- Insert initial engagement target criteria
INSERT INTO engagement_target_criteria (criteria_type, min_value, max_value, weight) VALUES
('follower_count', 1000, 100000, 0.3),
('engagement_rate', 0.01, 0.15, 0.4),
('topic_relevance', 0.5, 1.0, 0.3)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_generation_sessions_created ON content_generation_sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_content_generation_sessions_approved ON content_generation_sessions (was_approved);
CREATE INDEX IF NOT EXISTS idx_intelligent_engagement_actions_type ON intelligent_engagement_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_intelligent_engagement_actions_timestamp ON intelligent_engagement_actions (action_timestamp);
CREATE INDEX IF NOT EXISTS idx_intelligent_engagement_actions_successful ON intelligent_engagement_actions (action_successful);
CREATE INDEX IF NOT EXISTS idx_contextual_bandit_arms_type ON contextual_bandit_arms (arm_type);
CREATE INDEX IF NOT EXISTS idx_contextual_bandit_history_created ON contextual_bandit_history (created_at);
CREATE INDEX IF NOT EXISTS idx_budget_optimization_log_created ON budget_optimization_log (created_at);
CREATE INDEX IF NOT EXISTS idx_budget_optimization_log_model ON budget_optimization_log (model_used);
CREATE INDEX IF NOT EXISTS idx_model_performance_stats_model ON model_performance_stats (model_name, task_type);

-- Comments for documentation
COMMENT ON TABLE enhanced_timing_stats IS 'Enhanced timing optimization with simple confidence tracking';
COMMENT ON TABLE content_generation_sessions IS 'Two-pass content generation with self-critique tracking';
COMMENT ON TABLE intelligent_engagement_actions IS 'Strategic engagement actions with ROI tracking';
COMMENT ON TABLE contextual_bandit_arms IS 'Simplified contextual bandit for intelligent decision making';
COMMENT ON TABLE budget_optimization_log IS 'Budget optimization with ROI analysis'; 
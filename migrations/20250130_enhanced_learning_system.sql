-- ===============================================
-- ENHANCED AUTONOMOUS LEARNING SYSTEM MIGRATION
-- Phase 4-9 Implementation: Timing + Content Quality + Engagement + Bandit RL + Budget
-- ===============================================

-- ===============================================
-- PHASE 4: ENHANCED TIMING OPTIMIZATION
-- ===============================================

-- Enhanced timing statistics with Bayesian analysis
CREATE TABLE IF NOT EXISTS enhanced_timing_stats (
    id BIGSERIAL PRIMARY KEY,
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    total_posts INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    total_impressions INTEGER DEFAULT 0,
    total_followers_gained INTEGER DEFAULT 0,
    
    -- Bayesian statistics
    alpha_engagement DECIMAL(8,3) DEFAULT 1.0, -- Prior successes + observed successes
    beta_engagement DECIMAL(8,3) DEFAULT 1.0,  -- Prior failures + observed failures
    confidence_interval_lower DECIMAL(6,4) DEFAULT 0,
    confidence_interval_upper DECIMAL(6,4) DEFAULT 1,
    
    -- Performance metrics
    avg_engagement_rate DECIMAL(6,4) DEFAULT 0,
    avg_follower_conversion DECIMAL(6,4) DEFAULT 0,
    viral_hit_rate DECIMAL(6,4) DEFAULT 0, -- Posts that exceeded 2x avg engagement
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for timing optimization
CREATE INDEX IF NOT EXISTS idx_enhanced_timing_hour ON enhanced_timing_stats (hour_of_day);
CREATE INDEX IF NOT EXISTS idx_enhanced_timing_day ON enhanced_timing_stats (day_of_week);
CREATE INDEX IF NOT EXISTS idx_enhanced_timing_performance ON enhanced_timing_stats (avg_engagement_rate DESC);

-- Optimal posting windows based on historical data
CREATE TABLE IF NOT EXISTS optimal_posting_windows (
    id BIGSERIAL PRIMARY KEY,
    window_start INTEGER NOT NULL, -- Hour (0-23)
    window_end INTEGER NOT NULL,   -- Hour (0-23)
    day_type TEXT NOT NULL, -- 'weekday', 'weekend', 'all'
    confidence_score DECIMAL(4,3) NOT NULL,
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
    draft_cost DECIMAL(8,4),
    draft_generation_time_ms INTEGER,
    
    -- Self-critique analysis
    critique_score INTEGER, -- 0-100
    critique_feedback JSONB DEFAULT '{}'::jsonb,
    critique_model TEXT,
    critique_cost DECIMAL(8,4),
    
    -- Final content
    final_content TEXT,
    final_model TEXT,
    final_tokens INTEGER,
    final_cost DECIMAL(8,4),
    
    -- Quality metrics
    grammar_score INTEGER, -- 0-100
    completeness_score INTEGER, -- 0-100
    virality_potential INTEGER, -- 0-100
    fact_check_status TEXT DEFAULT 'pending', -- 'passed', 'failed', 'pending'
    
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
    validation_type TEXT NOT NULL, -- 'grammar', 'fact_check', 'completeness', 'nuclear'
    validation_score INTEGER, -- 0-100
    validation_result TEXT NOT NULL, -- 'passed', 'failed', 'warning'
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
    action_type TEXT NOT NULL, -- 'like', 'reply', 'follow', 'retweet'
    target_username TEXT NOT NULL,
    target_tweet_id TEXT,
    target_follower_count INTEGER,
    target_engagement_rate DECIMAL(6,4),
    
    -- Selection reasoning
    selection_algorithm TEXT NOT NULL, -- 'random', 'strategic', 'bandit'
    target_score DECIMAL(6,4), -- Why this target was selected
    expected_roi DECIMAL(6,4),
    
    -- Action execution
    action_successful BOOLEAN,
    action_timestamp TIMESTAMPTZ,
    response_received BOOLEAN DEFAULT false,
    
    -- Outcome tracking
    reciprocal_action BOOLEAN DEFAULT false, -- Did they engage back?
    follower_gained BOOLEAN DEFAULT false,
    engagement_value DECIMAL(6,4) DEFAULT 0, -- Computed value from response
    
    -- Learning data
    hour_of_action INTEGER,
    day_of_week INTEGER,
    budget_utilization DECIMAL(4,3), -- How much budget was used when this action occurred
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement target selection criteria
CREATE TABLE IF NOT EXISTS engagement_target_criteria (
    id BIGSERIAL PRIMARY KEY,
    criteria_type TEXT NOT NULL, -- 'follower_count', 'engagement_rate', 'topic_relevance', 'timing'
    min_value DECIMAL(8,4),
    max_value DECIMAL(8,4),
    weight DECIMAL(4,3) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    performance_score DECIMAL(6,4) DEFAULT 0, -- How well this criteria performs
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- PHASE 7: CONTEXTUAL BANDIT / RL SYSTEM
-- ===============================================

-- Contextual features for bandit learning
CREATE TABLE IF NOT EXISTS contextual_features (
    id BIGSERIAL PRIMARY KEY,
    feature_name TEXT NOT NULL UNIQUE,
    feature_type TEXT NOT NULL, -- 'categorical', 'numerical', 'binary'
    possible_values JSONB DEFAULT '[]'::jsonb, -- For categorical features
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contextual bandit arms with feature weights
CREATE TABLE IF NOT EXISTS contextual_bandit_arms (
    id BIGSERIAL PRIMARY KEY,
    arm_name TEXT NOT NULL,
    arm_type TEXT NOT NULL, -- 'format', 'timing', 'engagement'
    
    -- Context features
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Bayesian Linear Regression parameters
    feature_weights JSONB DEFAULT '{}'::jsonb, -- {feature_name: weight}
    weight_covariance JSONB DEFAULT '{}'::jsonb, -- Covariance matrix for uncertainty
    
    -- Performance tracking
    total_selections INTEGER DEFAULT 0,
    total_reward DECIMAL(10,4) DEFAULT 0,
    avg_reward DECIMAL(8,4) DEFAULT 0,
    confidence_bound DECIMAL(6,4) DEFAULT 0,
    
    -- Thompson sampling parameters
    alpha_param DECIMAL(8,3) DEFAULT 1.0,
    beta_param DECIMAL(8,3) DEFAULT 1.0,
    
    last_selected TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contextual bandit selection history
CREATE TABLE IF NOT EXISTS contextual_bandit_history (
    id BIGSERIAL PRIMARY KEY,
    arm_id BIGINT REFERENCES contextual_bandit_arms(id),
    context_features JSONB NOT NULL,
    predicted_reward DECIMAL(8,4),
    actual_reward DECIMAL(8,4),
    confidence_interval DECIMAL(6,4),
    selection_method TEXT NOT NULL, -- 'thompson', 'ucb', 'epsilon_greedy'
    model_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- PHASE 8: BUDGET OPTIMIZATION
-- ===============================================

-- Enhanced budget tracking with ROI analysis
CREATE TABLE IF NOT EXISTS budget_optimization_log (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL, -- 'content_generation', 'analysis', 'engagement'
    model_used TEXT NOT NULL,
    tokens_used INTEGER,
    cost_usd DECIMAL(8,6),
    
    -- ROI calculation
    expected_reward DECIMAL(8,4),
    actual_reward DECIMAL(8,4),
    roi_ratio DECIMAL(8,4), -- actual_reward / cost_usd
    
    -- Context
    budget_utilization_before DECIMAL(4,3),
    budget_utilization_after DECIMAL(4,3),
    time_of_day INTEGER,
    was_fallback_model BOOLEAN DEFAULT false,
    
    -- Performance impact
    task_success BOOLEAN,
    quality_score INTEGER, -- 0-100 if applicable
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model performance tracking for smart selection
CREATE TABLE IF NOT EXISTS model_performance_stats (
    id BIGSERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    
    -- Performance metrics
    avg_quality_score DECIMAL(6,4),
    avg_cost_per_task DECIMAL(8,6),
    success_rate DECIMAL(4,3),
    avg_roi DECIMAL(8,4),
    
    -- Usage statistics
    total_uses INTEGER DEFAULT 0,
    total_cost DECIMAL(10,6) DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Optimization data
    optimal_token_range_min INTEGER,
    optimal_token_range_max INTEGER,
    recommended_budget_threshold DECIMAL(6,4),
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- STORED PROCEDURES FOR ENHANCED LEARNING
-- ===============================================

-- Update timing statistics with Bayesian inference
CREATE OR REPLACE FUNCTION update_enhanced_timing_stats(
    p_hour INTEGER,
    p_day_of_week INTEGER,
    p_engagement INTEGER,
    p_impressions INTEGER DEFAULT 0,
    p_followers_gained INTEGER DEFAULT 0
) RETURNS VOID AS $$
DECLARE
    current_stats RECORD;
    new_alpha DECIMAL(8,3);
    new_beta DECIMAL(8,3);
    success_threshold INTEGER := 10; -- Engagement > 10 considered success
BEGIN
    -- Get current stats or create new record
    SELECT * INTO current_stats 
    FROM enhanced_timing_stats 
    WHERE hour_of_day = p_hour AND day_of_week = p_day_of_week;
    
    IF FOUND THEN
        -- Update existing record with Bayesian inference
        IF p_engagement > success_threshold THEN
            new_alpha := current_stats.alpha_engagement + 1;
            new_beta := current_stats.beta_engagement;
        ELSE
            new_alpha := current_stats.alpha_engagement;
            new_beta := current_stats.beta_engagement + 1;
        END IF;
        
        UPDATE enhanced_timing_stats SET
            total_posts = total_posts + 1,
            total_engagement = total_engagement + p_engagement,
            total_impressions = total_impressions + p_impressions,
            total_followers_gained = total_followers_gained + p_followers_gained,
            alpha_engagement = new_alpha,
            beta_engagement = new_beta,
            avg_engagement_rate = CASE 
                WHEN total_posts + 1 > 0 THEN (total_engagement + p_engagement)::DECIMAL / (total_posts + 1)
                ELSE 0 
            END,
            confidence_interval_lower = new_alpha / (new_alpha + new_beta + 1.96 * SQRT(new_alpha * new_beta / ((new_alpha + new_beta)^2 * (new_alpha + new_beta + 1)))),
            confidence_interval_upper = new_alpha / (new_alpha + new_beta - 1.96 * SQRT(new_alpha * new_beta / ((new_alpha + new_beta)^2 * (new_alpha + new_beta + 1)))),
            last_updated = NOW()
        WHERE hour_of_day = p_hour AND day_of_week = p_day_of_week;
    ELSE
        -- Create new record
        INSERT INTO enhanced_timing_stats (
            hour_of_day, day_of_week, total_posts, total_engagement, 
            total_impressions, total_followers_gained, alpha_engagement, beta_engagement
        ) VALUES (
            p_hour, p_day_of_week, 1, p_engagement, 
            p_impressions, p_followers_gained, 
            CASE WHEN p_engagement > success_threshold THEN 2 ELSE 1 END,
            CASE WHEN p_engagement > success_threshold THEN 1 ELSE 2 END
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get optimal posting windows with confidence intervals
CREATE OR REPLACE FUNCTION get_optimal_posting_windows(
    confidence_threshold DECIMAL(4,3) DEFAULT 0.8
) RETURNS TABLE (
    hour_start INTEGER,
    hour_end INTEGER,
    day_type TEXT,
    confidence DECIMAL(4,3),
    avg_performance DECIMAL(6,4),
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH hourly_performance AS (
        SELECT 
            hour_of_day,
            AVG(avg_engagement_rate) as performance,
            AVG((confidence_interval_upper + confidence_interval_lower) / 2) as confidence,
            SUM(total_posts) as sample_size,
            CASE 
                WHEN day_of_week IN (0, 6) THEN 'weekend'
                ELSE 'weekday'
            END as period_type
        FROM enhanced_timing_stats
        WHERE total_posts >= 3  -- Minimum sample size
        GROUP BY hour_of_day, period_type
        HAVING AVG((confidence_interval_upper + confidence_interval_lower) / 2) >= confidence_threshold
    )
    SELECT 
        hp.hour_of_day,
        hp.hour_of_day + 1,
        hp.period_type,
        hp.confidence,
        hp.performance,
        CASE 
            WHEN hp.performance > 0.05 THEN 'Highly recommended'
            WHEN hp.performance > 0.02 THEN 'Recommended'
            ELSE 'Consider for diversity'
        END
    FROM hourly_performance hp
    ORDER BY hp.performance DESC, hp.confidence DESC;
END;
$$ LANGUAGE plpgsql;

-- Update contextual bandit with reward
CREATE OR REPLACE FUNCTION update_contextual_bandit(
    p_arm_id BIGINT,
    p_context_features JSONB,
    p_reward DECIMAL(8,4)
) RETURNS VOID AS $$
DECLARE
    current_arm RECORD;
BEGIN
    -- Get current arm data
    SELECT * INTO current_arm FROM contextual_bandit_arms WHERE id = p_arm_id;
    
    IF FOUND THEN
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
            alpha_param = CASE 
                WHEN p_reward > 1.0 THEN alpha_param + 1 
                ELSE alpha_param 
            END,
            beta_param = CASE 
                WHEN p_reward <= 1.0 THEN beta_param + 1 
                ELSE beta_param 
            END,
            last_selected = NOW()
        WHERE id = p_arm_id;
    END IF;
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
CREATE INDEX IF NOT EXISTS idx_intelligent_engagement_actions_type ON intelligent_engagement_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_intelligent_engagement_actions_timestamp ON intelligent_engagement_actions (action_timestamp);
CREATE INDEX IF NOT EXISTS idx_contextual_bandit_arms_type ON contextual_bandit_arms (arm_type);
CREATE INDEX IF NOT EXISTS idx_contextual_bandit_history_created ON contextual_bandit_history (created_at);
CREATE INDEX IF NOT EXISTS idx_budget_optimization_log_created ON budget_optimization_log (created_at);
CREATE INDEX IF NOT EXISTS idx_model_performance_stats_model ON model_performance_stats (model_name, task_type);

-- Grant permissions
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO your_bot_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO your_bot_user;

-- Comments for documentation
COMMENT ON TABLE enhanced_timing_stats IS 'Bayesian timing optimization with confidence intervals';
COMMENT ON TABLE content_generation_sessions IS 'Two-pass content generation with self-critique tracking';
COMMENT ON TABLE intelligent_engagement_actions IS 'Strategic engagement actions with ROI tracking';
COMMENT ON TABLE contextual_bandit_arms IS 'Contextual bandit for intelligent decision making';
COMMENT ON TABLE budget_optimization_log IS 'Budget optimization with ROI analysis'; 
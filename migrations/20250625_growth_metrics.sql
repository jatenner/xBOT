-- 📊 GROWTH METRICS MIGRATION
-- ===========================
-- Adds autonomous growth tracking with F/1K optimization

-- Growth metrics table for daily F/1K tracking
CREATE TABLE IF NOT EXISTS growth_metrics (
    day DATE PRIMARY KEY,
    impressions BIGINT DEFAULT 0,
    new_followers INT DEFAULT 0,
    f_per_1k NUMERIC GENERATED ALWAYS AS 
        (CASE WHEN impressions = 0 THEN 0 ELSE new_followers * 1000.0 / impressions END) 
        STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add growth tracking columns to tweets table
ALTER TABLE tweets 
    ADD COLUMN IF NOT EXISTS impressions BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS new_followers INT DEFAULT 0;

-- Convenience function for updating metrics
CREATE OR REPLACE FUNCTION incr_metric(
    metric_day DATE,
    imp BIGINT,
    foll INT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO growth_metrics (day, impressions, new_followers)
    VALUES (metric_day, imp, foll)
    ON CONFLICT (day) 
    DO UPDATE SET 
        impressions = growth_metrics.impressions + EXCLUDED.impressions,
        new_followers = growth_metrics.new_followers + EXCLUDED.new_followers,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Follow/unfollow tracking for rate limits
CREATE TABLE IF NOT EXISTS follow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_username VARCHAR(255) NOT NULL,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('follow', 'unfollow')),
    action_date DATE NOT NULL DEFAULT CURRENT_DATE,
    success BOOLEAN DEFAULT FALSE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure we don't duplicate actions on same day
    UNIQUE(target_username, action_type, action_date)
);

-- Performance tracking per content style for ε-greedy learning
CREATE TABLE IF NOT EXISTS style_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    style_name VARCHAR(100) NOT NULL,
    f_per_1k_reward NUMERIC DEFAULT 0,
    sample_count INT DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(style_name)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_growth_metrics_day ON growth_metrics(day);
CREATE INDEX IF NOT EXISTS idx_follow_actions_date ON follow_actions(action_date);
CREATE INDEX IF NOT EXISTS idx_follow_actions_type ON follow_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_style_rewards_updated ON style_rewards(last_updated);

-- Bot config for growth strategy
INSERT INTO bot_config (key, value, description) 
VALUES 
    ('next_style', 'educational', 'Next content style to use (ε-greedy selection)'),
    ('follow_pause', 'false', 'Pause following due to ratio guard'),
    ('competitor_handles', 'healthtechfocus,medtech_news,digitalhealth', 'Competitor handles for follow growth')
ON CONFLICT (key) DO NOTHING; 
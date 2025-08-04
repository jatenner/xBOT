-- 🤝 ENGAGEMENT ACTIONS TABLE
-- Tracks all community engagement activities for analytics and learning
-- Date: 2025-02-03

-- ==================================================================
-- CREATE ENGAGEMENT ACTIONS TRACKING TABLE
-- ==================================================================

CREATE TABLE IF NOT EXISTS engagement_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Action Details
    action_type VARCHAR(20) NOT NULL, -- 'like', 'reply', 'follow', 'retweet'
    target_username VARCHAR(100) NOT NULL,
    target_tweet_id VARCHAR(255), -- Only for likes/replies
    content TEXT, -- For replies
    
    -- Strategy & Analytics
    reasoning TEXT NOT NULL,
    expected_roi DECIMAL(4,3) DEFAULT 0, -- 0-1 scale
    actual_roi DECIMAL(4,3), -- Measured after 24-48 hours
    
    -- Execution Results
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    execution_time_ms INTEGER,
    
    -- Attribution & Learning
    resulted_in_follow BOOLEAN DEFAULT false,
    resulted_in_engagement BOOLEAN DEFAULT false,
    resulted_in_mention BOOLEAN DEFAULT false,
    
    -- Context
    follower_count_before INTEGER,
    follower_count_after INTEGER,
    engagement_context JSONB DEFAULT '{}',
    
    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    measured_at TIMESTAMPTZ -- When ROI was measured
);

-- ==================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==================================================================

CREATE INDEX idx_engagement_actions_type ON engagement_actions(action_type);
CREATE INDEX idx_engagement_actions_target ON engagement_actions(target_username);
CREATE INDEX idx_engagement_actions_created_at ON engagement_actions(created_at);
CREATE INDEX idx_engagement_actions_success ON engagement_actions(success);
CREATE INDEX idx_engagement_actions_roi ON engagement_actions(expected_roi);

-- ==================================================================
-- CREATE ENGAGEMENT SUMMARY VIEW
-- ==================================================================

CREATE OR REPLACE VIEW engagement_summary AS
SELECT 
    DATE(created_at) as engagement_date,
    action_type,
    COUNT(*) as total_actions,
    COUNT(*) FILTER (WHERE success = true) as successful_actions,
    AVG(expected_roi) as avg_expected_roi,
    AVG(actual_roi) FILTER (WHERE actual_roi IS NOT NULL) as avg_actual_roi,
    COUNT(*) FILTER (WHERE resulted_in_follow = true) as resulted_in_follows,
    COUNT(*) FILTER (WHERE resulted_in_engagement = true) as resulted_in_engagement
FROM engagement_actions
GROUP BY DATE(created_at), action_type
ORDER BY engagement_date DESC, action_type;

-- ==================================================================
-- GRANT PERMISSIONS
-- ==================================================================

GRANT ALL ON engagement_actions TO service_role;
GRANT SELECT ON engagement_summary TO service_role;

-- ==================================================================
-- SUCCESS MESSAGE
-- ==================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ ENGAGEMENT ACTIONS TABLE CREATED:';
    RAISE NOTICE '   - engagement_actions table with full tracking';
    RAISE NOTICE '   - Performance indexes created';
    RAISE NOTICE '   - engagement_summary view for analytics';
    RAISE NOTICE '   - Ready for IntelligentCommunityEngagementEngine';
END $$;
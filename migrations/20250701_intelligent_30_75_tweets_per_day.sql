-- ⚡ INTELLIGENT 30-75 TWEETS/DAY SYSTEM MIGRATION
-- Sets up complete database schema for intelligent Twitter bot operation
-- Target: 30-75 tweets/day with 15-minute decision cycles

-- 1. Twitter API Limits Table - Tracks usage and prevents false monthly caps
CREATE TABLE IF NOT EXISTS twitter_api_limits (
    id SERIAL PRIMARY KEY,
    tweets_this_month INTEGER DEFAULT 0,
    monthly_tweet_cap INTEGER DEFAULT 1500,
    daily_posts_count INTEGER DEFAULT 0,
    daily_post_limit INTEGER DEFAULT 75, -- Your target maximum
    reads_this_month INTEGER DEFAULT 0,
    monthly_read_cap INTEGER DEFAULT 50000,
    emergency_monthly_cap_mode BOOLEAN DEFAULT false, -- CRITICAL: Prevent false alarms
    last_daily_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_monthly_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize Twitter API limits for July 2025
INSERT INTO twitter_api_limits (
    id, 
    tweets_this_month, 
    monthly_tweet_cap, 
    daily_posts_count, 
    daily_post_limit,
    reads_this_month,
    monthly_read_cap,
    emergency_monthly_cap_mode,
    last_daily_reset,
    last_monthly_reset,
    last_updated
) VALUES (
    1,
    0, -- Reset for July
    1500, -- Twitter API Free Tier
    0, -- Start fresh today
    75, -- Your target max per day
    0, -- Reset reads
    50000, -- Twitter API read limit
    false, -- DISABLE emergency mode
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    emergency_monthly_cap_mode = false,
    daily_post_limit = 75,
    last_updated = CURRENT_TIMESTAMP;

-- 2. Bot Configuration Table - Controls intelligent posting behavior
CREATE TABLE IF NOT EXISTS bot_configuration (
    id SERIAL PRIMARY KEY,
    strategy VARCHAR(100) DEFAULT 'intelligent_monthly_budget',
    mode VARCHAR(50) DEFAULT 'production',
    auto_posting_enabled BOOLEAN DEFAULT true,
    quality_threshold INTEGER DEFAULT 60, -- Only high-quality content
    posting_interval_minutes INTEGER DEFAULT 15, -- Your requested interval
    max_daily_tweets INTEGER DEFAULT 75, -- Your target range
    min_daily_tweets INTEGER DEFAULT 30,
    baseline_daily_target INTEGER DEFAULT 50, -- Smart middle ground
    emergency_mode BOOLEAN DEFAULT false,
    viral_boost_enabled BOOLEAN DEFAULT true,
    trending_topics_enabled BOOLEAN DEFAULT true,
    engagement_optimization BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize bot configuration for optimal 30-75 tweets/day
INSERT INTO bot_configuration (
    id,
    strategy,
    mode,
    auto_posting_enabled,
    quality_threshold,
    posting_interval_minutes,
    max_daily_tweets,
    min_daily_tweets,
    baseline_daily_target,
    emergency_mode,
    viral_boost_enabled,
    trending_topics_enabled,
    engagement_optimization,
    last_updated
) VALUES (
    1,
    'intelligent_monthly_budget',
    'production',
    true, -- Enable auto-posting
    60, -- Quality threshold
    15, -- Check every 15 minutes as requested
    75, -- Max daily target
    30, -- Min daily target  
    50, -- Baseline (50 tweets/day = 1500/month)
    false, -- Disable emergency mode
    true, -- Enable viral content boost
    true, -- Enable trending topics
    true, -- Enable engagement optimization
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
    auto_posting_enabled = true,
    posting_interval_minutes = 15,
    max_daily_tweets = 75,
    min_daily_tweets = 30,
    baseline_daily_target = 50,
    emergency_mode = false,
    last_updated = CURRENT_TIMESTAMP;

-- 3. Monthly Budget State - Intelligent distribution of 1500 monthly tweets
CREATE TABLE IF NOT EXISTS monthly_budget_state (
    month VARCHAR(7) PRIMARY KEY, -- YYYY-MM format (e.g., '2025-07')
    tweets_used INTEGER DEFAULT 0,
    tweets_budget INTEGER DEFAULT 1500,
    days_remaining INTEGER DEFAULT 30,
    daily_targets JSONB DEFAULT '{}', -- Store daily intelligent targets
    strategic_reserves INTEGER DEFAULT 225, -- 15% for viral opportunities
    performance_multiplier DECIMAL(3,2) DEFAULT 1.00,
    trending_boost DECIMAL(3,2) DEFAULT 1.00,
    engagement_score DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize July 2025 monthly budget
INSERT INTO monthly_budget_state (
    month,
    tweets_used,
    tweets_budget,
    days_remaining,
    daily_targets,
    strategic_reserves,
    performance_multiplier,
    trending_boost,
    engagement_score,
    last_updated
) VALUES (
    '2025-07', -- July 2025
    0, -- Start fresh
    1500, -- Full monthly budget
    31 - EXTRACT(DAY FROM CURRENT_DATE) + 1, -- Days remaining in July
    '{}', -- Empty daily targets (will be calculated)
    225, -- 15% strategic reserve (225 tweets)
    1.00, -- Baseline performance
    1.00, -- No trending boost yet
    0.00, -- No engagement data yet
    CURRENT_TIMESTAMP
) ON CONFLICT (month) DO UPDATE SET
    last_updated = CURRENT_TIMESTAMP;

-- 4. Posting Schedule Intelligence - Optimizes timing
CREATE TABLE IF NOT EXISTS posting_schedule_intelligence (
    id SERIAL PRIMARY KEY,
    hour_of_day INTEGER NOT NULL, -- 0-23
    day_of_week INTEGER NOT NULL, -- 0-6 (Sunday=0)
    optimal_frequency DECIMAL(3,2) DEFAULT 1.00, -- Posts per hour multiplier
    engagement_score DECIMAL(3,2) DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hour_of_day, day_of_week)
);

-- Initialize optimal posting schedule based on research
INSERT INTO posting_schedule_intelligence (hour_of_day, day_of_week, optimal_frequency, engagement_score) VALUES
-- Monday: Research & Industry Updates
(9, 1, 2.5, 0.85),   -- 9 AM Monday: High engagement
(13, 1, 2.0, 0.75),  -- 1 PM Monday: Lunch break
(17, 1, 1.8, 0.70),  -- 5 PM Monday: End of workday

-- Tuesday-Thursday: Peak business days  
(8, 2, 2.2, 0.80), (12, 2, 2.0, 0.75), (16, 2, 1.8, 0.72),
(8, 3, 2.2, 0.80), (12, 3, 2.0, 0.75), (16, 3, 1.8, 0.72),
(8, 4, 2.2, 0.80), (12, 4, 2.0, 0.75), (16, 4, 1.8, 0.72),

-- Friday: Wrap-up content
(9, 5, 2.0, 0.78),   -- 9 AM Friday
(15, 5, 1.5, 0.65),  -- 3 PM Friday: Wind down

-- Weekend: Educational & thought leadership
(10, 6, 1.2, 0.60),  -- Saturday morning
(14, 6, 1.0, 0.55),  -- Saturday afternoon
(10, 0, 1.2, 0.60),  -- Sunday morning
(19, 0, 1.0, 0.55)   -- Sunday evening
ON CONFLICT (hour_of_day, day_of_week) DO NOTHING;

-- 5. Content Quality Tracking - Ensures high standards
CREATE TABLE IF NOT EXISTS content_quality_metrics (
    id SERIAL PRIMARY KEY,
    tweet_id BIGINT REFERENCES tweets(id),
    quality_score INTEGER NOT NULL,
    engagement_prediction DECIMAL(3,2) DEFAULT 0.00,
    viral_potential DECIMAL(3,2) DEFAULT 0.00,
    topic_relevance DECIMAL(3,2) DEFAULT 0.00,
    readability_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Trending Topics Intelligence
CREATE TABLE IF NOT EXISTS trending_topics_intelligence (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(200) NOT NULL,
    relevance_score DECIMAL(3,2) NOT NULL,
    viral_potential DECIMAL(3,2) DEFAULT 0.00,
    trending_duration INTEGER DEFAULT 0, -- Hours trending
    peak_engagement_time TIME,
    active BOOLEAN DEFAULT true,
    source VARCHAR(100), -- 'twitter', 'news', 'research'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 7. Intelligent Decision Log - Track AI decisions every 15 minutes
CREATE TABLE IF NOT EXISTS intelligent_decision_log (
    id SERIAL PRIMARY KEY,
    decision_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decision_type VARCHAR(50) NOT NULL, -- 'post', 'reply', 'like', 'research', 'wait'
    reasoning TEXT,
    context JSONB, -- Store decision context
    daily_posts_so_far INTEGER DEFAULT 0,
    monthly_posts_so_far INTEGER DEFAULT 0,
    quality_threshold_met BOOLEAN DEFAULT false,
    viral_opportunity BOOLEAN DEFAULT false,
    trending_topic_match BOOLEAN DEFAULT false
);

-- 8. Performance Optimization Index
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at);
CREATE INDEX IF NOT EXISTS idx_twitter_api_limits_last_updated ON twitter_api_limits(last_updated);
CREATE INDEX IF NOT EXISTS idx_bot_configuration_last_updated ON bot_configuration(last_updated);
CREATE INDEX IF NOT EXISTS idx_monthly_budget_month ON monthly_budget_state(month);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_time ON posting_schedule_intelligence(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_decision_log_time ON intelligent_decision_log(decision_time);
CREATE INDEX IF NOT EXISTS idx_trending_topics_active ON trending_topics_intelligence(active, relevance_score);

-- 9. Views for Easy Monitoring
CREATE OR REPLACE VIEW current_bot_status AS
SELECT 
    tl.tweets_this_month,
    tl.monthly_tweet_cap,
    tl.daily_posts_count,
    tl.daily_post_limit,
    tl.emergency_monthly_cap_mode,
    bc.strategy,
    bc.posting_interval_minutes,
    bc.max_daily_tweets,
    bc.min_daily_tweets,
    bc.baseline_daily_target,
    bc.auto_posting_enabled,
    mbs.tweets_used AS monthly_used,
    mbs.tweets_budget AS monthly_budget,
    mbs.days_remaining,
    ROUND((mbs.tweets_used::DECIMAL / mbs.tweets_budget * 100), 2) AS monthly_utilization_percent,
    CASE 
        WHEN tl.emergency_monthly_cap_mode THEN 'EMERGENCY MODE ⚠️'
        WHEN bc.auto_posting_enabled THEN 'ACTIVE ✅'
        ELSE 'PAUSED ⏸️'
    END AS status
FROM twitter_api_limits tl
CROSS JOIN bot_configuration bc
CROSS JOIN monthly_budget_state mbs
WHERE tl.id = 1 AND bc.id = 1 AND mbs.month = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- 10. Migration Success Log
INSERT INTO bot_configuration (id, strategy, last_updated) VALUES (999, 'migration_30_75_tweets_success', CURRENT_TIMESTAMP) 
ON CONFLICT (id) DO UPDATE SET last_updated = CURRENT_TIMESTAMP;

-- ✅ MIGRATION COMPLETE: Intelligent 30-75 tweets/day system ready
-- Expected operation: 
-- • 15-minute decision cycles
-- • 30-75 tweets/day range
-- • Quality threshold: 60+
-- • No false monthly cap detection
-- • Intelligent budget distribution 
-- Learning Engine V2 Analytics Views Migration
-- Generated: 2025-08-11
-- Purpose: Add analytics views for learning engine v2 system
-- Safety: Additive only, no destructive changes

BEGIN;

-- Set timeouts for safety
SET lock_timeout = '30s';
SET statement_timeout = '60s';

-- Add learning metadata column to tweets table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweets' AND column_name = 'learning_metadata'
    ) THEN
        ALTER TABLE tweets ADD COLUMN learning_metadata JSONB DEFAULT '{}'::JSONB;
        CREATE INDEX IF NOT EXISTS idx_tweets_learning_metadata_gin 
            ON tweets USING GIN (learning_metadata);
        
        RAISE NOTICE 'Added learning_metadata column to tweets table';
    END IF;
END $$;

-- Recent posts view with learning v2 metadata
CREATE OR REPLACE VIEW vw_recent_posts AS
SELECT 
    id,
    tweet_id,
    content,
    posted_at,
    platform,
    metadata->>'topic' as topic,
    metadata->>'source' as source,
    COALESCE((analytics->>'likes')::INTEGER, 0) as likes,
    COALESCE((analytics->>'retweets')::INTEGER, 0) as retweets,
    COALESCE((analytics->>'replies')::INTEGER, 0) as replies,
    COALESCE((analytics->>'bookmarks')::INTEGER, 0) as bookmarks,
    COALESCE((analytics->>'impressions')::INTEGER, 0) as impressions,
    COALESCE((analytics->>'engagement_rate')::DECIMAL, 0) as engagement_rate,
    analytics->>'performance_tier' as performance_tier,
    learning_metadata->>'bandit_score' as bandit_score,
    learning_metadata->>'model_score' as model_score,
    learning_metadata->>'total_score' as total_score,
    learning_metadata->>'exploration_bonus' as exploration_bonus,
    (analytics->>'last_updated')::TIMESTAMPTZ as analytics_updated_at
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
    AND platform = 'twitter'
ORDER BY posted_at DESC;

-- Topic performance over 7 days
CREATE OR REPLACE VIEW vw_topics_perf_7d AS
SELECT 
    metadata->>'topic' as topic,
    COUNT(*) as post_count,
    AVG(COALESCE((analytics->>'engagement_rate')::DECIMAL, 0)) as avg_engagement_rate,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY COALESCE((analytics->>'likes')::INTEGER, 0)) as p95_likes,
    -- CTR estimate (engagement / impressions)
    CASE 
        WHEN SUM(COALESCE((analytics->>'impressions')::INTEGER, 0)) > 0 THEN
            SUM(COALESCE((analytics->>'likes')::INTEGER, 0) + 
                COALESCE((analytics->>'retweets')::INTEGER, 0) + 
                COALESCE((analytics->>'replies')::INTEGER, 0) + 
                COALESCE((analytics->>'bookmarks')::INTEGER, 0)) / 
            SUM(COALESCE((analytics->>'impressions')::INTEGER, 0))::DECIMAL
        ELSE 0
    END as ctr_est,
    MAX(posted_at) as last_post,
    MIN(posted_at) as first_post
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
    AND metadata->>'topic' IS NOT NULL
    AND platform = 'twitter'
GROUP BY metadata->>'topic'
HAVING COUNT(*) >= 1  -- At least 1 post
ORDER BY avg_engagement_rate DESC;

-- Time of day performance over 7 days
CREATE OR REPLACE VIEW vw_time_of_day_perf_7d AS
SELECT 
    EXTRACT(HOUR FROM posted_at) as hour_bucket,
    COUNT(*) as post_count,
    AVG(COALESCE((analytics->>'engagement_rate')::DECIMAL, 0)) as avg_engagement_rate,
    -- CTR estimate
    CASE 
        WHEN SUM(COALESCE((analytics->>'impressions')::INTEGER, 0)) > 0 THEN
            SUM(COALESCE((analytics->>'likes')::INTEGER, 0) + 
                COALESCE((analytics->>'retweets')::INTEGER, 0) + 
                COALESCE((analytics->>'replies')::INTEGER, 0) + 
                COALESCE((analytics->>'bookmarks')::INTEGER, 0)) / 
            SUM(COALESCE((analytics->>'impressions')::INTEGER, 0))::DECIMAL
        ELSE 0
    END as ctr_est,
    AVG(COALESCE((analytics->>'likes')::INTEGER, 0)) as avg_likes,
    AVG(COALESCE((analytics->>'retweets')::INTEGER, 0)) as avg_retweets,
    -- Performance tier distribution
    COUNT(*) FILTER (WHERE analytics->>'performance_tier' = 'viral') as viral_count,
    COUNT(*) FILTER (WHERE analytics->>'performance_tier' = 'high') as high_count,
    COUNT(*) FILTER (WHERE analytics->>'performance_tier' = 'medium') as medium_count,
    COUNT(*) FILTER (WHERE analytics->>'performance_tier' = 'low') as low_count
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '7 days'
    AND platform = 'twitter'
GROUP BY EXTRACT(HOUR FROM posted_at)
HAVING COUNT(*) >= 1  -- At least 1 post per hour
ORDER BY hour_bucket;

-- Learning engine performance view
CREATE OR REPLACE VIEW vw_learning_performance AS
SELECT 
    DATE_TRUNC('day', posted_at) as day,
    COUNT(*) as total_posts,
    AVG(COALESCE((analytics->>'engagement_rate')::DECIMAL, 0)) as avg_engagement_rate,
    COUNT(*) FILTER (WHERE analytics->>'performance_tier' IN ('high', 'viral')) as high_perf_posts,
    COUNT(*) FILTER (WHERE learning_metadata->>'exploration_bonus' IS NOT NULL 
                     AND (learning_metadata->>'exploration_bonus')::DECIMAL > 0) as exploration_posts,
    AVG(COALESCE((learning_metadata->>'total_score')::DECIMAL, 0)) as avg_total_score,
    AVG(COALESCE((learning_metadata->>'bandit_score')::DECIMAL, 0)) as avg_bandit_score,
    AVG(COALESCE((learning_metadata->>'model_score')::DECIMAL, 0)) as avg_model_score,
    -- Reward rate (posts above median engagement)
    COUNT(*) FILTER (WHERE (analytics->>'engagement_rate')::DECIMAL > 0.03) as reward_posts
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '30 days'
    AND platform = 'twitter'
GROUP BY DATE_TRUNC('day', posted_at)
ORDER BY day DESC;

-- Bandit arm performance view (from audit_log)
CREATE OR REPLACE VIEW vw_bandit_performance AS
SELECT 
    DATE_TRUNC('day', ts) as day,
    event_data->>'learning_engine' as engine_version,
    (event_data->>'tweets_processed')::INTEGER as tweets_processed,
    (event_data->>'average_engagement')::DECIMAL as avg_engagement,
    (event_data->>'total_rewards')::INTEGER as total_rewards,
    (event_data->>'bandit_updates')::INTEGER as bandit_updates,
    event_data->'top_topics' as top_topics,
    event_data->'best_hours' as best_hours,
    ts as logged_at
FROM audit_log 
WHERE event_type = 'LEARNING_CYCLE_COMPLETE'
    AND component = 'learning_engine_v2'
    AND ts > NOW() - INTERVAL '30 days'
ORDER BY ts DESC;

-- Content source performance view
CREATE OR REPLACE VIEW vw_content_sources_perf AS
SELECT 
    metadata->>'source' as content_source,
    COUNT(*) as post_count,
    AVG(COALESCE((analytics->>'engagement_rate')::DECIMAL, 0)) as avg_engagement_rate,
    AVG(COALESCE((analytics->>'likes')::INTEGER, 0)) as avg_likes,
    COUNT(*) FILTER (WHERE analytics->>'performance_tier' IN ('high', 'viral')) as high_perf_count,
    COUNT(*) FILTER (WHERE analytics->>'performance_tier' = 'viral') as viral_count,
    MAX(posted_at) as last_used,
    -- Success rate
    CASE 
        WHEN COUNT(*) > 0 THEN
            COUNT(*) FILTER (WHERE (analytics->>'engagement_rate')::DECIMAL > 0.03) / COUNT(*)::DECIMAL
        ELSE 0
    END as success_rate
FROM tweets 
WHERE posted_at > NOW() - INTERVAL '14 days'
    AND metadata->>'source' IS NOT NULL
    AND platform = 'twitter'
GROUP BY metadata->>'source'
HAVING COUNT(*) >= 1
ORDER BY avg_engagement_rate DESC;

-- Add helpful indexes for the views
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at_platform 
    ON tweets(posted_at DESC, platform) 
    WHERE platform = 'twitter';

CREATE INDEX IF NOT EXISTS idx_tweets_metadata_topic 
    ON tweets((metadata->>'topic')) 
    WHERE metadata->>'topic' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tweets_metadata_source 
    ON tweets((metadata->>'source')) 
    WHERE metadata->>'source' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tweets_analytics_performance 
    ON tweets((analytics->>'performance_tier')) 
    WHERE analytics->>'performance_tier' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_learning 
    ON audit_log(ts DESC, event_type, component) 
    WHERE event_type = 'LEARNING_CYCLE_COMPLETE';

-- Log migration completion
INSERT INTO audit_log (event_type, component, event_data, context)
VALUES (
    'MIGRATION_COMPLETE',
    'learning_v2_analytics',
    jsonb_build_object(
        'migration', '20250811_learning_v2_analytics',
        'views_created', 6,
        'indexes_created', 6,
        'learning_metadata_column_added', true
    ),
    jsonb_build_object(
        'timestamp', NOW()::TEXT,
        'additive_only', true,
        'breaking_changes', false
    )
);

COMMIT;

-- Verify views were created successfully
DO $$
DECLARE
    view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO view_count
    FROM information_schema.views 
    WHERE table_name LIKE 'vw_%' 
    AND table_schema = 'public';
    
    RAISE NOTICE 'Migration complete. Created % views for learning engine v2', view_count;
END $$;
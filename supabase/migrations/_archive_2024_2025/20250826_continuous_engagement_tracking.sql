-- 📊 CONTINUOUS ENGAGEMENT TRACKING TABLES
-- Creates tables to track individual post engagement over time

-- Table to store engagement snapshots at different time intervals
CREATE TABLE IF NOT EXISTS engagement_snapshots (
    id SERIAL PRIMARY KEY,
    tweet_id TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hours_since_post DECIMAL(5,2) NOT NULL,
    engagement_velocity INTEGER DEFAULT 0, -- Change since last snapshot
    is_trending BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to manage tracking schedules for posts
CREATE TABLE IF NOT EXISTS engagement_tracking_schedule (
    id SERIAL PRIMARY KEY,
    tweet_id TEXT NOT NULL UNIQUE,
    post_time TIMESTAMPTZ NOT NULL,
    check_intervals INTEGER[] NOT NULL, -- Array of hours: [1,4,12,24,48]
    completed_checks INTEGER[] DEFAULT '{}', -- Array of completed intervals
    next_check_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_tweet_id ON engagement_snapshots(tweet_id);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_timestamp ON engagement_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_trending ON engagement_snapshots(is_trending) WHERE is_trending = TRUE;
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_velocity ON engagement_snapshots(engagement_velocity DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_schedule_tweet_id ON engagement_tracking_schedule(tweet_id);
CREATE INDEX IF NOT EXISTS idx_tracking_schedule_next_check ON engagement_tracking_schedule(next_check_at) WHERE next_check_at IS NOT NULL;

-- RLS Policies for engagement_snapshots
ALTER TABLE engagement_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on engagement_snapshots" ON engagement_snapshots
    FOR ALL USING (true);

-- RLS Policies for engagement_tracking_schedule  
ALTER TABLE engagement_tracking_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on engagement_tracking_schedule" ON engagement_tracking_schedule
    FOR ALL USING (true);

-- Function to automatically update tweet_metrics with latest engagement data
CREATE OR REPLACE FUNCTION update_tweet_metrics_from_snapshot()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tweet_metrics (
        tweet_id, 
        likes, 
        retweets, 
        replies, 
        impressions, 
        created_at,
        updated_at
    )
    VALUES (
        NEW.tweet_id,
        NEW.likes,
        NEW.retweets, 
        NEW.replies,
        NEW.impressions,
        NEW.timestamp,
        NEW.timestamp
    )
    ON CONFLICT (tweet_id) 
    DO UPDATE SET
        likes = NEW.likes,
        retweets = NEW.retweets,
        replies = NEW.replies,
        impressions = NEW.impressions,
        updated_at = NEW.timestamp
    WHERE tweet_metrics.updated_at < NEW.timestamp; -- Only update if newer
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update tweet_metrics when new snapshot is added
CREATE TRIGGER trigger_update_tweet_metrics
    AFTER INSERT ON engagement_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_tweet_metrics_from_snapshot();

-- View for latest engagement status per tweet
CREATE OR REPLACE VIEW latest_engagement_status AS
SELECT DISTINCT ON (tweet_id)
    tweet_id,
    likes,
    retweets,
    replies,
    impressions,
    timestamp,
    hours_since_post,
    engagement_velocity,
    is_trending
FROM engagement_snapshots
ORDER BY tweet_id, timestamp DESC;

-- Function to get engagement growth rate for a tweet
CREATE OR REPLACE FUNCTION get_engagement_growth_rate(target_tweet_id TEXT)
RETURNS TABLE(
    hour_interval INTEGER,
    total_engagement INTEGER,
    engagement_change INTEGER,
    growth_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH ordered_snapshots AS (
        SELECT 
            ROUND(hours_since_post) AS hour_interval,
            (likes + retweets + replies) AS total_engagement,
            timestamp
        FROM engagement_snapshots 
        WHERE tweet_id = target_tweet_id
        ORDER BY timestamp
    ),
    with_previous AS (
        SELECT 
            hour_interval,
            total_engagement,
            LAG(total_engagement, 1, 0) OVER (ORDER BY timestamp) AS prev_engagement
        FROM ordered_snapshots
    )
    SELECT 
        wp.hour_interval::INTEGER,
        wp.total_engagement::INTEGER,
        (wp.total_engagement - wp.prev_engagement)::INTEGER AS engagement_change,
        CASE 
            WHEN wp.prev_engagement > 0 THEN 
                ROUND(((wp.total_engagement - wp.prev_engagement)::DECIMAL / wp.prev_engagement * 100), 2)
            ELSE 0 
        END AS growth_rate
    FROM with_previous wp
    ORDER BY wp.hour_interval;
END;
$$ LANGUAGE plpgsql;

-- Function to identify viral posts (high engagement velocity)
CREATE OR REPLACE FUNCTION identify_viral_posts(min_velocity INTEGER DEFAULT 10)
RETURNS TABLE(
    tweet_id TEXT,
    max_velocity INTEGER,
    peak_hour DECIMAL,
    final_engagement INTEGER,
    is_currently_trending BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        es.tweet_id,
        MAX(es.engagement_velocity)::INTEGER AS max_velocity,
        (ARRAY_AGG(es.hours_since_post ORDER BY es.engagement_velocity DESC))[1] AS peak_hour,
        (ARRAY_AGG(es.likes + es.retweets + es.replies ORDER BY es.timestamp DESC))[1]::INTEGER AS final_engagement,
        BOOL_OR(es.is_trending) AS is_currently_trending
    FROM engagement_snapshots es
    GROUP BY es.tweet_id
    HAVING MAX(es.engagement_velocity) >= min_velocity
    ORDER BY max_velocity DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON engagement_snapshots TO postgres, anon, authenticated;
GRANT ALL ON engagement_tracking_schedule TO postgres, anon, authenticated;
GRANT ALL ON latest_engagement_status TO postgres, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_engagement_growth_rate(TEXT) TO postgres, anon, authenticated;
GRANT EXECUTE ON FUNCTION identify_viral_posts(INTEGER) TO postgres, anon, authenticated;

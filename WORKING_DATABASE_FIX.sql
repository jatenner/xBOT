-- 🚨 WORKING DATABASE FIX FOR ANALYTICS COLLECTION
-- Fixed syntax errors from previous version

-- 1. Fix tweet_analytics table structure
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS click_through_rate DECIMAL(10,4) DEFAULT 0.0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0;

-- 2. Ensure all required columns exist
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS quotes INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS bookmarks INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS profile_visits INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS detail_expands INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS url_clicks INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS media_views INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS follower_gain INTEGER DEFAULT 0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(10,4) DEFAULT 0.0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS viral_score DECIMAL(10,4) DEFAULT 0.0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS quality_score DECIMAL(10,4) DEFAULT 0.0;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS ai_feedback TEXT;

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- 3. Create performance tracking view with FIXED syntax
CREATE OR REPLACE VIEW tweet_performance_summary AS
SELECT 
    ta.tweet_id,
    ta.likes,
    ta.retweets,
    ta.replies,
    ta.impressions,
    ta.engagement_rate,
    ta.viral_score,
    ta.created_at,
    t.content,
    -- Calculate engagement metrics
    CASE 
        WHEN ta.impressions > 0 THEN 
            ((ta.likes + ta.retweets + ta.replies)::DECIMAL / ta.impressions) * 100
        ELSE 0 
    END as calculated_engagement_rate,
    
    -- Viral potential score
    CASE 
        WHEN ta.likes > 50 OR ta.retweets > 10 THEN 'viral'
        WHEN ta.likes > 20 OR ta.retweets > 5 THEN 'high'
        WHEN ta.likes > 10 OR ta.retweets > 2 THEN 'medium'
        WHEN ta.likes > 0 OR ta.retweets > 0 THEN 'low'
        ELSE 'no_engagement'
    END as performance_tier
FROM tweet_analytics ta
LEFT JOIN tweets t ON ta.tweet_id = t.tweet_id
WHERE ta.created_at >= NOW() - INTERVAL '30 days'
ORDER BY ta.created_at DESC;

-- 4. Create simple function to get top performing content
CREATE OR REPLACE FUNCTION get_top_performing_content(
    days_back INTEGER DEFAULT 7,
    min_engagement INTEGER DEFAULT 5
)
RETURNS TABLE (
    tweet_id VARCHAR,
    content TEXT,
    likes INTEGER,
    retweets INTEGER,
    replies INTEGER,
    engagement_rate DECIMAL,
    viral_score DECIMAL,
    performance_tier TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tps.tweet_id,
        tps.content,
        tps.likes,
        tps.retweets,
        tps.replies,
        tps.engagement_rate,
        tps.viral_score,
        tps.performance_tier
    FROM tweet_performance_summary tps
    WHERE 
        tps.created_at >= NOW() - (days_back || ' days')::INTERVAL
        AND (tps.likes + tps.retweets + tps.replies) >= min_engagement
    ORDER BY 
        (tps.likes + tps.retweets + tps.replies) DESC,
        tps.engagement_rate DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- 5. Test that we can select from the table
SELECT COUNT(*) as total_tweets FROM tweet_analytics;

-- 6. Show recent analytics to verify
SELECT 
    tweet_id,
    likes,
    retweets,
    replies,
    created_at
FROM tweet_analytics 
ORDER BY created_at DESC 
LIMIT 5;
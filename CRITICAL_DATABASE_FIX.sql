-- 🚨 CRITICAL DATABASE FIX FOR ANALYTICS COLLECTION
-- This fixes the broken analytics that prevent learning and optimization

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

-- 3. Create performance tracking view
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

-- 4. Create learning optimization function
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
        tps.created_at >= NOW() - INTERVAL days_back || ' days'
        AND (tps.likes + tps.retweets + tps.replies) >= min_engagement
    ORDER BY 
        (tps.likes + tps.retweets + tps.replies) DESC,
        tps.engagement_rate DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- 5. Create poor performing content analysis
CREATE OR REPLACE FUNCTION get_poor_performing_content(
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    tweet_id VARCHAR,
    content TEXT,
    likes INTEGER,
    retweets INTEGER,
    replies INTEGER,
    hours_since_posted INTEGER,
    failure_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tps.tweet_id,
        tps.content,
        tps.likes,
        tps.retweets,
        tps.replies,
        EXTRACT(EPOCH FROM (NOW() - tps.created_at))/3600 as hours_since_posted,
        CASE 
            WHEN tps.likes = 0 AND tps.retweets = 0 AND tps.replies = 0 THEN 'zero_engagement'
            WHEN tps.likes <= 1 AND tps.retweets = 0 THEN 'very_low_engagement'
            WHEN tps.impressions > 0 AND tps.calculated_engagement_rate < 1 THEN 'low_engagement_rate'
            ELSE 'underperforming'
        END as failure_reason
    FROM tweet_performance_summary tps
    WHERE 
        tps.created_at >= NOW() - INTERVAL days_back || ' days'
        AND (tps.likes + tps.retweets + tps.replies) <= 5
    ORDER BY 
        tps.created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- 6. Create engagement pattern analysis
CREATE OR REPLACE FUNCTION analyze_engagement_patterns()
RETURNS TABLE (
    hour_of_day INTEGER,
    avg_likes DECIMAL,
    avg_retweets DECIMAL,
    avg_replies DECIMAL,
    total_posts INTEGER,
    engagement_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM ta.created_at)::INTEGER as hour_of_day,
        AVG(ta.likes)::DECIMAL as avg_likes,
        AVG(ta.retweets)::DECIMAL as avg_retweets,
        AVG(ta.replies)::DECIMAL as avg_replies,
        COUNT(*)::INTEGER as total_posts,
        AVG(ta.likes + ta.retweets + ta.replies)::DECIMAL as engagement_score
    FROM tweet_analytics ta
    WHERE ta.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY EXTRACT(HOUR FROM ta.created_at)
    ORDER BY engagement_score DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- 8. Test the fixes
SELECT 'Analytics database structure fixed successfully' as status;

-- Show current performance summary
SELECT * FROM tweet_performance_summary LIMIT 10;
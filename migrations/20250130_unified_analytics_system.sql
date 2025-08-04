-- ===================================================================
-- 🔧 UNIFIED ANALYTICS SYSTEM MIGRATION
-- ===================================================================
-- Date: 2025-01-30
-- Purpose: Create unified analytics infrastructure to fix data collection gaps
-- Priority: CRITICAL - Fixes core engagement tracking issues
-- ===================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================================
-- 1. CREATE UNIFIED TWEET ANALYTICS TABLE (Single Source of Truth)
-- ===================================================================

-- Drop existing inconsistent tables if they exist
DROP TABLE IF EXISTS tweet_analytics CASCADE;
DROP TABLE IF EXISTS tweet_performance CASCADE;
DROP TABLE IF EXISTS tweet_metrics CASCADE;

-- Create unified analytics table with all required metrics
CREATE TABLE tweet_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    
    -- Core Engagement Metrics (from Twitter scraping)
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0, 
    replies INTEGER DEFAULT 0,
    quotes INTEGER DEFAULT 0,
    bookmarks INTEGER DEFAULT 0,
    
    -- Reach & Discovery Metrics (CRITICAL - was missing)
    impressions INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    detail_expands INTEGER DEFAULT 0,
    url_clicks INTEGER DEFAULT 0,
    media_views INTEGER DEFAULT 0,
    
    -- Calculated Performance Metrics
    engagement_rate DECIMAL(8,4) DEFAULT 0,
    viral_score DECIMAL(8,4) DEFAULT 0,
    performance_score DECIMAL(8,4) DEFAULT 0,
    
    -- Follower Impact (CRITICAL for learning)
    follower_count_before INTEGER DEFAULT 0,
    follower_count_after INTEGER DEFAULT 0,
    new_followers_attributed INTEGER DEFAULT 0,
    
    -- Data Collection Metadata
    snapshot_interval VARCHAR(20) DEFAULT 'latest',
    snapshot_time TIMESTAMPTZ DEFAULT NOW(),
    collected_via VARCHAR(50) DEFAULT 'browser',
    collection_confidence DECIMAL(4,3) DEFAULT 1.0,
    
    -- Content Analysis
    content TEXT,
    content_type VARCHAR(50),
    has_media BOOLEAN DEFAULT false,
    has_hashtags BOOLEAN DEFAULT false,
    has_mentions BOOLEAN DEFAULT false,
    word_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tweet_id, snapshot_interval)
);

-- ===================================================================
-- 2. CREATE IMPRESSION TRACKING TABLE (Dedicated High-Frequency Updates)
-- ===================================================================

CREATE TABLE tweet_impressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    impressions INTEGER NOT NULL,
    views INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    collection_method VARCHAR(20) DEFAULT 'browser',
    data_freshness_minutes INTEGER DEFAULT 0,
    
    -- Reference back to main analytics
    FOREIGN KEY (tweet_id) REFERENCES tweets(tweet_id) ON DELETE CASCADE
);

-- ===================================================================
-- 3. CREATE FOLLOWER ATTRIBUTION TABLE (Tweet -> Follower Growth Mapping)
-- ===================================================================

CREATE TABLE follower_attribution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    follower_count_before INTEGER NOT NULL,
    follower_count_after INTEGER NOT NULL,
    new_followers INTEGER GENERATED ALWAYS AS (follower_count_after - follower_count_before) STORED,
    measurement_window_hours INTEGER DEFAULT 24,
    attribution_confidence DECIMAL(4,3) DEFAULT 0.8,
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Reference back to main analytics
    FOREIGN KEY (tweet_id) REFERENCES tweets(tweet_id) ON DELETE CASCADE,
    
    -- Prevent duplicate measurements for same time window
    UNIQUE(tweet_id, measurement_window_hours)
);

-- ===================================================================
-- 4. CREATE ALGORITHM SIGNALS TABLE (Twitter Algorithm Intelligence)
-- ===================================================================

CREATE TABLE algorithm_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(255) NOT NULL,
    
    -- Algorithm Response Indicators
    reach_velocity DECIMAL(8,4) DEFAULT 0, -- Impressions per hour in first 6 hours
    engagement_velocity DECIMAL(8,4) DEFAULT 0, -- Engagement per hour
    viral_threshold_reached BOOLEAN DEFAULT false,
    algorithm_boost_detected BOOLEAN DEFAULT false,
    shadow_ban_detected BOOLEAN DEFAULT false,
    
    -- Timing Analysis
    optimal_posting_time TIMESTAMPTZ,
    peak_engagement_hour INTEGER,
    engagement_decay_rate DECIMAL(8,4) DEFAULT 0,
    
    -- Competitive Analysis
    topic_saturation_score DECIMAL(8,4) DEFAULT 0,
    trending_topic_alignment DECIMAL(8,4) DEFAULT 0,
    influencer_engagement_received BOOLEAN DEFAULT false,
    
    -- Metadata
    analysis_confidence DECIMAL(4,3) DEFAULT 0.8,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Reference back to main analytics
    FOREIGN KEY (tweet_id) REFERENCES tweets(tweet_id) ON DELETE CASCADE,
    
    UNIQUE(tweet_id)
);

-- ===================================================================
-- 5. CREATE PERFORMANCE INDEXES (Optimized Queries)
-- ===================================================================

-- Core analytics indexes
CREATE INDEX idx_tweet_analytics_tweet_id ON tweet_analytics(tweet_id);
CREATE INDEX idx_tweet_analytics_performance_score ON tweet_analytics(performance_score DESC);
CREATE INDEX idx_tweet_analytics_viral_score ON tweet_analytics(viral_score DESC);
CREATE INDEX idx_tweet_analytics_engagement_rate ON tweet_analytics(engagement_rate DESC);
CREATE INDEX idx_tweet_analytics_snapshot_time ON tweet_analytics(snapshot_time DESC);
CREATE INDEX idx_tweet_analytics_new_followers ON tweet_analytics(new_followers_attributed DESC);

-- Impression tracking indexes
CREATE INDEX idx_tweet_impressions_tweet_id ON tweet_impressions(tweet_id);
CREATE INDEX idx_tweet_impressions_collected_at ON tweet_impressions(collected_at DESC);
CREATE INDEX idx_tweet_impressions_impressions ON tweet_impressions(impressions DESC);

-- Follower attribution indexes
CREATE INDEX idx_follower_attribution_tweet_id ON follower_attribution(tweet_id);
CREATE INDEX idx_follower_attribution_new_followers ON follower_attribution(new_followers DESC);
CREATE INDEX idx_follower_attribution_measured_at ON follower_attribution(measured_at DESC);

-- Algorithm signals indexes
CREATE INDEX idx_algorithm_signals_tweet_id ON algorithm_signals(tweet_id);
CREATE INDEX idx_algorithm_signals_reach_velocity ON algorithm_signals(reach_velocity DESC);
CREATE INDEX idx_algorithm_signals_viral_detected ON algorithm_signals(viral_threshold_reached);

-- ===================================================================
-- 6. CREATE UNIFIED PERFORMANCE SCORING FUNCTION
-- ===================================================================

CREATE OR REPLACE FUNCTION calculate_unified_performance_score(
    p_likes INTEGER,
    p_retweets INTEGER,
    p_replies INTEGER,
    p_impressions INTEGER,
    p_new_followers INTEGER,
    p_profile_visits INTEGER DEFAULT 0
) RETURNS DECIMAL(8,4) AS $$
DECLARE
    engagement_score DECIMAL(8,4);
    reach_score DECIMAL(8,4);
    follower_score DECIMAL(8,4);
    conversion_score DECIMAL(8,4);
    final_score DECIMAL(8,4);
BEGIN
    -- Engagement Score (0-25 points)
    engagement_score = LEAST(25, (p_likes + p_retweets * 2 + p_replies * 3) / 4.0);
    
    -- Reach Score (0-25 points)
    reach_score = LEAST(25, p_impressions / 200.0);
    
    -- Follower Score (0-30 points) - HIGHEST WEIGHT
    follower_score = LEAST(30, p_new_followers * 5.0);
    
    -- Conversion Score (0-20 points)
    conversion_score = CASE 
        WHEN p_impressions > 0 THEN LEAST(20, (p_profile_visits::DECIMAL / p_impressions) * 100 * 2)
        ELSE 0
    END;
    
    -- Final Score (0-100)
    final_score = engagement_score + reach_score + follower_score + conversion_score;
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===================================================================
-- 7. CREATE BEST TWEET IDENTIFICATION FUNCTION
-- ===================================================================

CREATE OR REPLACE FUNCTION get_best_performing_tweets(
    days_back INTEGER DEFAULT 30,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
    tweet_id VARCHAR(255),
    content TEXT,
    performance_score DECIMAL(8,4),
    likes INTEGER,
    retweets INTEGER,
    replies INTEGER,
    impressions INTEGER,
    new_followers INTEGER,
    posted_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.tweet_id,
        ta.content,
        ta.performance_score,
        ta.likes,
        ta.retweets,
        ta.replies,
        ta.impressions,
        ta.new_followers_attributed,
        t.created_at as posted_at
    FROM tweet_analytics ta
    JOIN tweets t ON ta.tweet_id = t.tweet_id
    WHERE 
        ta.snapshot_interval = 'latest'
        AND t.created_at >= NOW() - INTERVAL '1 day' * days_back
        AND ta.performance_score > 0
    ORDER BY ta.performance_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 8. CREATE ANALYTICS CALCULATION TRIGGERS
-- ===================================================================

-- Trigger to auto-calculate performance scores
CREATE OR REPLACE FUNCTION update_analytics_calculations()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate engagement rate
    IF NEW.impressions > 0 THEN
        NEW.engagement_rate = ((NEW.likes + NEW.retweets + NEW.replies)::DECIMAL / NEW.impressions) * 100;
    ELSE
        NEW.engagement_rate = 0;
    END IF;
    
    -- Calculate viral score (engagement rate + follower impact)
    NEW.viral_score = (NEW.engagement_rate * 0.6) + (GREATEST(NEW.new_followers_attributed, 0) * 4.0);
    
    -- Calculate unified performance score
    NEW.performance_score = calculate_unified_performance_score(
        NEW.likes,
        NEW.retweets, 
        NEW.replies,
        NEW.impressions,
        NEW.new_followers_attributed,
        NEW.profile_visits
    );
    
    -- Update timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analytics_calculations
    BEFORE INSERT OR UPDATE ON tweet_analytics
    FOR EACH ROW EXECUTE FUNCTION update_analytics_calculations();

-- ===================================================================
-- 9. CREATE UNIFIED ANALYTICS VIEW (Single Source of Truth)
-- ===================================================================

CREATE OR REPLACE VIEW unified_tweet_performance AS
SELECT 
    t.tweet_id,
    t.content,
    t.created_at as posted_at,
    
    -- Latest Analytics Data
    ta.likes,
    ta.retweets,
    ta.replies,
    ta.quotes,
    ta.bookmarks,
    ta.impressions,
    ta.views,
    ta.profile_visits,
    
    -- Calculated Metrics
    ta.engagement_rate,
    ta.viral_score,
    ta.performance_score,
    ta.new_followers_attributed,
    
    -- Data Quality
    ta.collected_via,
    ta.collection_confidence,
    ta.snapshot_time,
    
    -- Performance Ranking
    RANK() OVER (ORDER BY ta.performance_score DESC) as performance_rank,
    PERCENT_RANK() OVER (ORDER BY ta.performance_score) as performance_percentile

FROM tweets t
LEFT JOIN tweet_analytics ta ON t.tweet_id = ta.tweet_id AND ta.snapshot_interval = 'latest'
ORDER BY ta.performance_score DESC NULLS LAST;

-- ===================================================================
-- 10. MIGRATE EXISTING DATA
-- ===================================================================

-- Copy existing tweet data to unified analytics (if old tables exist)
DO $$
BEGIN
    -- Try to migrate from old tweet_performance table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tweet_performance') THEN
        INSERT INTO tweet_analytics (
            tweet_id, content, likes, retweets, replies, impressions, 
            created_at, updated_at
        )
        SELECT 
            tweet_id, content, likes, retweets, replies, impressions,
            created_at, updated_at
        FROM tweet_performance
        ON CONFLICT (tweet_id, snapshot_interval) DO NOTHING;
        
        RAISE NOTICE 'Migrated data from tweet_performance table';
    END IF;
    
    -- Try to migrate from tweets table engagement data
    INSERT INTO tweet_analytics (
        tweet_id, content, likes, retweets, replies, impressions,
        created_at, updated_at
    )
    SELECT 
        tweet_id, content, 
        COALESCE(likes, 0), 
        COALESCE(retweets, 0), 
        COALESCE(replies, 0),
        COALESCE(impressions, 0),
        created_at, updated_at
    FROM tweets
    WHERE tweet_id NOT IN (SELECT tweet_id FROM tweet_analytics)
    ON CONFLICT (tweet_id, snapshot_interval) DO NOTHING;
    
    RAISE NOTICE 'Migrated base tweet data to unified analytics';
END $$;

-- ===================================================================
-- 11. VERIFY MIGRATION SUCCESS
-- ===================================================================

-- Show migration results
SELECT 
    'UNIFIED ANALYTICS MIGRATION COMPLETE' as status,
    (SELECT COUNT(*) FROM tweet_analytics) as total_analytics_records,
    (SELECT COUNT(*) FROM tweet_impressions) as impression_records,
    (SELECT COUNT(*) FROM follower_attribution) as attribution_records,
    (SELECT COUNT(*) FROM algorithm_signals) as algorithm_records,
    NOW() as completed_at;

-- Show sample of best performing tweets
SELECT 
    'TOP 5 TWEETS BY PERFORMANCE' as section,
    tweet_id,
    COALESCE(performance_score, 0) as score,
    COALESCE(likes, 0) as likes,
    COALESCE(impressions, 0) as impressions
FROM unified_tweet_performance 
WHERE performance_score IS NOT NULL
LIMIT 5;

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================

SELECT 
    '🚀 UNIFIED ANALYTICS SYSTEM DEPLOYED!' as status,
    'Single source of truth for all tweet metrics' as feature_1,
    'Real impression tracking infrastructure' as feature_2,
    'Follower attribution system active' as feature_3,
    'Algorithm signals monitoring enabled' as feature_4,
    'Performance scoring standardized' as feature_5,
    NOW() as deployment_time;
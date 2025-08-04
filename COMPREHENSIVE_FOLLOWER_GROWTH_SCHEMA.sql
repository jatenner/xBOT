-- 🚀 COMPREHENSIVE FOLLOWER GROWTH DATABASE SCHEMA
-- Complete system for tracking, learning, and optimizing follower growth

-- 1. Fix existing tweet_analytics table
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'click_through_rate'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN click_through_rate DECIMAL(10,4) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'content'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN content TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'likes'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN likes INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'retweets'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN retweets INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'replies'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN replies INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'quotes'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN quotes INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'bookmarks'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN bookmarks INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'impressions'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN impressions INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'engagement_rate'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN engagement_rate DECIMAL(10,4) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'viral_score'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN viral_score DECIMAL(10,4) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tweet_analytics' AND column_name = 'follower_gain'
    ) THEN
        ALTER TABLE tweet_analytics ADD COLUMN follower_gain INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Create viral content tracking table
CREATE TABLE IF NOT EXISTS viral_content_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    hook_pattern TEXT NOT NULL,
    structure TEXT NOT NULL,
    psychological_triggers JSONB DEFAULT '[]',
    controversy_level VARCHAR(50) DEFAULT 'medium',
    expected_engagement INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0.0,
    example_content TEXT,
    target_audience VARCHAR(255),
    times_used INTEGER DEFAULT 0,
    total_engagement INTEGER DEFAULT 0,
    avg_engagement DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create viral content usage tracking
CREATE TABLE IF NOT EXISTS viral_content_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id VARCHAR(255) NOT NULL,
    template_id VARCHAR(255) REFERENCES viral_content_templates(template_id),
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'single_tweet', 'thread', 'quote_tweet'
    viral_score DECIMAL(10,2) DEFAULT 0.0,
    controversy_level VARCHAR(50),
    psychological_triggers JSONB DEFAULT '[]',
    expected_engagement INTEGER DEFAULT 0,
    actual_engagement INTEGER DEFAULT 0,
    target_demographics JSONB DEFAULT '[]',
    posting_strategy TEXT,
    engagement_hooks JSONB DEFAULT '[]',
    call_to_action TEXT,
    posted_at TIMESTAMP DEFAULT NOW(),
    engagement_collected_at TIMESTAMP,
    follower_gain_24h INTEGER DEFAULT 0,
    performance_tier VARCHAR(50) DEFAULT 'pending' -- 'viral', 'high', 'medium', 'low', 'failed'
);

-- 4. Create follower growth tracking
CREATE TABLE IF NOT EXISTS follower_growth_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    follower_count INTEGER NOT NULL,
    follower_gain_daily INTEGER DEFAULT 0,
    follower_gain_weekly INTEGER DEFAULT 0,
    follower_gain_monthly INTEGER DEFAULT 0,
    engagement_rate_daily DECIMAL(10,4) DEFAULT 0.0,
    viral_tweets_count INTEGER DEFAULT 0,
    top_performing_tweet_id VARCHAR(255),
    growth_rate DECIMAL(10,4) DEFAULT 0.0,
    growth_trend VARCHAR(50) DEFAULT 'stable', -- 'growing', 'declining', 'stable', 'explosive'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create content performance analysis
CREATE TABLE IF NOT EXISTS content_performance_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    total_tweets INTEGER DEFAULT 0,
    avg_engagement DECIMAL(10,2) DEFAULT 0.0,
    viral_tweets_count INTEGER DEFAULT 0,
    top_template_id VARCHAR(255),
    top_template_performance DECIMAL(10,2) DEFAULT 0.0,
    worst_template_id VARCHAR(255),
    worst_template_performance DECIMAL(10,2) DEFAULT 0.0,
    engagement_trend VARCHAR(50) DEFAULT 'stable',
    follower_conversion_rate DECIMAL(10,4) DEFAULT 0.0,
    optimization_recommendations JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Create engagement optimization insights
CREATE TABLE IF NOT EXISTS engagement_optimization_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type VARCHAR(100) NOT NULL, -- 'content_type', 'timing', 'controversy_level', 'psychological_trigger'
    insight_category VARCHAR(100) NOT NULL,
    insight_value VARCHAR(255) NOT NULL,
    performance_score DECIMAL(10,2) DEFAULT 0.0,
    usage_count INTEGER DEFAULT 0,
    avg_engagement DECIMAL(10,2) DEFAULT 0.0,
    follower_conversion_rate DECIMAL(10,4) DEFAULT 0.0,
    confidence_score DECIMAL(5,4) DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_engagement ON tweet_analytics(likes, retweets, replies);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_viral_score ON tweet_analytics(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_created_at ON tweet_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_content_usage_template ON viral_content_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_viral_content_usage_performance ON viral_content_usage(actual_engagement DESC);
CREATE INDEX IF NOT EXISTS idx_follower_growth_date ON follower_growth_tracking(date DESC);

-- 8. Create performance summary view
CREATE OR REPLACE VIEW follower_growth_dashboard AS
SELECT 
    -- Current metrics
    fg.follower_count as current_followers,
    fg.follower_gain_daily,
    fg.follower_gain_weekly,
    fg.follower_gain_monthly,
    fg.growth_rate,
    fg.growth_trend,
    
    -- Content performance
    cpa.total_tweets as tweets_today,
    cpa.avg_engagement,
    cpa.viral_tweets_count,
    cpa.top_template_id as best_template,
    cpa.engagement_trend,
    cpa.follower_conversion_rate,
    
    -- Top performing content
    vcu.content as top_content,
    vcu.actual_engagement as top_engagement,
    vcu.viral_score as top_viral_score,
    
    fg.date as report_date
FROM follower_growth_tracking fg
LEFT JOIN content_performance_analysis cpa ON fg.date = cpa.analysis_date
LEFT JOIN viral_content_usage vcu ON fg.top_performing_tweet_id = vcu.tweet_id
ORDER BY fg.date DESC;

-- 9. Create functions for analytics

-- Function to update template performance
CREATE OR REPLACE FUNCTION update_template_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- Update template statistics when engagement data is collected
    UPDATE viral_content_templates 
    SET 
        times_used = times_used + 1,
        total_engagement = total_engagement + COALESCE(NEW.actual_engagement, 0),
        avg_engagement = (total_engagement + COALESCE(NEW.actual_engagement, 0)) / (times_used + 1),
        updated_at = NOW()
    WHERE template_id = NEW.template_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for template performance updates
DROP TRIGGER IF EXISTS trigger_update_template_performance ON viral_content_usage;
CREATE TRIGGER trigger_update_template_performance
    AFTER INSERT OR UPDATE ON viral_content_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_template_performance();

-- Function to calculate viral score
CREATE OR REPLACE FUNCTION calculate_viral_score(
    likes INTEGER,
    retweets INTEGER,
    replies INTEGER,
    impressions INTEGER DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
    total_engagement INTEGER;
    engagement_rate DECIMAL;
    viral_score DECIMAL;
BEGIN
    total_engagement := COALESCE(likes, 0) + COALESCE(retweets, 0) + COALESCE(replies, 0);
    
    -- Base score from total engagement
    viral_score := CASE 
        WHEN total_engagement >= 100 THEN 95
        WHEN total_engagement >= 50 THEN 85
        WHEN total_engagement >= 25 THEN 70
        WHEN total_engagement >= 10 THEN 50
        WHEN total_engagement >= 5 THEN 30
        WHEN total_engagement >= 1 THEN 15
        ELSE 0
    END;
    
    -- Adjust for engagement rate if impressions available
    IF impressions IS NOT NULL AND impressions > 0 THEN
        engagement_rate := (total_engagement::DECIMAL / impressions) * 100;
        viral_score := viral_score * (1 + (engagement_rate / 100));
    END IF;
    
    -- Boost for retweets (viral indicator)
    viral_score := viral_score + (COALESCE(retweets, 0) * 5);
    
    RETURN LEAST(100, viral_score);
END;
$$ LANGUAGE plpgsql;

-- Function to get top performing templates
CREATE OR REPLACE FUNCTION get_top_performing_templates(
    days_back INTEGER DEFAULT 7,
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    template_id VARCHAR,
    template_name VARCHAR,
    times_used INTEGER,
    avg_engagement DECIMAL,
    success_rate DECIMAL,
    follower_conversion DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vct.template_id,
        vct.name,
        COUNT(vcu.id)::INTEGER as times_used,
        AVG(vcu.actual_engagement)::DECIMAL as avg_engagement,
        (COUNT(CASE WHEN vcu.actual_engagement > 10 THEN 1 END)::DECIMAL / COUNT(vcu.id))::DECIMAL as success_rate,
        AVG(vcu.follower_gain_24h)::DECIMAL as follower_conversion
    FROM viral_content_templates vct
    LEFT JOIN viral_content_usage vcu ON vct.template_id = vcu.template_id
    WHERE vcu.posted_at >= NOW() - (days_back || ' days')::INTERVAL
    GROUP BY vct.template_id, vct.name
    ORDER BY avg_engagement DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze engagement patterns
CREATE OR REPLACE FUNCTION analyze_engagement_patterns()
RETURNS TABLE (
    hour_of_day INTEGER,
    day_of_week INTEGER,
    avg_engagement DECIMAL,
    avg_viral_score DECIMAL,
    follower_gain DECIMAL,
    post_count INTEGER,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM ta.created_at)::INTEGER as hour_of_day,
        EXTRACT(DOW FROM ta.created_at)::INTEGER as day_of_week,
        AVG(ta.likes + ta.retweets + ta.replies)::DECIMAL as avg_engagement,
        AVG(ta.viral_score)::DECIMAL as avg_viral_score,
        AVG(ta.follower_gain)::DECIMAL as follower_gain,
        COUNT(*)::INTEGER as post_count,
        (COUNT(CASE WHEN (ta.likes + ta.retweets + ta.replies) > 10 THEN 1 END)::DECIMAL / COUNT(*))::DECIMAL as success_rate
    FROM tweet_analytics ta
    WHERE ta.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY EXTRACT(HOUR FROM ta.created_at), EXTRACT(DOW FROM ta.created_at)
    ORDER BY avg_engagement DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. Insert default viral templates
INSERT INTO viral_content_templates (template_id, name, hook_pattern, structure, psychological_triggers, controversy_level, expected_engagement, success_rate, example_content, target_audience)
VALUES 
    ('controversial_health_take', 'Controversial Health Take', '[Popular belief] is completely wrong. Here''s why:', 'Hook + Controversy + Evidence + Call to Action', '["social_proof", "authority", "fear_of_missing_out", "contrarian"]', 'high', 85, 0.78, 'Cardio is making you fat. Here''s the science they don''t want you to know:', 'fitness_health_conscious'),
    ('personal_transformation', 'Personal Transformation Story', 'I [did something] for [time period]. Here''s what happened:', 'Personal Hook + Journey + Results + Method', '["social_proof", "transformation", "curiosity", "aspiration"]', 'low', 92, 0.85, 'I eliminated seed oils for 90 days. My brain fog disappeared completely.', 'health_optimization'),
    ('myth_busting_thread', 'Myth Busting Thread', '[Number] health myths that are ruining your life:', 'Numbered Hook + Myth + Truth + Evidence + Action', '["curiosity", "authority", "fear", "education"]', 'medium', 76, 0.72, '5 nutrition myths that are keeping you sick and tired:', 'general_health'),
    ('insider_secrets', 'Insider Secrets', 'What [industry] doesn''t want you to know about [topic]:', 'Conspiracy Hook + Hidden Truth + Industry Critique + Solution', '["conspiracy", "insider_knowledge", "rebellion", "exclusivity"]', 'extreme', 94, 0.68, 'What Big Pharma doesn''t want you to know about natural healing:', 'alternative_health'),
    ('question_engagement', 'Question-Based Engagement', 'What''s the [superlative] [thing] that''s [action] your [outcome]?', 'Question + Multiple Choice + Community Engagement', '["curiosity", "community", "personalization", "engagement"]', 'low', 67, 0.81, 'What''s the #1 thing destroying your gut health right now?', 'interactive_community')
ON CONFLICT (template_id) DO UPDATE SET
    expected_engagement = EXCLUDED.expected_engagement,
    success_rate = EXCLUDED.success_rate,
    updated_at = NOW();

-- 11. Create daily analytics summary
CREATE OR REPLACE FUNCTION generate_daily_analytics_summary()
RETURNS VOID AS $$
DECLARE
    summary_date DATE := CURRENT_DATE;
    total_tweets_count INTEGER;
    avg_engagement_score DECIMAL;
    viral_tweets_count INTEGER;
    best_template VARCHAR;
    worst_template VARCHAR;
BEGIN
    -- Calculate daily metrics
    SELECT 
        COUNT(*),
        AVG(likes + retweets + replies),
        COUNT(CASE WHEN viral_score > 70 THEN 1 END)
    INTO 
        total_tweets_count,
        avg_engagement_score,
        viral_tweets_count
    FROM tweet_analytics 
    WHERE DATE(created_at) = summary_date;

    -- Find best and worst performing templates
    SELECT template_id INTO best_template
    FROM viral_content_usage vcu
    WHERE DATE(posted_at) = summary_date
    ORDER BY actual_engagement DESC
    LIMIT 1;

    SELECT template_id INTO worst_template
    FROM viral_content_usage vcu
    WHERE DATE(posted_at) = summary_date
    ORDER BY actual_engagement ASC
    LIMIT 1;

    -- Insert or update daily summary
    INSERT INTO content_performance_analysis (
        analysis_date,
        total_tweets,
        avg_engagement,
        viral_tweets_count,
        top_template_id,
        worst_template_id
    )
    VALUES (
        summary_date,
        COALESCE(total_tweets_count, 0),
        COALESCE(avg_engagement_score, 0),
        COALESCE(viral_tweets_count, 0),
        best_template,
        worst_template
    )
    ON CONFLICT (analysis_date) DO UPDATE SET
        total_tweets = EXCLUDED.total_tweets,
        avg_engagement = EXCLUDED.avg_engagement,
        viral_tweets_count = EXCLUDED.viral_tweets_count,
        top_template_id = EXCLUDED.top_template_id,
        worst_template_id = EXCLUDED.worst_template_id;
END;
$$ LANGUAGE plpgsql;

-- Test the schema
SELECT 'Comprehensive follower growth schema created successfully!' as status;

-- Show current state
SELECT 
    COUNT(*) as total_analytics_records,
    AVG(likes + retweets + replies) as avg_engagement,
    MAX(viral_score) as max_viral_score
FROM tweet_analytics 
WHERE created_at >= NOW() - INTERVAL '7 days';
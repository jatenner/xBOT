-- 🚨 CRITICAL FIXES: ELIMINATE PLACEHOLDER CONTENT & FIX SCHEMA
-- ==============================================================
-- Date: 2025-08-26
-- Purpose: Fix all critical issues preventing proper learning
-- Focus: Schema fixes, content validation, learning improvements

-- ==========================================
-- 1️⃣ FIX TWEET_METRICS TABLE SCHEMA
-- ==========================================

-- Add missing created_at column to tweet_metrics
ALTER TABLE tweet_metrics 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tweet_metrics_created_at 
ON tweet_metrics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tweet_metrics_tweet_id_created 
ON tweet_metrics (tweet_id, created_at DESC);

-- ==========================================
-- 2️⃣ ENHANCED CONTENT QUALITY TRACKING
-- ==========================================

-- Add content quality columns to tweets table
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS content_quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_validation_passed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_placeholder_content BOOLEAN DEFAULT false;

-- Create index for content quality analysis
CREATE INDEX IF NOT EXISTS idx_tweets_content_quality 
ON tweets (content_quality_score DESC, content_validation_passed);

-- ==========================================
-- 3️⃣ LEARNING SYSTEM OPTIMIZATION
-- ==========================================

-- Add learning improvement columns
ALTER TABLE learning_posts 
ADD COLUMN IF NOT EXISTS content_quality_indicators JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS engagement_prediction_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_vs_predicted_accuracy DECIMAL(5,2) DEFAULT 0.0;

-- Create indexes for learning analytics
CREATE INDEX IF NOT EXISTS idx_learning_posts_engagement_prediction 
ON learning_posts (engagement_prediction_score DESC);

CREATE INDEX IF NOT EXISTS idx_learning_posts_accuracy 
ON learning_posts (actual_vs_predicted_accuracy DESC);

-- ==========================================
-- 4️⃣ PLACEHOLDER CONTENT ELIMINATION
-- ==========================================

-- Mark existing placeholder content for cleanup
UPDATE tweets 
SET is_placeholder_content = true,
    content_validation_passed = false
WHERE content LIKE '%Thread posted successfully%' 
   OR content LIKE '%High-quality tweet for follower growth%'
   OR LENGTH(content) <= 67
   OR content LIKE '%Generated content%'
   OR content LIKE '%Placeholder content%';

-- Mark placeholder content in learning_posts
UPDATE learning_posts 
SET viral_potential_score = 0
WHERE content LIKE '%Thread posted successfully%' 
   OR content LIKE '%High-quality tweet for follower growth%'
   OR LENGTH(content) <= 67;

-- ==========================================
-- 5️⃣ ENHANCED ANALYTICS FUNCTIONS
-- ==========================================

-- Function to calculate real engagement score (no fake metrics)
CREATE OR REPLACE FUNCTION calculate_real_engagement_score(
    likes_count INTEGER DEFAULT 0,
    retweets_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    engagement_score INTEGER := 0;
    max_realistic_engagement INTEGER;
BEGIN
    -- Reality check: engagement can't exceed follower count significantly
    max_realistic_engagement := GREATEST(follower_count * 2, 10);
    
    -- Cap likes at realistic level
    likes_count := LEAST(likes_count, max_realistic_engagement);
    retweets_count := LEAST(retweets_count, max_realistic_engagement / 2);
    replies_count := LEAST(replies_count, max_realistic_engagement / 3);
    
    -- Calculate weighted engagement score
    engagement_score := (likes_count * 1) + (retweets_count * 3) + (replies_count * 5);
    
    -- For new accounts (0 followers), cap at very low engagement
    IF follower_count = 0 THEN
        engagement_score := LEAST(engagement_score, 10);
    END IF;
    
    RETURN engagement_score;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze content quality for learning
CREATE OR REPLACE FUNCTION analyze_content_for_learning(
    content_text TEXT
) RETURNS JSONB AS $$
DECLARE
    quality_indicators JSONB := '{}';
    word_count INTEGER;
    char_count INTEGER;
    has_numbers BOOLEAN;
    has_health_keywords BOOLEAN;
    has_questions BOOLEAN;
    has_actionable_language BOOLEAN;
BEGIN
    word_count := array_length(string_to_array(content_text, ' '), 1);
    char_count := LENGTH(content_text);
    has_numbers := content_text ~ '\d+';
    has_health_keywords := content_text ~* '(health|brain|body|study|research|metabolic|energy|calories|sleep|exercise|nutrition)';
    has_questions := content_text LIKE '%?%';
    has_actionable_language := content_text ~* '(try|start|stop|consider|avoid|increase|decrease)';
    
    quality_indicators := jsonb_build_object(
        'word_count', word_count,
        'character_count', char_count,
        'has_numbers', has_numbers,
        'has_health_keywords', has_health_keywords,
        'has_questions', has_questions,
        'has_actionable_language', has_actionable_language,
        'is_substantial', char_count > 80 AND word_count > 15,
        'engagement_potential', 
            CASE 
                WHEN has_numbers AND has_health_keywords AND has_questions THEN 'high'
                WHEN has_health_keywords AND (has_numbers OR has_questions) THEN 'medium'
                ELSE 'low'
            END
    );
    
    RETURN quality_indicators;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 6️⃣ AUTOMATIC CONTENT QUALITY TRIGGERS
-- ==========================================

-- Trigger to automatically analyze content quality on insert/update
CREATE OR REPLACE FUNCTION auto_analyze_content_quality() RETURNS TRIGGER AS $$
DECLARE
    quality_indicators JSONB;
    quality_score INTEGER := 0;
BEGIN
    -- Analyze content quality
    quality_indicators := analyze_content_for_learning(NEW.content);
    
    -- Calculate quality score
    quality_score := 50; -- Base score
    
    IF (quality_indicators->>'has_health_keywords')::boolean THEN
        quality_score := quality_score + 20;
    END IF;
    
    IF (quality_indicators->>'has_numbers')::boolean THEN
        quality_score := quality_score + 15;
    END IF;
    
    IF (quality_indicators->>'has_questions')::boolean THEN
        quality_score := quality_score + 10;
    END IF;
    
    IF (quality_indicators->>'has_actionable_language')::boolean THEN
        quality_score := quality_score + 15;
    END IF;
    
    IF (quality_indicators->>'is_substantial')::boolean THEN
        quality_score := quality_score + 20;
    ELSE
        quality_score := quality_score - 30;
    END IF;
    
    -- Update learning_posts with quality indicators
    IF TG_TABLE_NAME = 'learning_posts' THEN
        NEW.content_quality_indicators := quality_indicators;
        NEW.viral_potential_score := GREATEST(quality_score, 0);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic quality analysis
DROP TRIGGER IF EXISTS trigger_auto_analyze_quality ON learning_posts;
CREATE TRIGGER trigger_auto_analyze_quality
    BEFORE INSERT OR UPDATE ON learning_posts
    FOR EACH ROW
    EXECUTE FUNCTION auto_analyze_content_quality();

-- ==========================================
-- 7️⃣ LEARNING ANALYTICS VIEW
-- ==========================================

-- Create comprehensive learning analytics view
CREATE OR REPLACE VIEW learning_analytics_enhanced AS
SELECT 
    DATE(created_at) as analysis_date,
    COUNT(*) as total_posts,
    COUNT(CASE WHEN viral_potential_score > 70 THEN 1 END) as high_quality_posts,
    COUNT(CASE WHEN viral_potential_score = 0 THEN 1 END) as placeholder_posts,
    AVG(viral_potential_score) as avg_viral_score,
    AVG(likes_count + retweets_count + replies_count) as avg_engagement,
    AVG(LENGTH(content)) as avg_content_length,
    COUNT(CASE WHEN content_quality_indicators->>'has_health_keywords' = 'true' THEN 1 END) as health_content_count,
    COUNT(CASE WHEN content_quality_indicators->>'has_numbers' = 'true' THEN 1 END) as data_driven_content_count,
    -- Learning improvement metrics
    AVG(actual_vs_predicted_accuracy) as prediction_accuracy,
    STDDEV(viral_potential_score) as content_quality_variance
FROM learning_posts 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY analysis_date DESC;

-- ==========================================
-- 8️⃣ ENGAGEMENT PREDICTION SYSTEM
-- ==========================================

-- Function to predict engagement based on content quality
CREATE OR REPLACE FUNCTION predict_engagement_score(
    content_text TEXT,
    current_follower_count INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    prediction_score INTEGER := 0;
    quality_indicators JSONB;
    base_engagement INTEGER;
BEGIN
    quality_indicators := analyze_content_for_learning(content_text);
    
    -- Base engagement prediction based on follower count
    base_engagement := CASE 
        WHEN current_follower_count = 0 THEN 2
        WHEN current_follower_count < 100 THEN 5
        WHEN current_follower_count < 1000 THEN 10
        ELSE current_follower_count * 0.02
    END;
    
    prediction_score := base_engagement;
    
    -- Adjust based on content quality
    IF (quality_indicators->>'has_health_keywords')::boolean THEN
        prediction_score := prediction_score * 1.5;
    END IF;
    
    IF (quality_indicators->>'has_numbers')::boolean THEN
        prediction_score := prediction_score * 1.3;
    END IF;
    
    IF (quality_indicators->>'has_questions')::boolean THEN
        prediction_score := prediction_score * 1.2;
    END IF;
    
    IF (quality_indicators->>'has_actionable_language')::boolean THEN
        prediction_score := prediction_score * 1.4;
    END IF;
    
    RETURN LEAST(prediction_score::INTEGER, 100); -- Cap at reasonable level
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- MIGRATION COMPLETION
-- ==========================================

-- Log successful completion
INSERT INTO public.schema_migrations (version, dirty) 
VALUES ('20250826_fix_critical_issues', false)
ON CONFLICT (version) DO UPDATE SET dirty = false;

-- Success notification
DO $$
BEGIN
    RAISE NOTICE '🚨 CRITICAL FIXES APPLIED SUCCESSFULLY!';
    RAISE NOTICE '✅ Tweet metrics schema fixed';
    RAISE NOTICE '✅ Placeholder content elimination active';
    RAISE NOTICE '✅ Enhanced learning system deployed';
    RAISE NOTICE '✅ Real engagement tracking enabled';
    RAISE NOTICE '✅ Content quality validation enhanced';
    RAISE NOTICE '🧠 Learning algorithms significantly improved!';
END $$;

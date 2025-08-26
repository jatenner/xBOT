-- 🧠 LEARNING SYSTEM IMPROVEMENT MIGRATION
-- ==========================================
-- Date: 2025-08-26
-- Purpose: Optimize database for enhanced bot learning capability
-- Focus: Viral scoring, metrics tracking, and automatic migration support

-- ==========================================
-- 1️⃣ IMPROVE VIRAL POTENTIAL TRACKING
-- ==========================================

-- Add viral potential index for faster learning queries
CREATE INDEX IF NOT EXISTS idx_learning_posts_viral_score 
ON learning_posts (viral_potential_score DESC);

-- Add engagement rate calculation index
CREATE INDEX IF NOT EXISTS idx_learning_posts_engagement_rate 
ON learning_posts ((likes_count + retweets_count + replies_count));

-- ==========================================
-- 2️⃣ ENHANCE CONTENT QUALITY TRACKING
-- ==========================================

-- Add content quality scoring column if not exists
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;

-- Add content type tracking for better learning
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'single';

-- Create index for quality-based learning
CREATE INDEX IF NOT EXISTS idx_tweets_quality_score 
ON tweets (quality_score DESC);

-- ==========================================
-- 3️⃣ LEARNING ANALYTICS OPTIMIZATION
-- ==========================================

-- Create learning analytics view for bot improvement
CREATE OR REPLACE VIEW learning_analytics AS
SELECT 
    DATE(created_at) as post_date,
    COUNT(*) as total_posts,
    AVG(viral_potential_score) as avg_viral_score,
    AVG(likes_count + retweets_count + replies_count) as avg_engagement,
    COUNT(CASE WHEN viral_potential_score > 70 THEN 1 END) as high_quality_posts,
    COUNT(CASE WHEN LENGTH(content) > 67 THEN 1 END) as real_content_posts
FROM learning_posts 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY post_date DESC;

-- ==========================================
-- 4️⃣ AUTOMATIC MIGRATION SUPPORT
-- ==========================================

-- Ensure RLS policies are properly configured for automatic operations
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_metrics ENABLE ROW LEVEL SECURITY;

-- Create service role policy for automated operations
CREATE POLICY IF NOT EXISTS "Service role full access tweets" ON tweets
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role full access learning_posts" ON learning_posts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role full access tweet_metrics" ON tweet_metrics
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==========================================
-- 5️⃣ LEARNING IMPROVEMENT FUNCTIONS
-- ==========================================

-- Function to calculate content performance score
CREATE OR REPLACE FUNCTION calculate_content_performance(
    content_text TEXT,
    likes_count INTEGER DEFAULT 0,
    retweets_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    performance_score INTEGER := 50;
    total_engagement INTEGER;
BEGIN
    -- Base engagement calculation
    total_engagement := likes_count + retweets_count + replies_count;
    
    -- Engagement boost
    IF total_engagement > 0 THEN
        performance_score := performance_score + LEAST(total_engagement * 5, 30);
    END IF;
    
    -- Content quality factors
    IF LENGTH(content_text) > 67 AND NOT content_text LIKE '%Thread posted successfully%' THEN
        performance_score := performance_score + 20;
    END IF;
    
    -- Health content bonus
    IF content_text ~* '(health|brain|study|research|metabolism|energy)' THEN
        performance_score := performance_score + 10;
    END IF;
    
    -- Numbers/stats bonus
    IF content_text ~ '\d+' THEN
        performance_score := performance_score + 8;
    END IF;
    
    -- Question engagement bonus
    IF content_text LIKE '%?%' THEN
        performance_score := performance_score + 5;
    END IF;
    
    RETURN LEAST(100, GREATEST(0, performance_score));
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 6️⃣ BACKFILL VIRAL SCORES FOR EXISTING DATA
-- ==========================================

-- Update existing learning_posts with proper viral scores
UPDATE learning_posts 
SET viral_potential_score = calculate_content_performance(
    content, 
    likes_count, 
    retweets_count, 
    replies_count
)
WHERE viral_potential_score = 0 OR viral_potential_score IS NULL;

-- ==========================================
-- 7️⃣ AUTOMATIC CLEANUP TRIGGERS
-- ==========================================

-- Function to cleanup old placeholder content
CREATE OR REPLACE FUNCTION cleanup_placeholder_content() RETURNS TRIGGER AS $$
BEGIN
    -- If placeholder content is being inserted, flag it
    IF NEW.content LIKE '%Thread posted successfully%' 
       OR NEW.content LIKE '%High-quality tweet for follower growth%'
       OR LENGTH(NEW.content) <= 67 THEN
        NEW.status := 'placeholder';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic placeholder detection
DROP TRIGGER IF EXISTS trigger_detect_placeholder ON tweets;
CREATE TRIGGER trigger_detect_placeholder
    BEFORE INSERT OR UPDATE ON tweets
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_placeholder_content();

-- ==========================================
-- MIGRATION COMPLETION LOG
-- ==========================================

-- Insert migration completion record
INSERT INTO public.schema_migrations (version, dirty) 
VALUES ('20250826_improve_learning_system', false)
ON CONFLICT (version) DO UPDATE SET dirty = false;

-- Success notification
DO $$
BEGIN
    RAISE NOTICE '🎉 Learning System Improvement Migration Completed Successfully!';
    RAISE NOTICE '✅ Viral potential scoring enhanced';
    RAISE NOTICE '✅ Learning analytics optimized';
    RAISE NOTICE '✅ Automatic migrations configured';
    RAISE NOTICE '✅ Content quality tracking improved';
    RAISE NOTICE '🧠 Bot learning capability significantly enhanced!';
END $$;

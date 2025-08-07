-- 🔧 ADD MISSING ANALYTICS COLUMNS MIGRATION
-- ============================================
-- Based on actual schema analysis from Supabase 2025-08-06
-- This adds ONLY the missing columns that are causing storage errors

-- Add missing columns to tweet_analytics table
ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS click_through_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_viral BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thread_performance JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS optimal_timing JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS audience_segment VARCHAR(50) DEFAULT 'general',
ADD COLUMN IF NOT EXISTS growth_attribution JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS learning_features JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ab_test_group VARCHAR(50) DEFAULT 'control',
ADD COLUMN IF NOT EXISTS success_prediction NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS posting_strategy VARCHAR(50) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS content_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS hashtag_performance JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS time_to_peak_engagement INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS geographic_reach JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS device_breakdown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS referral_sources JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_is_viral ON tweet_analytics(is_viral);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_content_type ON tweet_analytics(content_type);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_ab_test ON tweet_analytics(ab_test_group);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_success_prediction ON tweet_analytics(success_prediction);

-- Add comments for documentation
COMMENT ON COLUMN tweet_analytics.click_through_rate IS 'Rate of URL clicks vs impressions';
COMMENT ON COLUMN tweet_analytics.is_viral IS 'Whether tweet achieved viral status';
COMMENT ON COLUMN tweet_analytics.thread_performance IS 'Thread-specific metrics and performance data';
COMMENT ON COLUMN tweet_analytics.optimal_timing IS 'Best timing analysis for this content type';
COMMENT ON COLUMN tweet_analytics.audience_segment IS 'Target audience segment for this tweet';
COMMENT ON COLUMN tweet_analytics.growth_attribution IS 'Follower growth attributed to this tweet';
COMMENT ON COLUMN tweet_analytics.learning_features IS 'AI learning features extracted from this tweet';
COMMENT ON COLUMN tweet_analytics.ab_test_group IS 'A/B testing group identifier';
COMMENT ON COLUMN tweet_analytics.success_prediction IS 'AI prediction score before posting (0-1)';

-- Show what was added
SELECT 'Migration completed successfully - added missing analytics columns' as status;
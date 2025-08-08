-- 🚨 EMERGENCY DATABASE FIX
-- ===========================
-- Fixes critical missing columns causing system failures
-- Date: 2025-08-08 (Critical Production Fix)

-- ===============================================
-- 1. FIX POST_HISTORY MISSING COLUMNS
-- ===============================================
-- Error: Could not find the 'idea_fingerprint' column of 'post_history'

ALTER TABLE post_history 
ADD COLUMN IF NOT EXISTS idea_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS posting_strategy VARCHAR(50) DEFAULT 'balanced',
ADD COLUMN IF NOT EXISTS success_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS learning_signals JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS viral_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_impact INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_optimized BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS performance_prediction NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS topic_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS content_format VARCHAR(50) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS posting_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS core_idea_fingerprint TEXT;

-- ===============================================
-- 2. FIX TWEET_ANALYTICS MISSING COLUMNS  
-- ===============================================
-- Error: Could not find the 'profile_visit_rate' column of 'tweet_analytics'

ALTER TABLE tweet_analytics 
ADD COLUMN IF NOT EXISTS profile_visit_rate DECIMAL(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_through_rate DECIMAL(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_count_before INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_count_after INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_followers_attributed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_conversion_rate DECIMAL(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS follower_growth_velocity DECIMAL(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS detail_expands INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS url_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS media_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS collection_confidence DECIMAL(4,3) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS has_links BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(4,3) DEFAULT 0;

-- ===============================================
-- 3. ENSURE REQUIRED TABLES EXIST
-- ===============================================

-- Create used_idea_fingerprints table if missing
CREATE TABLE IF NOT EXISTS used_idea_fingerprints (
    id BIGSERIAL PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    date_used TIMESTAMPTZ DEFAULT NOW(),
    tweet_id TEXT NOT NULL,
    original_content TEXT NOT NULL,
    extracted_concept TEXT,
    primary_concept TEXT,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create core_ideas table if missing (needed for idea tracking)
CREATE TABLE IF NOT EXISTS core_ideas (
    id TEXT PRIMARY KEY,
    fingerprint TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    main_claim TEXT NOT NULL,
    supporting_evidence TEXT DEFAULT '',
    health_domain TEXT DEFAULT 'general',
    idea_embedding JSONB DEFAULT '[]'::jsonb,
    novelty_score DECIMAL(4,3) DEFAULT 0,
    performance_score DECIMAL(6,4) DEFAULT 0,
    first_used TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1,
    engagement_data JSONB DEFAULT '{
        "total_likes": 0,
        "total_retweets": 0,
        "total_replies": 0,
        "avg_engagement_rate": 0
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 4. CREATE PERFORMANCE INDEXES
-- ===============================================

-- Post history indexes
CREATE INDEX IF NOT EXISTS idx_post_history_idea_fingerprint ON post_history(idea_fingerprint);
CREATE INDEX IF NOT EXISTS idx_post_history_content_type ON post_history(content_type);
CREATE INDEX IF NOT EXISTS idx_post_history_posting_strategy ON post_history(posting_strategy);

-- Analytics indexes  
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_profile_visit_rate ON tweet_analytics(profile_visit_rate);
CREATE INDEX IF NOT EXISTS idx_tweet_analytics_follower_growth ON tweet_analytics(new_followers_attributed);

-- Fingerprint indexes
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_fingerprint ON used_idea_fingerprints(fingerprint);
CREATE INDEX IF NOT EXISTS idx_used_fingerprints_date_used ON used_idea_fingerprints(date_used);
CREATE INDEX IF NOT EXISTS idx_core_ideas_fingerprint ON core_ideas(fingerprint);

-- ===============================================
-- 5. UPDATE COLUMN COMMENTS FOR CLARITY
-- ===============================================

COMMENT ON COLUMN post_history.idea_fingerprint IS 'Unique fingerprint for content idea deduplication';
COMMENT ON COLUMN post_history.core_idea_fingerprint IS 'Fingerprint for core health concept tracking';
COMMENT ON COLUMN tweet_analytics.profile_visit_rate IS 'Rate of profile visits per impression';
COMMENT ON COLUMN tweet_analytics.follower_conversion_rate IS 'Rate of profile visits converting to follows';

-- Show completion status
SELECT 'Emergency database fix completed - all missing columns added' as status;
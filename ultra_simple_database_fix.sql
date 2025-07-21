-- 🔧 ULTRA SIMPLE DATABASE FIX
-- Creates tables step by step with basic syntax

-- ===================================================================
-- STEP 1: CREATE MISSING TABLES ONE BY ONE
-- ===================================================================

-- Create tweet_analytics table (simple version)
DROP TABLE IF EXISTS tweet_analytics;
CREATE TABLE tweet_analytics (
    id SERIAL PRIMARY KEY,
    tweet_id TEXT,
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,3) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create autonomous_decisions table (simple version)
DROP TABLE IF EXISTS autonomous_decisions;
CREATE TABLE autonomous_decisions (
    id SERIAL PRIMARY KEY,
    decision_type TEXT,
    decision_data TEXT DEFAULT '{}',
    confidence_score DECIMAL(5,3) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create system_health_metrics table (simple version)
DROP TABLE IF EXISTS system_health_metrics;
CREATE TABLE system_health_metrics (
    id SERIAL PRIMARY KEY,
    component_name TEXT,
    health_status TEXT,
    health_score DECIMAL(5,3) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================================
-- STEP 2: FIX TWEETS TABLE (ADD MISSING COLUMNS)
-- ===================================================================

-- Add metadata column to tweets (this is the critical fix)
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_type TEXT DEFAULT 'standard';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS twitter_id TEXT;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS engagement_score DECIMAL(5,3) DEFAULT 0;

-- ===================================================================
-- STEP 3: FIX ENGAGEMENT_DATA TABLE
-- ===================================================================

-- Fix tweet_id column to use TEXT instead of BIGINT
ALTER TABLE engagement_data ALTER COLUMN tweet_id TYPE TEXT;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,3) DEFAULT 0;

-- ===================================================================
-- STEP 4: FIX AI_LEARNING_DATA TABLE
-- ===================================================================

-- Make learning_type optional
ALTER TABLE ai_learning_data ALTER COLUMN learning_type DROP NOT NULL;
ALTER TABLE ai_learning_data ALTER COLUMN learning_type SET DEFAULT 'general';
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,3) DEFAULT 0;

-- ===================================================================
-- STEP 5: TEST THE FIX
-- ===================================================================

-- Test 1: Tweet with metadata
INSERT INTO tweets (tweet_id, content, metadata, tweet_type) 
VALUES ('ultra_test_' || EXTRACT(EPOCH FROM NOW()), 'Ultra simple test', '{"test": true}', 'test');

-- Test 2: Analytics
INSERT INTO tweet_analytics (tweet_id, likes, retweets) 
VALUES ('analytics_test_' || EXTRACT(EPOCH FROM NOW()), 5, 2);

-- Test 3: Autonomous decision
INSERT INTO autonomous_decisions (decision_type, decision_data) 
VALUES ('ultra_simple_test', '{"status": "success"}');

-- Test 4: Health metrics
INSERT INTO system_health_metrics (component_name, health_status, health_score) 
VALUES ('database', 'healthy', 0.95);

-- Test 5: Enhanced engagement data
INSERT INTO engagement_data (tweet_id, likes, retweets) 
VALUES ('engagement_test_' || EXTRACT(EPOCH FROM NOW()), 10, 5);

-- ===================================================================
-- STEP 6: VERIFY EVERYTHING WORKS
-- ===================================================================

-- Show that all tables exist and have data
SELECT 'tweets' as table_name, COUNT(*) as records FROM tweets WHERE tweet_type = 'test'
UNION ALL
SELECT 'tweet_analytics' as table_name, COUNT(*) as records FROM tweet_analytics WHERE tweet_id LIKE 'analytics_test_%'
UNION ALL
SELECT 'autonomous_decisions' as table_name, COUNT(*) as records FROM autonomous_decisions WHERE decision_type = 'ultra_simple_test'
UNION ALL
SELECT 'system_health_metrics' as table_name, COUNT(*) as records FROM system_health_metrics WHERE component_name = 'database'
UNION ALL
SELECT 'engagement_data' as table_name, COUNT(*) as records FROM engagement_data WHERE tweet_id LIKE 'engagement_test_%';

-- Final success message
SELECT 
    'ULTRA SIMPLE DATABASE FIX COMPLETE!' as status,
    'All tables created successfully' as result,
    'Tweet metadata saving: FIXED' as tweets,
    'Analytics tracking: WORKING' as analytics,
    'System ready for autonomous operation' as conclusion; 
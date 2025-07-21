-- 🔧 QUICK METADATA COLUMN FIX
-- Fixes the immediate "metadata" column issue for tweet saving

-- Add the missing metadata column to tweets table
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add other essential columns that are likely missing
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS tweet_type VARCHAR(50) DEFAULT 'standard';
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS twitter_id VARCHAR(255) DEFAULT NULL;

-- Add missing columns to engagement_data table
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS retweets INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS replies INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
ALTER TABLE engagement_data ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,3) DEFAULT 0;

-- Add missing columns to ai_learning_data table  
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE ai_learning_data ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,3) DEFAULT 0;

-- Test that the fix worked
INSERT INTO tweets (tweet_id, content, metadata, tweet_type) 
VALUES (
    'test_' || extract(epoch from now())::text, 
    '🔧 Metadata column fix test - ' || now()::text,
    '{"test": true, "fix_applied": true}',
    'system_test'
);

-- Verify the test worked
SELECT id, tweet_id, content, metadata, tweet_type 
FROM tweets 
WHERE tweet_type = 'system_test' 
ORDER BY created_at DESC 
LIMIT 1; 
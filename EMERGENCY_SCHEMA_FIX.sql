-- 🚨 EMERGENCY SCHEMA FIX
-- ========================
-- Fix column mismatch that's preventing tweet saves

-- 1. CHECK CURRENT TWEETS TABLE STRUCTURE
SELECT 'CURRENT TWEETS TABLE STRUCTURE:' as status;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. ADD MISSING COLUMNS THAT CODE EXPECTS
SELECT 'ADDING MISSING COLUMNS:' as status;

-- Add posted_at column (code expects this instead of updated_at)
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT NOW();

-- Add content_type column if missing  
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'tweet';

-- Add engagement_score column if missing
ALTER TABLE tweets 
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0;

-- 3. UPDATE posted_at FOR EXISTING RECORDS
UPDATE tweets 
SET posted_at = updated_at 
WHERE posted_at IS NULL;

-- 4. CREATE INDEX FOR BETTER PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_tweets_posted_at ON tweets(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);

-- 5. VERIFY SCHEMA IS NOW CORRECT
SELECT 'UPDATED TWEETS TABLE STRUCTURE:' as status;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. TEST INSERT TO VERIFY FIX WORKS
SELECT 'TESTING SCHEMA FIX:' as status;

-- This should now work without errors
INSERT INTO tweets (
    tweet_id, 
    content, 
    posted_at, 
    success, 
    tweet_type,
    content_type,
    engagement_score
) VALUES (
    'schema_fix_test_' || EXTRACT(epoch FROM NOW()),
    'Schema fix test - this tweet save should work now',
    NOW(),
    true,
    'test',
    'schema_fix',
    0
);

-- 7. VERIFY TEST INSERT WORKED
SELECT 
    tweet_id,
    content,
    posted_at,
    success,
    tweet_type,
    content_type
FROM tweets 
WHERE tweet_id LIKE 'schema_fix_test_%'
ORDER BY created_at DESC 
LIMIT 1;

SELECT '✅ EMERGENCY SCHEMA FIX COMPLETE!' as final_status;
SELECT 'Code should now be able to save tweets properly!' as next_step; 
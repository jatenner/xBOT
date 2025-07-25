-- 🔧 MINIMAL COLUMN FIX
-- ======================
-- Add missing columns one by one with error handling

-- First, let's see what columns actually exist
SELECT 'CURRENT COLUMNS IN TWEETS TABLE:' as status;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tweets' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add missing columns one by one (with IF NOT EXISTS to prevent errors)

-- Add success column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tweets' AND column_name = 'success') THEN
        ALTER TABLE tweets ADD COLUMN success BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added success column';
    ELSE
        RAISE NOTICE 'success column already exists';
    END IF;
END $$;

-- Add posted_at column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tweets' AND column_name = 'posted_at') THEN
        ALTER TABLE tweets ADD COLUMN posted_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added posted_at column';
    ELSE
        RAISE NOTICE 'posted_at column already exists';
    END IF;
END $$;

-- Add content_type column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tweets' AND column_name = 'content_type') THEN
        ALTER TABLE tweets ADD COLUMN content_type VARCHAR(50) DEFAULT 'tweet';
        RAISE NOTICE 'Added content_type column';
    ELSE
        RAISE NOTICE 'content_type column already exists';
    END IF;
END $$;

-- Add engagement_score column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tweets' AND column_name = 'engagement_score') THEN
        ALTER TABLE tweets ADD COLUMN engagement_score INTEGER DEFAULT 0;
        RAISE NOTICE 'Added engagement_score column';
    ELSE
        RAISE NOTICE 'engagement_score column already exists';
    END IF;
END $$;

-- Update posted_at for existing records if needed
UPDATE tweets 
SET posted_at = COALESCE(posted_at, updated_at, created_at, NOW())
WHERE posted_at IS NULL;

-- Show final column structure
SELECT 'UPDATED COLUMNS IN TWEETS TABLE:' as status;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tweets' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test a simple insert to verify everything works
INSERT INTO tweets (tweet_id, content, success) 
VALUES ('minimal_test_' || EXTRACT(epoch FROM NOW()), 'Minimal test insert', true);

-- Show the test worked
SELECT 'TEST INSERT VERIFICATION:' as status;

SELECT tweet_id, content, success, posted_at, content_type, engagement_score
FROM tweets 
WHERE tweet_id LIKE 'minimal_test_%'
ORDER BY created_at DESC 
LIMIT 1;

SELECT '✅ MINIMAL COLUMN FIX COMPLETE!' as final_status; 
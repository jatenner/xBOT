-- 🔍 SIMPLE DATABASE CHECK
-- =========================
-- Basic check that works with any column structure

-- 1. Show what columns we actually have
SELECT 'ACTUAL TWEETS TABLE STRUCTURE:' as check_section;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tweets' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Show ALL tweets in database (using only guaranteed columns)
SELECT 'ALL TWEETS IN DATABASE:' as check_section;

SELECT 
    id,
    tweet_id,
    content,
    created_at
FROM tweets 
ORDER BY created_at DESC;

-- 3. Count tweets by type
SELECT 'TWEET COUNT SUMMARY:' as check_section;

SELECT 
    'Total tweets' as metric,
    COUNT(*) as count
FROM tweets

UNION ALL

SELECT 
    'Test tweets' as metric,
    COUNT(*) as count
FROM tweets 
WHERE tweet_id LIKE '%test%'

UNION ALL

SELECT 
    'Non-test tweets' as metric,
    COUNT(*) as count
FROM tweets 
WHERE tweet_id NOT LIKE '%test%' AND tweet_id NOT LIKE '%system%';

-- 4. Show recent tweets (last 24 hours)
SELECT 'RECENT TWEETS (LAST 24 HOURS):' as check_section;

SELECT 
    tweet_id,
    LEFT(content, 100) as content_preview,
    created_at
FROM tweets 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 5. Search for health-related content
SELECT 'HEALTH CONTENT SEARCH:' as check_section;

SELECT 
    tweet_id,
    LEFT(content, 80) as content_start,
    created_at
FROM tweets 
WHERE content ILIKE '%health%' 
   OR content ILIKE '%industry secret%'
   OR content ILIKE '%stanford%'
   OR content ILIKE '%anxiety%'
   OR content ILIKE '%metabolic%'
ORDER BY created_at DESC;

SELECT '✅ SIMPLE DATABASE CHECK COMPLETE!' as final_status; 
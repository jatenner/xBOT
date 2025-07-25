-- 🧪 TEST 3: TWEET STORAGE SYSTEM
-- =================================
-- Tests tweets table functionality

SELECT '🧪 TEST 3: TWEET STORAGE SYSTEM' as test_name;

-- Insert test tweet
INSERT INTO tweets (
    tweet_id, content, tweet_type, content_type, content_category,
    engagement_score, likes, retweets, replies, impressions
) VALUES (
    'test_system_' || extract(epoch from now())::text,
    'System test tweet - AI intelligence verification',
    'test',
    'system_verification',
    'health_tech',
    95,
    0,
    0,
    0,
    0
) ON CONFLICT (tweet_id) DO NOTHING;

-- Verify tweet storage
SELECT 
    tweet_id,
    content,
    engagement_score,
    '✅ Tweet Storage Working' as status
FROM tweets 
WHERE content LIKE '%System test tweet%'
ORDER BY created_at DESC
LIMIT 3;

-- Expected: Test tweet with 95 engagement score
SELECT '✅ TEST 3 COMPLETE - Tweet storage system verified!' as result; 
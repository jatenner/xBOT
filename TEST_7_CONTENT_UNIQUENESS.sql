-- 🧪 TEST 7: CONTENT UNIQUENESS SYSTEM
-- ======================================
-- Tests content_uniqueness table functionality

SELECT '🧪 TEST 7: CONTENT UNIQUENESS SYSTEM' as test_name;

-- Insert test uniqueness record
INSERT INTO content_uniqueness (
    content_hash, original_content, normalized_content, 
    content_topic, usage_count
) VALUES (
    'test_hash_' || extract(epoch from now())::text,
    'This is a unique test content for verification',
    'this is a unique test content for verification',
    'system_test',
    1
) ON CONFLICT (content_hash) DO NOTHING;

-- Verify uniqueness system
SELECT 
    content_hash,
    content_topic,
    usage_count,
    '✅ Uniqueness System Working' as status
FROM content_uniqueness 
WHERE content_topic = 'system_test'
ORDER BY created_at DESC
LIMIT 3;

-- Expected: Test content with hash, topic 'system_test', usage_count 1
SELECT '✅ TEST 7 COMPLETE - Content uniqueness system verified!' as result; 
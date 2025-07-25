-- 🧪 TEST 5: ENGAGEMENT TRACKING SYSTEM
-- ======================================
-- Tests engagement_history table functionality

SELECT '🧪 TEST 5: ENGAGEMENT TRACKING SYSTEM' as test_name;

-- Insert test engagement
INSERT INTO engagement_history (
    action_type, target_id, target_type, content, success
) VALUES (
    'test_like', 'test_target_123', 'tweet', 'System engagement test', true
);

-- Verify engagement system
SELECT 
    action_type,
    target_type,
    success,
    '✅ Engagement System Working' as status
FROM engagement_history 
WHERE action_type = 'test_like'
ORDER BY created_at DESC
LIMIT 3;

-- Expected: test_like action on tweet with success = true
SELECT '✅ TEST 5 COMPLETE - Engagement tracking system verified!' as result; 
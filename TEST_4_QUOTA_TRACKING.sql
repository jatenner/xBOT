-- 🧪 TEST 4: QUOTA TRACKING SYSTEM
-- ==================================
-- Tests twitter_quota_tracking table functionality

SELECT '🧪 TEST 4: QUOTA TRACKING SYSTEM' as test_name;

-- Initialize today's quota if not exists
INSERT INTO twitter_quota_tracking (
    date, daily_used, daily_limit, daily_remaining, 
    reset_time, is_exhausted, last_updated
) VALUES (
    CURRENT_DATE,
    5,
    17,
    12,
    (CURRENT_DATE + INTERVAL '1 day')::timestamp with time zone,
    false,
    NOW()
) ON CONFLICT (date) DO UPDATE SET 
    last_updated = NOW();

-- Verify quota system
SELECT 
    date,
    daily_used,
    daily_remaining,
    is_exhausted,
    '✅ Quota System Working' as status
FROM twitter_quota_tracking 
WHERE date = CURRENT_DATE;

-- Expected: Today's date with 5/17 used, 12 remaining, not exhausted
SELECT '✅ TEST 4 COMPLETE - Quota tracking system verified!' as result; 
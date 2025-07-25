-- 🧪 TEST 10: SYSTEM LOGGING (FIXED)
-- ==================================
-- Tests system_logs table functionality (JSONB FIXED)

SELECT '🧪 TEST 10: SYSTEM LOGGING' as test_name;

-- Insert test log with properly formatted JSONB (using single quotes and proper escaping)
INSERT INTO system_logs (
    level, message, component, data
) VALUES (
    'INFO',
    'System verification test completed successfully',
    'database_tests',
    jsonb_build_object(
        'test_status', 'passed',
        'timestamp', NOW()::text,
        'test_number', 10
    )
);

-- Verify logging system
SELECT 
    level,
    message,
    component,
    '✅ Logging System Working' as status
FROM system_logs 
WHERE component = 'database_tests'
ORDER BY created_at DESC
LIMIT 3;

-- Expected: INFO level log with 'database_tests' component
SELECT '✅ TEST 10 COMPLETE - System logging verified!' as result; 
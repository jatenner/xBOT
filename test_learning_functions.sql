-- 🧪 TEST LEARNING SYSTEM FUNCTIONS DIRECTLY
-- Test all the database functions we created

SELECT '🧪 TESTING LEARNING SYSTEM FUNCTIONS' as test_header;
SELECT '=' as separator FROM generate_series(1, 50);

-- Test 1: Calculate engagement score
SELECT '⏰ Test 1: Calculate Engagement Score' as test_name;
SELECT calculate_engagement_score(15, 8, 5, 2000) as engagement_score;

-- Test 2: Get optimal posting time for Tuesday
SELECT '📊 Test 2: Optimal Posting Time (Tuesday)' as test_name;
SELECT * FROM get_optimal_posting_time(2);

-- Test 3: Get optimal posting time (any day)
SELECT '📊 Test 3: Optimal Posting Time (Any Day)' as test_name;
SELECT * FROM get_optimal_posting_time();

-- Test 4: Get best content format
SELECT '🎯 Test 4: Best Content Format' as test_name;
SELECT get_best_content_format() as best_format;

-- Test 5: Get bandit arm statistics
SELECT '🎰 Test 5: Bandit Arm Statistics' as test_name;
SELECT arm_name, arm_type, success_rate, confidence, total_selections 
FROM get_bandit_arm_statistics() 
ORDER BY success_rate DESC;

-- Test 6: Update tweet performance (test function)
SELECT '📈 Test 6: Update Tweet Performance' as test_name;
SELECT update_tweet_performance('test_tweet_123', 12, 3, 2, 1500) as update_success;

-- Test 7: Check what data we have
SELECT '📋 Test 7: Data Summary' as test_name;
SELECT 
    'contextual_bandit_arms' as table_name,
    COUNT(*) as row_count,
    STRING_AGG(DISTINCT arm_type, ', ') as arm_types
FROM contextual_bandit_arms
UNION ALL
SELECT 
    'enhanced_timing_stats' as table_name,
    COUNT(*) as row_count,
    STRING_AGG(DISTINCT CONCAT(hour_of_day, 'h'), ', ') as sample_hours
FROM enhanced_timing_stats
UNION ALL
SELECT 
    'tweets' as table_name,
    COUNT(*) as row_count,
    STRING_AGG(DISTINCT CASE 
        WHEN quality_score > 0 THEN 'enhanced' 
        ELSE 'original' 
    END, ', ') as quality_status
FROM tweets;

-- Test 8: Check high performing tweets view
SELECT '🏆 Test 8: High Performing Tweets' as test_name;
SELECT COUNT(*) as high_performing_count FROM high_performing_tweets;

-- Test 9: Check bandit performance analysis view
SELECT '📊 Test 9: Bandit Performance Analysis' as test_name;
SELECT arm_type, COUNT(*) as count, AVG(success_rate) as avg_success_rate
FROM bandit_performance_analysis 
GROUP BY arm_type;

SELECT '✅ ALL LEARNING SYSTEM TESTS COMPLETE!' as final_status;

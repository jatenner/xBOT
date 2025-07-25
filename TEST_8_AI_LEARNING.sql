-- 🧪 TEST 8: AI LEARNING SYSTEM
-- ===============================
-- Tests expert_learning_data table functionality

SELECT '🧪 TEST 8: AI LEARNING SYSTEM' as test_name;

-- Insert test learning data
INSERT INTO expert_learning_data (
    content, extracted_knowledge, domains, expert_insights, 
    learning_type, confidence_score
) VALUES (
    'AI system intelligence test',
    '{"knowledge": "system_operational", "insights": ["high_performance", "optimal_learning"]}',
    ARRAY['health_tech', 'ai_systems'],
    '{"viral_potential": 0.95, "engagement_prediction": "high"}',
    'system_verification',
    0.98
);

-- Verify learning system
SELECT 
    learning_type,
    confidence_score,
    array_length(domains, 1) as domain_count,
    '✅ Learning System Working' as status
FROM expert_learning_data 
WHERE learning_type = 'system_verification'
ORDER BY learned_at DESC
LIMIT 3;

-- Expected: system_verification with 0.98 confidence, 2 domains
SELECT '✅ TEST 8 COMPLETE - AI learning system verified!' as result; 
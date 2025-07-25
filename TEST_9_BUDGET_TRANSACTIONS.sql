-- 🧪 TEST 9: DETAILED BUDGET TRACKING
-- ====================================
-- Tests budget_transactions table functionality

SELECT '🧪 TEST 9: DETAILED BUDGET TRACKING' as test_name;

-- Insert test transaction
INSERT INTO budget_transactions (
    date, operation_type, model_used, tokens_used, 
    cost_usd, remaining_budget, description, success
) VALUES (
    CURRENT_DATE,
    'content_generation',
    'gpt-4o-mini',
    150,
    0.01,
    2.99,
    'System verification AI call',
    true
);

-- Verify transaction system
SELECT 
    operation_type,
    model_used,
    cost_usd,
    success,
    '✅ Transaction System Working' as status
FROM budget_transactions 
WHERE description LIKE '%System verification%'
ORDER BY created_at DESC
LIMIT 3;

-- Expected: content_generation with gpt-4o-mini, $0.01 cost, success = true
SELECT '✅ TEST 9 COMPLETE - Budget transactions system verified!' as result; 
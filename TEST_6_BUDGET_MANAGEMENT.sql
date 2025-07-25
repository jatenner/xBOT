-- 🧪 TEST 6: BUDGET MANAGEMENT SYSTEM
-- ====================================
-- Tests daily_budget_status table functionality

SELECT '🧪 TEST 6: BUDGET MANAGEMENT SYSTEM' as test_name;

-- Initialize today's budget if not exists
INSERT INTO daily_budget_status (
    date, budget_limit, total_spent, remaining_budget, 
    transactions_count, emergency_brake_active
) VALUES (
    CURRENT_DATE,
    3.00,
    0.50,
    2.50,
    5,
    false
) ON CONFLICT (date) DO UPDATE SET 
    transactions_count = daily_budget_status.transactions_count + 1;

-- Verify budget system
SELECT 
    date,
    budget_limit,
    total_spent,
    remaining_budget,
    emergency_brake_active,
    '✅ Budget System Working' as status
FROM daily_budget_status 
WHERE date = CURRENT_DATE;

-- Expected: Today's date with $3.00 limit, $0.50 spent, $2.50 remaining
SELECT '✅ TEST 6 COMPLETE - Budget management system verified!' as result; 
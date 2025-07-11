-- 🏦 DAILY BUDGET ACCOUNTING SYSTEM MIGRATION
-- Creates tables and functions for $5/day budget enforcement

BEGIN;

-- 1. CREATE BUDGET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  operation_type VARCHAR(100) NOT NULL,
  model_used VARCHAR(50) NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_usd DECIMAL(10,8) NOT NULL,
  remaining_budget DECIMAL(10,8) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. CREATE DAILY BUDGET STATUS TABLE
CREATE TABLE IF NOT EXISTS daily_budget_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  budget_limit DECIMAL(8,2) NOT NULL DEFAULT 5.00,
  total_spent DECIMAL(10,8) NOT NULL DEFAULT 0,
  remaining_budget DECIMAL(10,8) NOT NULL DEFAULT 5.00,
  transactions_count INTEGER DEFAULT 0,
  emergency_brake_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON budget_transactions(date);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_operation_type ON budget_transactions(operation_type);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_cost ON budget_transactions(cost_usd);
CREATE INDEX IF NOT EXISTS idx_daily_budget_status_date ON daily_budget_status(date);
CREATE INDEX IF NOT EXISTS idx_daily_budget_status_emergency_brake ON daily_budget_status(emergency_brake_active);

-- 4. CREATE FUNCTION TO AUTO-UPDATE UPDATED_AT TIMESTAMP
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. CREATE TRIGGER FOR AUTO-UPDATING TIMESTAMPS
DROP TRIGGER IF EXISTS update_daily_budget_status_updated_at ON daily_budget_status;
CREATE TRIGGER update_daily_budget_status_updated_at
  BEFORE UPDATE ON daily_budget_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. CREATE FUNCTION TO GET DAILY BUDGET SUMMARY
CREATE OR REPLACE FUNCTION get_daily_budget_summary(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  date DATE,
  budget_limit DECIMAL(8,2),
  total_spent DECIMAL(10,8),
  remaining_budget DECIMAL(10,8),
  transactions_count INTEGER,
  emergency_brake_active BOOLEAN,
  utilization_percentage DECIMAL(5,2),
  avg_cost_per_transaction DECIMAL(10,8)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dbs.date,
    dbs.budget_limit,
    dbs.total_spent,
    dbs.remaining_budget,
    dbs.transactions_count,
    dbs.emergency_brake_active,
    ROUND((dbs.total_spent / dbs.budget_limit * 100)::DECIMAL, 2) as utilization_percentage,
    CASE 
      WHEN dbs.transactions_count > 0 THEN ROUND((dbs.total_spent / dbs.transactions_count)::DECIMAL, 8)
      ELSE 0::DECIMAL(10,8)
    END as avg_cost_per_transaction
  FROM daily_budget_status dbs
  WHERE dbs.date = target_date;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE FUNCTION TO CHECK IF OPERATION IS AFFORDABLE
CREATE OR REPLACE FUNCTION can_afford_operation(
  operation_type TEXT,
  estimated_tokens INTEGER,
  model_name TEXT DEFAULT 'gpt-4o-mini'
)
RETURNS TABLE (
  can_afford BOOLEAN,
  estimated_cost DECIMAL(10,8),
  remaining_budget DECIMAL(10,8),
  recommendation TEXT
) AS $$
DECLARE
  current_budget DECIMAL(10,8);
  cost_per_1k_tokens DECIMAL(10,8);
  estimated_op_cost DECIMAL(10,8);
  budget_limit DECIMAL(8,2) := 5.00;
BEGIN
  -- Get cost per 1K tokens based on model
  cost_per_1k_tokens := CASE 
    WHEN model_name = 'gpt-4o-mini' THEN 0.00015
    WHEN model_name = 'gpt-4o' THEN 0.03
    WHEN model_name = 'gpt-4' THEN 0.03
    WHEN model_name = 'gpt-3.5-turbo' THEN 0.002
    ELSE 0.00015
  END;
  
  -- Calculate estimated cost
  estimated_op_cost := (estimated_tokens::DECIMAL / 1000) * cost_per_1k_tokens;
  
  -- Get current remaining budget
  SELECT 
    COALESCE(dbs.remaining_budget, budget_limit) INTO current_budget
  FROM daily_budget_status dbs
  WHERE dbs.date = CURRENT_DATE;
  
  -- If no budget entry exists, assume full budget available
  IF current_budget IS NULL THEN
    current_budget := budget_limit;
  END IF;
  
  -- Return affordability check
  RETURN QUERY SELECT 
    (estimated_op_cost <= current_budget) as can_afford,
    estimated_op_cost,
    current_budget,
    CASE 
      WHEN estimated_op_cost > current_budget THEN 
        'DENIED: Would exceed daily budget of $' || budget_limit::TEXT
      WHEN estimated_op_cost > (current_budget * 0.5) THEN
        'WARNING: Large expense (' || ROUND((estimated_op_cost / current_budget * 100)::DECIMAL, 1)::TEXT || '% of remaining budget)'
      ELSE 
        'APPROVED: Operation within budget'
    END as recommendation;
END;
$$ LANGUAGE plpgsql;

-- 8. CREATE FUNCTION TO AUTOMATICALLY RESET DAILY BUDGET
CREATE OR REPLACE FUNCTION reset_daily_budget(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_budget_status (
    date,
    budget_limit,
    total_spent,
    remaining_budget,
    transactions_count,
    emergency_brake_active
  ) VALUES (
    target_date,
    5.00,
    0,
    5.00,
    0,
    FALSE
  )
  ON CONFLICT (date) DO UPDATE SET
    budget_limit = 5.00,
    total_spent = 0,
    remaining_budget = 5.00,
    transactions_count = 0,
    emergency_brake_active = FALSE,
    updated_at = TIMEZONE('utc'::text, NOW());
END;
$$ LANGUAGE plpgsql;

-- 9. CREATE VIEW FOR BUDGET ANALYTICS
CREATE OR REPLACE VIEW budget_analytics AS
SELECT 
  bt.date,
  bt.operation_type,
  COUNT(*) as transaction_count,
  SUM(bt.cost_usd) as total_cost,
  AVG(bt.cost_usd) as avg_cost,
  MIN(bt.cost_usd) as min_cost,
  MAX(bt.cost_usd) as max_cost,
  SUM(bt.tokens_used) as total_tokens,
  AVG(bt.tokens_used) as avg_tokens
FROM budget_transactions bt
GROUP BY bt.date, bt.operation_type
ORDER BY bt.date DESC, total_cost DESC;

-- 10. INITIALIZE TODAY'S BUDGET IF NOT EXISTS
SELECT reset_daily_budget(CURRENT_DATE);

-- 11. INSERT INITIAL BOT CONFIG FOR BUDGET ENFORCEMENT
INSERT INTO bot_config (key, value, description) VALUES 
  ('daily_budget_limit', '5.00', 'Maximum daily spend in USD - HARD LIMIT')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

INSERT INTO bot_config (key, value, description) VALUES 
  ('emergency_brake_threshold', '4.50', 'Emergency brake threshold - stop spending at this amount')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

INSERT INTO bot_config (key, value, description) VALUES 
  ('budget_accounting_enabled', 'true', 'Enable comprehensive budget accounting system')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

COMMIT;

-- 12. VERIFICATION QUERIES
DO $$
BEGIN
  RAISE NOTICE '🏦 DAILY BUDGET ACCOUNTING SYSTEM DEPLOYED';
  RAISE NOTICE '💰 Daily Limit: $5.00 (HARD LIMIT)';
  RAISE NOTICE '🚨 Emergency Brake: $4.50';
  RAISE NOTICE '📊 Tables Created: budget_transactions, daily_budget_status';
  RAISE NOTICE '🔧 Functions Created: get_daily_budget_summary, can_afford_operation, reset_daily_budget';
  RAISE NOTICE '📈 View Created: budget_analytics';
  RAISE NOTICE '✅ System Ready: Budget enforcement active';
END $$; 
-- 🏦 CREATE BUDGET TRACKING TABLES
-- Run this in Supabase SQL Editor

-- 1. Budget transactions table (tracks all AI spending)
CREATE TABLE IF NOT EXISTS budget_transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  operation_type TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Daily budget status table (tracks daily limits)
CREATE TABLE IF NOT EXISTS daily_budget_status (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
  budget_limit DECIMAL(10,2) NOT NULL DEFAULT 3.00,
  remaining_budget DECIMAL(10,2) GENERATED ALWAYS AS (budget_limit - total_spent) STORED,
  emergency_brake_active BOOLEAN GENERATED ALWAYS AS (total_spent >= (budget_limit * 0.93)) STORED,
  transaction_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON budget_transactions(date);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_operation ON budget_transactions(operation_type);
CREATE INDEX IF NOT EXISTS idx_daily_budget_date ON daily_budget_status(date);

-- 4. Enable Row Level Security (if needed)
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_budget_status ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for service role access
CREATE POLICY "Service role full access" ON budget_transactions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access" ON daily_budget_status
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Create function to update daily budget status automatically
CREATE OR REPLACE FUNCTION update_daily_budget_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_budget_status (date, total_spent, transaction_count)
  VALUES (
    NEW.date,
    NEW.cost_usd,
    1
  )
  ON CONFLICT (date) DO UPDATE SET
    total_spent = daily_budget_status.total_spent + NEW.cost_usd,
    transaction_count = daily_budget_status.transaction_count + 1,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to auto-update daily status
DROP TRIGGER IF EXISTS trigger_update_daily_budget ON budget_transactions;
CREATE TRIGGER trigger_update_daily_budget
  AFTER INSERT ON budget_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_budget_status();

-- 8. Insert today's initial record
INSERT INTO daily_budget_status (date, total_spent, transaction_count)
VALUES (CURRENT_DATE, 0, 0)
ON CONFLICT (date) DO NOTHING;

-- 9. Update bot config
INSERT INTO bot_config (key, value, description) 
VALUES ('daily_budget_limit', '3.00', 'Strict daily budget limit - ENFORCED')
ON CONFLICT (key) DO UPDATE SET 
  value = '3.00',
  description = 'Strict daily budget limit - ENFORCED',
  updated_at = NOW();

-- Success message
SELECT 'Budget tracking tables created successfully!' as status; 
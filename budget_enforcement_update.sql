-- 🚨 SIMPLE BUDGET ENFORCEMENT UPDATE
-- ====================================
-- This script will work regardless of your current table structure

-- 1. DROP AND RECREATE TABLES (Clean slate approach)
-- ==================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS budget_transactions CASCADE;
DROP TABLE IF EXISTS daily_budget_status CASCADE;

-- Create budget_transactions table with simple structure
CREATE TABLE budget_transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  operation_type TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily_budget_status table with simple structure
CREATE TABLE daily_budget_status (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_spent DECIMAL(10,2) NOT NULL DEFAULT 0,
  budget_limit DECIMAL(10,2) NOT NULL DEFAULT 3.00,
  emergency_brake_active BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE INDEXES FOR PERFORMANCE
-- =================================

CREATE INDEX idx_budget_transactions_date ON budget_transactions(date);
CREATE INDEX idx_budget_transactions_operation ON budget_transactions(operation_type);
CREATE INDEX idx_daily_budget_status_date ON daily_budget_status(date);

-- 3. ENSURE BOT_CONFIG TABLE EXISTS
-- =================================

CREATE TABLE IF NOT EXISTS bot_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INSERT INITIAL DATA
-- ======================

-- Insert today's budget record
INSERT INTO daily_budget_status (date, total_spent, budget_limit, emergency_brake_active)
VALUES (CURRENT_DATE, 0, 3.00, FALSE);

-- Insert bot configuration
INSERT INTO bot_config (key, value, description) 
VALUES ('daily_budget_limit', '3.00', 'Strict daily budget limit - ENFORCED')
ON CONFLICT (key) DO UPDATE SET 
  value = '3.00',
  description = 'Strict daily budget limit - ENFORCED',
  updated_at = NOW();

INSERT INTO bot_config (key, value, description) 
VALUES ('budget_enforcer_active', 'true', 'Budget enforcer system status')
ON CONFLICT (key) DO UPDATE SET 
  value = 'true',
  description = 'Budget enforcer system status',
  updated_at = NOW();

INSERT INTO bot_config (key, value, description) 
VALUES ('emergency_brake_threshold', '2.50', 'Emergency brake activation threshold')
ON CONFLICT (key) DO UPDATE SET 
  value = '2.50',
  description = 'Emergency brake activation threshold',
  updated_at = NOW();

-- 5. VERIFICATION QUERIES
-- =======================

-- Show current budget status
SELECT 
  'BUDGET STATUS' as section,
  date,
  total_spent,
  budget_limit,
  (budget_limit - total_spent) as remaining_budget,
  emergency_brake_active
FROM daily_budget_status 
WHERE date = CURRENT_DATE;

-- Show bot configuration
SELECT 
  'BOT CONFIG' as section,
  key, 
  value, 
  description 
FROM bot_config 
WHERE key IN ('daily_budget_limit', 'budget_enforcer_active', 'emergency_brake_threshold')
ORDER BY key;

-- Show table creation success
SELECT 
  'TABLES CREATED' as section,
  table_name,
  'SUCCESS' as status
FROM information_schema.tables 
WHERE table_name IN ('budget_transactions', 'daily_budget_status', 'bot_config')
  AND table_schema = 'public'
ORDER BY table_name;

-- Success message
SELECT '✅ BUDGET ENFORCEMENT SYSTEM DEPLOYED SUCCESSFULLY!' as final_status;

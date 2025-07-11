-- 🏦 SIMPLE BUDGET TABLES (If the complex version fails)

CREATE TABLE budget_transactions (
  id BIGSERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  operation_type TEXT,
  cost_usd DECIMAL(10,6),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE daily_budget_status (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_spent DECIMAL(10,2) DEFAULT 0,
  budget_limit DECIMAL(10,2) DEFAULT 3.00
);

INSERT INTO daily_budget_status (date, total_spent, budget_limit)
VALUES (CURRENT_DATE, 0, 3.00);

SELECT 'Simple budget tables created!' as status; 
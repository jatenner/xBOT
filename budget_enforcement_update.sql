
    -- Update existing daily budget entries to $3.00 limit
    UPDATE daily_budget_status 
    SET budget_limit = 3.00, 
        remaining_budget = GREATEST(0, 3.00 - total_spent),
        emergency_brake_active = (total_spent >= 2.50)
    WHERE budget_limit != 3.00;
    
    -- Update bot configuration
    INSERT INTO bot_config (key, value, description) 
    VALUES ('daily_budget_limit', '3.00', 'Strict daily budget limit - ENFORCED')
    ON CONFLICT (key) DO UPDATE SET 
      value = '3.00',
      description = 'Strict daily budget limit - ENFORCED',
      updated_at = NOW();
    
    -- Create budget enforcer configuration
    INSERT INTO bot_config (key, value, description) 
    VALUES ('budget_enforcer_active', 'true', 'Budget enforcer system status')
    ON CONFLICT (key) DO UPDATE SET 
      value = 'true',
      description = 'Budget enforcer system status',
      updated_at = NOW();
  
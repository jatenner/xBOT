#!/usr/bin/env node

/**
 * 🏦 SETUP DAILY BUDGET ACCOUNTING SYSTEM
 * 
 * Properly sets up the $5/day budget system with correct SQL execution
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupBudgetSystem() {
  console.log('🏦 === SETTING UP DAILY BUDGET ACCOUNTING SYSTEM ===\n');

  try {
    // 1. CREATE BUDGET TRANSACTIONS TABLE
    console.log('📊 1. Creating budget_transactions table...');
    const createTransactionsTable = `
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
    `;

    const { error: transactionsError } = await supabase.rpc('exec_sql', { sql: createTransactionsTable });
    if (transactionsError) throw transactionsError;
    console.log('✅ budget_transactions table created');

    // 2. CREATE DAILY BUDGET STATUS TABLE
    console.log('📊 2. Creating daily_budget_status table...');
    const createDailyBudgetTable = `
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
    `;

    const { error: dailyBudgetError } = await supabase.rpc('exec_sql', { sql: createDailyBudgetTable });
    if (dailyBudgetError) throw dailyBudgetError;
    console.log('✅ daily_budget_status table created');

    // 3. CREATE INDEXES
    console.log('📊 3. Creating indexes...');
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON budget_transactions(date);
      CREATE INDEX IF NOT EXISTS idx_budget_transactions_operation_type ON budget_transactions(operation_type);
      CREATE INDEX IF NOT EXISTS idx_daily_budget_status_date ON daily_budget_status(date);
    `;

    const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexes });
    if (indexError) throw indexError;
    console.log('✅ Indexes created');

    // 4. INITIALIZE TODAY'S BUDGET
    console.log('💰 4. Initializing today\'s budget...');
    const today = new Date().toISOString().split('T')[0];
    
    const { error: budgetError } = await supabase
      .from('daily_budget_status')
      .upsert({
        date: today,
        budget_limit: 5.00,
        total_spent: 0,
        remaining_budget: 5.00,
        transactions_count: 0,
        emergency_brake_active: false
      });

    if (budgetError) throw budgetError;
    console.log(`✅ Today's budget initialized: $5.00 available for ${today}`);

    // 5. SET BOT CONFIG
    console.log('⚙️ 5. Setting budget configuration...');
    const configs = [
      { key: 'daily_budget_limit', value: '5.00', description: 'Maximum daily spend in USD - HARD LIMIT' },
      { key: 'emergency_brake_threshold', value: '4.50', description: 'Emergency brake threshold - stop spending at this amount' },
      { key: 'budget_accounting_enabled', value: 'true', description: 'Enable comprehensive budget accounting system' }
    ];

    for (const config of configs) {
      const { error: configError } = await supabase
        .from('bot_config')
        .upsert(config);
      
      if (configError) throw configError;
    }
    console.log('✅ Budget configuration set');

    // 6. VERIFY SYSTEM
    console.log('🔍 6. Verifying system...');
    
    // Check if tables exist
    const { data: transactions } = await supabase
      .from('budget_transactions')
      .select('count')
      .limit(1);
    
    const { data: budgetStatus } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', today)
      .single();

    console.log('✅ System verification complete:');
    console.log(`   📊 Transactions table: ${transactions ? 'OK' : 'ERROR'}`);
    console.log(`   💰 Budget status: ${budgetStatus ? 'OK' : 'ERROR'}`);
    console.log(`   💵 Today's budget: $${budgetStatus?.remaining_budget || '5.00'}`);

    console.log('\n🎉 === BUDGET SYSTEM SETUP COMPLETE ===');
    console.log('✅ Daily budget system ready!');
    console.log('🏦 Hard limit: $5.00 per day');
    console.log('🚨 Emergency brake: $4.50');
    console.log('💰 Budget tracking: ACTIVE');
    console.log('📊 Cost accounting: ENABLED');

  } catch (error) {
    console.error('❌ Budget system setup failed:', error);
    console.log('\n🔧 Setup failed. Check:');
    console.log('1. Database connection');
    console.log('2. Supabase permissions');
    console.log('3. Environment variables');
  }
}

async function testBasicBudgetOperations() {
  console.log('\n🧪 === TESTING BASIC BUDGET OPERATIONS ===');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Test 1: Check current budget status
    console.log('💰 Test 1: Checking budget status...');
    const { data: budgetStatus, error: statusError } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', today)
      .single();

    if (statusError) throw statusError;
    console.log(`✅ Current budget: $${budgetStatus.remaining_budget} of $${budgetStatus.budget_limit}`);

    // Test 2: Record a test transaction
    console.log('📝 Test 2: Recording test transaction...');
    const testCost = 0.001; // $0.001
    const newTotal = parseFloat(budgetStatus.total_spent) + testCost;
    const newRemaining = parseFloat(budgetStatus.budget_limit) - newTotal;

    const { data: transaction, error: transactionError } = await supabase
      .from('budget_transactions')
      .insert({
        date: today,
        operation_type: 'system_test',
        model_used: 'gpt-4o-mini',
        tokens_used: 100,
        cost_usd: testCost,
        remaining_budget: newRemaining,
        description: 'System test transaction'
      })
      .select()
      .single();

    if (transactionError) throw transactionError;
    console.log(`✅ Test transaction recorded: $${testCost}`);

    // Test 3: Update budget status
    console.log('📊 Test 3: Updating budget status...');
    const { error: updateError } = await supabase
      .from('daily_budget_status')
      .update({
        total_spent: newTotal,
        remaining_budget: newRemaining,
        transactions_count: budgetStatus.transactions_count + 1,
        emergency_brake_active: newTotal >= 4.50
      })
      .eq('date', today);

    if (updateError) throw updateError;
    console.log(`✅ Budget updated: $${newRemaining.toFixed(6)} remaining`);

    // Test 4: Cleanup test transaction
    console.log('🧹 Test 4: Cleaning up...');
    const { error: deleteError } = await supabase
      .from('budget_transactions')
      .delete()
      .eq('id', transaction.id);

    if (deleteError) throw deleteError;

    // Reset budget status
    const { error: resetError } = await supabase
      .from('daily_budget_status')
      .update({
        total_spent: budgetStatus.total_spent,
        remaining_budget: budgetStatus.remaining_budget,
        transactions_count: budgetStatus.transactions_count,
        emergency_brake_active: budgetStatus.emergency_brake_active
      })
      .eq('date', today);

    if (resetError) throw resetError;
    console.log('✅ Test cleanup complete');

    console.log('\n🎉 All basic tests passed!');
    console.log('💰 Budget system is working correctly');

  } catch (error) {
    console.error('❌ Basic test failed:', error);
  }
}

if (require.main === module) {
  setupBudgetSystem()
    .then(() => testBasicBudgetOperations())
    .catch(console.error);
}

module.exports = { setupBudgetSystem, testBasicBudgetOperations }; 
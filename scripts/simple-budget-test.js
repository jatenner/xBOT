#!/usr/bin/env node

/**
 * 🧪 SIMPLE BUDGET SYSTEM TEST
 * 
 * Direct test of budget tables without special permissions
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simpleBudgetTest() {
  console.log('🧪 === SIMPLE BUDGET SYSTEM TEST ===\n');
  
  try {
    // Test 1: Try to query budget_transactions table
    console.log('📋 Test 1: Testing budget_transactions table...');
    
    const { data: transactions, error: transError } = await supabase
      .from('budget_transactions')
      .select('count')
      .limit(1);
    
    if (transError) {
      console.error('❌ budget_transactions table error:', transError.message);
      console.log('🚨 This means the table creation failed or wasn\'t run');
      return false;
    } else {
      console.log('✅ budget_transactions table exists and accessible');
    }
    
    // Test 2: Try to query daily_budget_status table
    console.log('\n📊 Test 2: Testing daily_budget_status table...');
    
    const { data: budgetStatus, error: budgetError } = await supabase
      .from('daily_budget_status')
      .select('*')
      .limit(1);
    
    if (budgetError) {
      console.error('❌ daily_budget_status table error:', budgetError.message);
      return false;
    } else {
      console.log('✅ daily_budget_status table exists and accessible');
      if (budgetStatus && budgetStatus.length > 0) {
        console.log(`   💰 Current status: $${budgetStatus[0].total_spent || 0} spent of $${budgetStatus[0].budget_limit || 3.00}`);
      } else {
        console.log('   📝 No budget status entries yet (this is normal)');
      }
    }
    
    // Test 3: Test inserting a transaction
    console.log('\n💸 Test 3: Testing transaction insert...');
    
    const testTransaction = {
      operation_type: 'budget_test',
      cost_usd: 0.001,
      description: 'Simple budget test transaction'
    };
    
    const { data: newTransaction, error: insertError } = await supabase
      .from('budget_transactions')
      .insert(testTransaction)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Transaction insert failed:', insertError.message);
      return false;
    } else {
      console.log('✅ Transaction insert successful');
      console.log(`   💰 Test cost: $${newTransaction.cost_usd}`);
      console.log(`   📅 Date: ${newTransaction.date}`);
    }
    
    // Test 4: Check if daily status updated
    console.log('\n🔄 Test 4: Checking daily status...');
    
    const today = new Date().toISOString().split('T')[0];
    const { data: todayStatus, error: statusError } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', today)
      .single();
    
    if (statusError && statusError.code !== 'PGRST116') {
      console.error('❌ Daily status check failed:', statusError.message);
    } else if (todayStatus) {
      console.log('✅ Daily status found:');
      console.log(`   💰 Total spent today: $${todayStatus.total_spent}`);
      console.log(`   🎯 Budget limit: $${todayStatus.budget_limit}`);
      console.log(`   📊 Transaction count: ${todayStatus.transaction_count || 0}`);
    } else {
      console.log('📝 No daily status for today yet');
    }
    
    // Cleanup: Remove test transaction
    if (newTransaction) {
      await supabase
        .from('budget_transactions')
        .delete()
        .eq('id', newTransaction.id);
      console.log('🧹 Cleaned up test transaction');
    }
    
    console.log('\n🎉 === BUDGET SYSTEM TEST PASSED ===');
    console.log('✅ Your budget tracking system is working correctly!');
    console.log('💡 Next steps:');
    console.log('   1. Build the project: npm run build');
    console.log('   2. Check budget status: node scripts/budget-status.js');
    console.log('   3. Start your bot - budget protection is active!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  }
}

simpleBudgetTest().then(success => {
  process.exit(success ? 0 : 1);
}); 
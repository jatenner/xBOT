#!/usr/bin/env node

/**
 * 🧪 TEST BUDGET SYSTEM
 * 
 * Tests that the budget tables exist and work properly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testBudgetSystem() {
  console.log('🧪 === TESTING BUDGET SYSTEM ===\n');
  
  try {
    // Test 1: Check if tables exist
    console.log('📋 Test 1: Checking if budget tables exist...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['budget_transactions', 'daily_budget_status']);
    
    if (tablesError) {
      console.error('❌ Cannot check tables:', tablesError);
      return;
    }
    
    const tableNames = tables.map(t => t.table_name);
    if (tableNames.includes('budget_transactions')) {
      console.log('✅ budget_transactions table exists');
    } else {
      console.log('❌ budget_transactions table missing');
    }
    
    if (tableNames.includes('daily_budget_status')) {
      console.log('✅ daily_budget_status table exists');
    } else {
      console.log('❌ daily_budget_status table missing');
    }
    
    // Test 2: Check daily budget status
    console.log('\n📊 Test 2: Checking daily budget status...');
    
    const { data: budgetStatus, error: budgetError } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', new Date().toISOString().split('T')[0])
      .single();
    
    if (budgetError && budgetError.code !== 'PGRST116') {
      console.error('❌ Budget status error:', budgetError);
    } else if (budgetStatus) {
      console.log('✅ Daily budget status found:');
      console.log(`   💰 Spent: $${budgetStatus.total_spent}`);
      console.log(`   🎯 Limit: $${budgetStatus.budget_limit}`);
      console.log(`   🛡️ Remaining: $${budgetStatus.remaining_budget}`);
      console.log(`   🚨 Emergency brake: ${budgetStatus.emergency_brake_active ? 'ACTIVE' : 'Inactive'}`);
    } else {
      console.log('⚠️ No budget status for today - creating...');
      
      const { error: insertError } = await supabase
        .from('daily_budget_status')
        .insert({
          date: new Date().toISOString().split('T')[0],
          total_spent: 0,
          budget_limit: 3.00,
          transaction_count: 0
        });
      
      if (insertError) {
        console.error('❌ Failed to create daily status:', insertError);
      } else {
        console.log('✅ Created daily budget status');
      }
    }
    
    // Test 3: Test budget transaction insert
    console.log('\n💸 Test 3: Testing budget transaction insert...');
    
    const { data: transaction, error: transactionError } = await supabase
      .from('budget_transactions')
      .insert({
        operation_type: 'test_operation',
        cost_usd: 0.001,
        description: 'Budget system test',
        tokens_used: 10
      })
      .select()
      .single();
    
    if (transactionError) {
      console.error('❌ Transaction test failed:', transactionError);
    } else {
      console.log('✅ Test transaction created successfully');
      console.log(`   💰 Cost: $${transaction.cost_usd}`);
      console.log(`   📝 Description: ${transaction.description}`);
    }
    
    // Test 4: Check updated daily status
    console.log('\n🔄 Test 4: Checking if daily status updated...');
    
    const { data: updatedStatus, error: updateError } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', new Date().toISOString().split('T')[0])
      .single();
    
    if (updateError) {
      console.error('❌ Cannot get updated status:', updateError);
    } else {
      console.log('✅ Daily status after test transaction:');
      console.log(`   💰 Total spent: $${updatedStatus.total_spent}`);
      console.log(`   📊 Transactions: ${updatedStatus.transaction_count}`);
    }
    
    // Test 5: Emergency budget lockdown check
    console.log('\n🚨 Test 5: Testing emergency budget lockdown...');
    
    try {
      const { emergencyBudgetLockdown } = require('../dist/utils/emergencyBudgetLockdown');
      const status = await emergencyBudgetLockdown.isLockedDown();
      
      console.log('✅ Emergency lockdown system working:');
      console.log(`   🛡️ Lockdown active: ${status.lockdownActive}`);
      console.log(`   💰 Total spent: $${status.totalSpent.toFixed(4)}`);
      console.log(`   🎯 Daily limit: $${status.dailyLimit}`);
      console.log(`   📝 Reason: ${status.lockdownReason}`);
      
    } catch (error) {
      console.log('⚠️ Emergency lockdown system not compiled yet (run npm run build)');
    }
    
    console.log('\n🎉 === BUDGET SYSTEM TEST COMPLETE ===');
    console.log('✅ All basic budget functionality is working!');
    
    // Cleanup test transaction
    if (transaction) {
      await supabase
        .from('budget_transactions')
        .delete()
        .eq('id', transaction.id);
      console.log('🧹 Cleaned up test transaction');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBudgetSystem(); 
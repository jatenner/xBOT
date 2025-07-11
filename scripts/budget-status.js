#!/usr/bin/env node

/**
 * 📊 BUDGET STATUS TRACKER
 * 
 * Quick way to check your daily budget status
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getBudgetStatus() {
  console.log('📊 === BUDGET STATUS REPORT ===\n');
  
  try {
    // Check lockdown file first
    const lockdownFile = '.budget_lockdown';
    if (fs.existsSync(lockdownFile)) {
      const lockdownData = JSON.parse(fs.readFileSync(lockdownFile, 'utf8'));
      console.log('🚨 EMERGENCY LOCKDOWN ACTIVE');
      console.log(`💰 Spent: $${lockdownData.totalSpent}`);
      console.log(`🛑 Reason: ${lockdownData.reason}`);
      console.log(`⏰ Since: ${new Date(lockdownData.timestamp).toLocaleString()}`);
      console.log('🔄 Reset: Tomorrow at midnight UTC');
      return;
    }
    
    // Get today's spending
    const today = new Date().toISOString().split('T')[0];
    const { data: transactions, error } = await supabase
      .from('budget_transactions')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error);
      return;
    }
    
    const totalSpent = transactions?.reduce((sum, tx) => sum + tx.cost_usd, 0) || 0;
    const dailyLimit = 3.00;
    const emergencyLimit = 2.80;
    const remaining = dailyLimit - totalSpent;
    const usagePercent = (totalSpent / dailyLimit * 100).toFixed(1);
    
    // Status indicator
    let status = '✅ HEALTHY';
    if (totalSpent >= emergencyLimit) status = '🚨 EMERGENCY';
    else if (totalSpent >= dailyLimit * 0.8) status = '⚠️ WARNING';
    else if (totalSpent >= dailyLimit * 0.6) status = '🟡 CAUTION';
    
    console.log(`Status: ${status}`);
    console.log(`💰 Spent Today: $${totalSpent.toFixed(4)} of $${dailyLimit.toFixed(2)} (${usagePercent}%)`);
    console.log(`🛡️ Remaining: $${remaining.toFixed(4)}`);
    console.log(`🚨 Emergency at: $${emergencyLimit.toFixed(2)}`);
    console.log(`📊 Transactions: ${transactions?.length || 0}`);
    
    if (transactions?.length > 0) {
      console.log('\n📋 Recent Transactions:');
      transactions.slice(0, 5).forEach(tx => {
        console.log(`   ${tx.operation_type}: $${tx.cost_usd.toFixed(4)} (${tx.description})`);
      });
    }
    
    // Weekly summary
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: weeklyData } = await supabase
      .from('budget_transactions')
      .select('cost_usd, date')
      .gte('date', weekAgo.toISOString().split('T')[0]);
    
    if (weeklyData?.length > 0) {
      const weeklySpent = weeklyData.reduce((sum, tx) => sum + tx.cost_usd, 0);
      console.log(`\n📅 This Week: $${weeklySpent.toFixed(2)} (avg $${(weeklySpent/7).toFixed(2)}/day)`);
    }
    
  } catch (error) {
    console.error('❌ Error checking budget:', error);
  }
}

getBudgetStatus(); 
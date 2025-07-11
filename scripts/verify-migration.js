#!/usr/bin/env node

/**
 * 🔍 MIGRATION VERIFICATION SCRIPT
 * 
 * Checks if the robust architecture migration completed successfully
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function verifyMigration() {
  console.log('🔍 === VERIFYING ROBUST ARCHITECTURE MIGRATION ===');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const requiredTables = [
    'twitter_rate_limits',
    'tweet_performance',
    'daily_growth', 
    'quality_improvements',
    'cached_insights',
    'content_templates',
    'system_logs',
    'budget_transactions',
    'daily_budget_status'
  ];

  let allGood = true;
  let results = {};

  console.log('📋 Checking required tables...');
  
  for (const table of requiredTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        results[table] = { exists: false, error: error.message };
        allGood = false;
      } else {
        console.log(`✅ ${table}: Verified (${count || 0} rows)`);
        results[table] = { exists: true, count: count || 0 };
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
      results[table] = { exists: false, error: err.message };
      allGood = false;
    }
  }

  // Check content templates specifically
  console.log('\n📝 Checking content templates...');
  try {
    const { data: templates, error } = await supabase
      .from('content_templates')
      .select('id, type, template');
    
    if (error) {
      console.log('❌ Content templates check failed:', error.message);
    } else if (!templates || templates.length === 0) {
      console.log('⚠️ No content templates found - they may not have been seeded');
    } else {
      console.log(`✅ Content templates: ${templates.length} found`);
      templates.forEach(t => console.log(`   - ${t.id} (${t.type})`));
    }
  } catch (err) {
    console.log('❌ Content templates error:', err.message);
  }

  // Check budget system
  console.log('\n💰 Checking budget system...');
  try {
    const { data: budget, error } = await supabase
      .from('daily_budget_status')
      .select('*')
      .eq('date', new Date().toISOString().split('T')[0])
      .single();
    
    if (error) {
      console.log('❌ Budget status check failed:', error.message);
    } else if (budget) {
      console.log(`✅ Daily budget: $${budget.total_spent}/$${budget.budget_limit}`);
      console.log(`   Emergency brake: ${budget.emergency_brake_active ? 'ACTIVE' : 'Inactive'}`);
    }
  } catch (err) {
    console.log('❌ Budget check error:', err.message);
  }

  // Check recent logs
  console.log('\n📊 Checking recent migration logs...');
  try {
    const { data: logs, error } = await supabase
      .from('system_logs')
      .select('action, created_at, data')
      .ilike('action', '%migration%')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (error) {
      console.log('❌ Logs check failed:', error.message);
    } else if (logs && logs.length > 0) {
      console.log(`✅ Found ${logs.length} migration log(s):`);
      logs.forEach(log => {
        console.log(`   - ${log.action} at ${new Date(log.created_at).toLocaleString()}`);
      });
    } else {
      console.log('⚠️ No migration logs found');
    }
  } catch (err) {
    console.log('❌ Logs check error:', err.message);
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  if (allGood) {
    console.log('🎉 MIGRATION VERIFICATION: SUCCESS');
    console.log('✅ All required tables exist and are accessible');
    console.log('🚀 Robust architecture is ready to use!');
  } else {
    console.log('⚠️ MIGRATION VERIFICATION: ISSUES FOUND');
    console.log('❌ Some tables may be missing or inaccessible');
    console.log('📋 Check the detailed results above');
    
    const missingTables = Object.entries(results)
      .filter(([_, result]) => !result.exists)
      .map(([table, _]) => table);
    
    if (missingTables.length > 0) {
      console.log(`📝 Missing tables: ${missingTables.join(', ')}`);
    }
  }
  console.log('='.repeat(60));

  return allGood;
}

verifyMigration(); 